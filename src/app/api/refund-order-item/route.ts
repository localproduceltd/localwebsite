import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import {
  createOrderItemRefund,
  refundedQtyForLine,
  refundReasonConfig,
  type RefundFaultHint,
  type RefundPaidBy,
  type RefundReasonType,
} from "@/lib/data";
import { sendOrderItemRefund, sendSupplierRefundNotice } from "@/lib/email";
import { requireAdminOrPacker } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const gate = await requireAdminOrPacker();
  if (gate instanceof NextResponse) return gate;

  try {
    const {
      orderId,
      productName,
      quantity,
      // Optional: the packing bench never sends money, it sends units and we
      // price them from the order line. Josie's screens still pass an explicit
      // amount when she's refunding part of a line.
      refundAmount,
      refundPercent,
      reasonType,
      // What the customer is told. (`refundReason` is the old name for the
      // same thing - still accepted so nothing breaks mid-deploy.)
      customerNote,
      refundReason,
      itemArrived,
      supplierId,
      // Packer's hunch about whose fault it was. A hint for Josie's settle
      // queue, never a decision.
      faultHint,
      // Supplier side. Absent = leave pending for Josie to settle on Stock,
      // which is what every refund from the packing bench does. Josie's own
      // refunds pass these and settle in one go.
      paidBy,
      supplierDeduction,
      fullLineValue,
      supplierNote,
      // Per-attempt key from the client so a double-submit of the *same*
      // click can't reach Stripe twice.
      idempotencyKey,
    } = await request.json();

    if (!orderId || !productName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const units = Math.max(1, Number(quantity) || 1);
    const customerText: string | null = customerNote ?? refundReason ?? null;

    // Get the order to find the Stripe session
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("stripe_session_id, customer_email, customer_name, order_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ── Duplicate guard ──────────────────────────────────────────────────────
    // You can never refund more units than the customer ordered. This is the
    // backstop for the real-world failure: a refund that succeeded but whose
    // response never made it back, so the screen still offered the button and
    // it got pressed again. Checked before Stripe, so the second press costs
    // nothing. (Order #343, 28 Aug 2026 - refunded twice, 52 seconds apart.)
    const { data: lines, error: lineError } = await supabase
      .from("order_items")
      .select("quantity, price")
      .eq("order_id", orderId)
      .eq("product_name", productName);
    if (lineError) throw lineError;
    if (!lines || lines.length === 0) {
      return NextResponse.json(
        { error: `"${productName}" isn't on order #${order.order_number}` },
        { status: 400 }
      );
    }
    const orderedQty = lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);

    const unitPrice = Number(lines[0].price) || 0;

    const alreadyRefunded = await refundedQtyForLine(orderId, productName);
    const remaining = orderedQty - alreadyRefunded;
    if (remaining <= 0) {
      return NextResponse.json(
        {
          error: `${productName} on order #${order.order_number} has already been fully refunded (${alreadyRefunded} of ${orderedQty}). Refresh the page to see the current state.`,
          alreadyRefunded: true,
        },
        { status: 409 }
      );
    }
    if (units > remaining) {
      return NextResponse.json(
        {
          error: `Only ${remaining} of ${orderedQty} ${productName} left to refund on order #${order.order_number} (${alreadyRefunded} already refunded). Refresh the page to see the current state.`,
          alreadyRefunded: true,
        },
        { status: 409 }
      );
    }

    // Price the refund. The bench sends units only, so the money is worked out
    // here from the order line - a packer can't over- or under-refund by hand,
    // and there are no prices to show on the packing screen at all.
    const percent = Math.max(1, Math.min(100, Number(refundPercent) || 100));
    const amount =
      typeof refundAmount === "number"
        ? refundAmount
        : Math.round(units * unitPrice * percent) / 100;
    if (!(amount > 0)) {
      return NextResponse.json(
        { error: `Couldn't work out a refund amount for ${productName}` },
        { status: 400 }
      );
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
        const refundAmountPence = Math.round(amount * 100);
        const refund = await stripe.refunds.create(
          {
            payment_intent: session.payment_intent as string,
            amount: refundAmountPence,
            reason: "requested_by_customer",
            metadata: {
              order_id: orderId,
              order_number: order.order_number.toString(),
              product_name: productName,
              quantity: units.toString(),
              refund_reason: customerText || "",
            },
          },
          idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : undefined
        );
        stripeRefundId = refund.id;
      }
    }

    const reason = (reasonType as RefundReasonType) || "other";
    const arrivedFlag = itemArrived ?? refundReasonConfig[reason]?.itemArrived ?? true;
    const reasonLabel = refundReasonConfig[reason]?.label ?? "";

    // Settled inline only when the caller made the who-pays call (Josie from
    // Stock or Deliveries). Everything off the packing bench lands pending.
    const settleNow = typeof paidBy === "string";
    const deduction = typeof supplierDeduction === "number" ? Math.max(0, supplierDeduction) : null;

    const created = await createOrderItemRefund({
      orderId,
      productName,
      quantityRefunded: units,
      refundAmount: amount,
      reasonType: reason,
      customerNote: customerText,
      itemArrived: arrivedFlag,
      supplierId: supplierId || null,
      faultHint: (faultHint as RefundFaultHint) || null,
      supplierStatus: settleNow ? "settled" : "pending",
      paidBy: settleNow ? (paidBy as RefundPaidBy) : "local",
      supplierDeduction: settleNow ? deduction : null,
      supplierNote: settleNow ? supplierNote || null : null,
    });

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
          quantity: units,
          refundAmount: amount,
          reasonLabel,
          reason: customerText,
        });
      } catch (emailError) {
        console.error("Failed to send refund email:", emailError);
        // Don't fail the refund if email fails
      }
    }

    // The supplier only hears about it once the who-pays call has been made.
    // Pending refunds say nothing to the producer - that notice goes out from
    // the settle route instead.
    const costsSupplier =
      settleNow && (deduction !== null ? deduction > 0 || !arrivedFlag : !arrivedFlag || paidBy !== "local");
    if (supplierId && costsSupplier) {
      try {
        if (supplier?.email) {
          await sendSupplierRefundNotice({
            supplierEmail: supplier.email,
            supplierName: supplier.name || "",
            orderNumber: order.order_number,
            productName,
            quantity: units,
            refundAmount: amount,
            reasonLabel,
            reason: customerText,
            supplierNote: supplierNote || null,
            paidBy: paidBy as RefundPaidBy,
            itemArrived: arrivedFlag,
            supplierDeduction: deduction,
            fullLineValue:
              typeof fullLineValue === "number"
                ? fullLineValue
                : Math.round(units * unitPrice * 100) / 100,
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
      refund: created,
      amount,
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
