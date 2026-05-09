import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { createOrderItemRefund, type RefundPaidBy } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const { 
      orderId, 
      productName, 
      quantity, 
      refundAmount, 
      refundReason, 
      paidBy, 
      supplierId 
    } = await request.json();

    if (!orderId || !productName || !refundAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the order to find the Stripe session
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("stripe_session_id, customer_email, order_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.stripe_session_id) {
      return NextResponse.json({ error: "No Stripe session found for this order" }, { status: 400 });
    }

    // Get the payment intent from the Stripe session
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);

    if (!session.payment_intent) {
      return NextResponse.json({ error: "No payment intent found" }, { status: 400 });
    }

    // Create the Stripe refund (amount in pence)
    const refundAmountPence = Math.round(refundAmount * 100);
    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent as string,
      amount: refundAmountPence,
      reason: "requested_by_customer",
      metadata: {
        order_id: orderId,
        order_number: order.order_number.toString(),
        product_name: productName,
        quantity: quantity.toString(),
        paid_by: paidBy,
        refund_reason: refundReason || "",
      },
    });

    // Record the refund in our database
    await createOrderItemRefund(
      orderId,
      productName,
      quantity,
      refundAmount,
      refundReason || null,
      paidBy as RefundPaidBy,
      supplierId || null
    );

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: refundAmount,
    });
  } catch (error) {
    console.error("Refund error:", error);
    
    // Check for Stripe-specific errors
    if (error instanceof Error) {
      if (error.message.includes("already been refunded")) {
        return NextResponse.json({ error: "This order has already been fully refunded" }, { status: 400 });
      }
      if (error.message.includes("greater than")) {
        return NextResponse.json({ error: "Refund amount exceeds available balance" }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process refund" },
      { status: 500 }
    );
  }
}
