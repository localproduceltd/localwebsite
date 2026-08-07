import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { createOrderItemRefund, refundReasonConfig, type RefundPaidBy, type RefundReasonType } from "@/lib/data";
import { sendOrderItemRefund, sendSupplierRefundNotice } from "@/lib/email";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const {
      orderId,
      productName,
      quantity,
      refundAmount,
      reasonType,
      refundReason,
      itemArrived,
      paidBy,
      supplierId,
      // Explicit £ the supplier bears (retail, pre-commission); null/absent =
      // legacy payout behaviour. fullLineValue = quantity × full unit price,
      // used only for the supplier notice wording on partial deductions.
      supplierDeduction,
      fullLineValue,
    } = await request.json();

    if (!orderId || !productName || !refundAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the order to find the Stripe session
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("stripe_session_id, customer_email, customer_name, order_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let stripeRefundId: string | null = null;
    let manualRefundRequired = false;

    if (!order.stripe_session_id) {
      // No Stripe session - refund must be processed manually
      manualRefundRequired = true;
    } else {
      // Get the payment intent from the Stripe session
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);

      if (!session.payment_intent) {
        manualRefundRequired = true;
      } else {
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
        stripeRefundId = refund.id;
      }
    }

    const reason = (reasonType as RefundReasonType) || "other";
    const arrivedFlag = itemArrived ?? refundReasonConfig[reason]?.itemArrived ?? true;
    const reasonLabel = refundReasonConfig[reason]?.label ?? "";
    const deduction = typeof supplierDeduction === "number" ? Math.max(0, supplierDeduction) : null;

    // Record the refund in our database
    await createOrderItemRefund(
      orderId,
      productName,
      quantity,
      refundAmount,
      reason,
      refundReason || null,
      arrivedFlag,
      paidBy as RefundPaidBy,
      supplierId || null,
      deduction
    );

    // Supplier name goes in the customer's email; email for the supplier notice.
    let supplier: { name: string | null; email: string | null } | null = null;
    if (supplierId) {
      const { data } = await supabase
        .from("suppliers")
        .select("name, email")
        .eq("id", supplierId)
        .single();
      supplier = data;
    }

    // Send refund confirmation email
    if (order.customer_email) {
      try {
        await sendOrderItemRefund({
          customerEmail: order.customer_email,
          customerName: order.customer_name || "",
          orderNumber: order.order_number,
          productName,
          supplierName: supplier?.name || undefined,
          quantity,
          refundAmount,
          reasonLabel,
          reason: refundReason || null,
        });
      } catch (emailError) {
        console.error("Failed to send refund email:", emailError);
        // Don't fail the refund if email fails
      }
    }

    // Heads-up to the supplier when the refund costs them something: a
    // didn't-arrive refund (units drop out of their payout) or a deduction
    // they're paying all/half of. Local-pays refunds (e.g. packing slips)
    // don't notify - nothing for the supplier to act on.
    const costsSupplier = deduction !== null ? deduction > 0 || !arrivedFlag : (!arrivedFlag || paidBy !== "local");
    if (supplierId && costsSupplier) {
      try {
        if (supplier?.email) {
          await sendSupplierRefundNotice({
            supplierEmail: supplier.email,
            supplierName: supplier.name || "",
            orderNumber: order.order_number,
            productName,
            quantity,
            refundAmount,
            reasonLabel,
            reason: refundReason || null,
            paidBy: paidBy as RefundPaidBy,
            itemArrived: arrivedFlag,
            supplierDeduction: deduction,
            fullLineValue: typeof fullLineValue === "number" ? fullLineValue : null,
          });
        }
      } catch (emailError) {
        console.error("Failed to send supplier refund notice:", emailError);
        // Don't fail the refund if email fails
      }
    }

    return NextResponse.json({
      success: true,
      refundId: stripeRefundId,
      amount: refundAmount,
      manualRefundRequired,
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
