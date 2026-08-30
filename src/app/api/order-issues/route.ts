import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { orderIssueConfig, type OrderIssueType } from "@/lib/data";
import { sendOrderIssueAlert } from "@/lib/email";

/** How long after delivery a customer can report a problem: until next Friday. */
const REPORT_WINDOW_DAYS = 7;

/**
 * POST /api/order-issues
 * Body: { orderId, productName, quantity, issueType, customerNote? }
 *
 * The customer end of "Something not right?" on /account.
 *
 * This creates a REPORT, never a refund. Josie decides what happens on the
 * Stock tab. Nothing here touches money, the supplier, or the customer's card.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  try {
    const { orderId, productName, quantity, issueType, customerNote } = await request.json();

    if (!orderId || !productName || !issueType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!(issueType in orderIssueConfig)) {
      return NextResponse.json({ error: "Unknown issue type" }, { status: 400 });
    }

    // The order must be theirs. Checked server-side against Clerk's user id, so
    // an order id from someone else's box gets nowhere.
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, order_number, customer_name, customer_email, delivery_day, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.user_id !== userId) {
      return NextResponse.json({ error: "That isn't your order" }, { status: 403 });
    }

    // The line must be on the order, and we need its quantity to bound theirs.
    const { data: lines, error: lineError } = await supabaseAdmin
      .from("order_items")
      .select("quantity")
      .eq("order_id", orderId)
      .eq("product_name", productName);
    if (lineError) throw lineError;
    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: `${productName} isn't on that order` }, { status: 400 });
    }
    const orderedQty = lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
    const units = Math.max(1, Math.min(Number(quantity) || 1, orderedQty));

    // Window: from the delivery day until the next Friday. Open-ended reports
    // would mean refunds landing against a week whose suppliers are long paid.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    if (order.delivery_day > today) {
      return NextResponse.json(
        { error: "That box hasn't been delivered yet." },
        { status: 400 }
      );
    }
    const deadline = new Date(order.delivery_day + "T00:00:00");
    deadline.setDate(deadline.getDate() + REPORT_WINDOW_DAYS);
    if (today > deadline.toISOString().slice(0, 10)) {
      return NextResponse.json(
        { error: "That order's a bit too far back to report online now - drop us an email and we'll sort it." },
        { status: 400 }
      );
    }

    // Already refunded? Then they've had their money and a report would just
    // send Josie round the same loop again.
    const { data: refunds, error: refundError } = await supabaseAdmin
      .from("order_item_refunds")
      .select("quantity_refunded")
      .eq("order_id", orderId)
      .eq("product_name", productName);
    if (refundError) throw refundError;
    const refunded = (refunds ?? []).reduce((sum, r) => sum + (r.quantity_refunded ?? 0), 0);
    if (refunded >= orderedQty && orderIssueConfig[issueType as OrderIssueType].refundable) {
      return NextResponse.json(
        { error: "We've already refunded you for this one - check your email for the confirmation." },
        { status: 409 }
      );
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("order_issues")
      .insert({
        order_id: orderId,
        product_name: productName,
        quantity: units,
        issue_type: issueType,
        customer_note: (customerNote || "").trim() || null,
      })
      .select("*")
      .single();

    if (insertError) {
      // The partial unique index: one open report per line.
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You've already told us about this one - we're on it." },
          { status: 409 }
        );
      }
      throw insertError;
    }

    // Heads-up to Josie. A failed alert must never lose the report.
    try {
      await sendOrderIssueAlert({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        deliveryDay: order.delivery_day,
        productName,
        quantity: units,
        issueLabel: orderIssueConfig[issueType as OrderIssueType].label,
        customerNote: (customerNote || "").trim() || null,
      });
    } catch (emailError) {
      console.error("Order issue alert failed:", emailError);
    }

    return NextResponse.json({ success: true, issue: created });
  } catch (error) {
    console.error("Order issue error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't send that just now" },
      { status: 500 }
    );
  }
}
