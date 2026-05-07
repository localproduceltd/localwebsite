import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { setCustomerOutstandingBox } from "@/lib/data";

const BOX_DEPOSIT_PENCE = 1000; // £10

export async function POST(request: NextRequest) {
  try {
    const { clerkUserId } = await request.json();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Missing clerkUserId" }, { status: 400 });
    }

    // Find the most recent order with box deposit for this user
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, stripe_session_id, box_deposit_paid")
      .eq("user_id", clerkUserId)
      .eq("box_deposit_paid", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No order with box deposit found" }, { status: 404 });
    }

    const order = orders[0];

    if (!order.stripe_session_id) {
      return NextResponse.json({ error: "No Stripe session found for this order" }, { status: 400 });
    }

    // Get the payment intent from the Stripe session
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);

    if (!session.payment_intent) {
      return NextResponse.json({ error: "No payment intent found" }, { status: 400 });
    }

    // Create a partial refund for the box deposit
    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent as string,
      amount: BOX_DEPOSIT_PENCE,
      reason: "requested_by_customer",
    });

    // Update customer's outstanding box status
    await setCustomerOutstandingBox(clerkUserId, false);

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: BOX_DEPOSIT_PENCE / 100,
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
