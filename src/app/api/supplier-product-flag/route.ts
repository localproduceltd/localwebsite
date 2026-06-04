import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupplierProductFlag, getOrders, getRefundsForDeliveryDay, removeSupplierProductFlag } from "@/lib/data";
import { supabase } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "Local Produce <onboarding@resend.dev>";

export async function POST(request: NextRequest) {
  try {
    const { deliveryDay, supplierId, productName, quantityUnavailable } = await request.json();

    if (!deliveryDay || !supplierId || !productName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // How many they can't supply. null/absent = whole line.
    const qtyUnavailable: number | null =
      typeof quantityUnavailable === "number" && quantityUnavailable > 0
        ? Math.floor(quantityUnavailable)
        : null;

    // Get supplier name
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("name")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Create the flag
    await createSupplierProductFlag(deliveryDay, supplierId, productName, "supplier", qtyUnavailable);

    // Count affected customers
    const orders = await getOrders();
    const affectedOrders = orders.filter(
      o => o.deliveryDay === deliveryDay && 
           o.status !== "cancelled" &&
           o.items.some(i => i.supplierId === supplierId && i.productName === productName)
    );
    const affectedCount = affectedOrders.length;

    // Format delivery date for email
    const deliveryDate = new Date(deliveryDay + "T00:00:00");
    const formattedDate = deliveryDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Send admin notification email
    const adminEmail = process.env.ADMIN_EMAIL || "josie@localproduce.ltd";
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `⚠️ ${supplier.name} flagged ${productName} won't arrive`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Supplier Product Unavailable</h2>
          
          <p><strong>${supplier.name}</strong> has flagged that <strong>${qtyUnavailable !== null ? `${qtyUnavailable}x ` : ""}${productName}</strong> won't arrive for the <strong>${formattedDate}</strong> delivery.</p>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>${affectedCount} customer${affectedCount !== 1 ? "s" : ""}</strong> ordered this product and may need refunds.
            </p>
          </div>
          
          <p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://www.localproduce.ltd"}/admin/stock"
               style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Review on Stock Tab
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Affected orders: ${affectedOrders.map(o => `#${o.orderNumber}`).join(", ") || "None"}
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      affectedCount,
    });
  } catch (error) {
    console.error("Flag product error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to flag product" },
      { status: 500 }
    );
  }
}

// Undo a "can't supply" flag ("Actually, I can supply").
// Blocked once customers have been refunded against this product for the day -
// we don't want to imply those refunds are reversed.
export async function DELETE(request: NextRequest) {
  try {
    const { deliveryDay, supplierId, productName } = await request.json();

    if (!deliveryDay || !supplierId || !productName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find orders on this day that include this supplier's product.
    const orders = await getOrders();
    const relevantOrderIds = new Set(
      orders
        .filter(o =>
          o.deliveryDay === deliveryDay &&
          o.items.some(i => i.supplierId === supplierId && i.productName === productName)
        )
        .map(o => o.id)
    );

    // Have any of those orders been refunded as "not coming" for this product?
    const dayRefunds = await getRefundsForDeliveryDay(deliveryDay);
    const alreadyRefunded = dayRefunds.some(r =>
      relevantOrderIds.has(r.orderId) &&
      r.productName === productName &&
      !r.itemArrived
    );

    if (alreadyRefunded) {
      return NextResponse.json(
        { error: "Customers have already been refunded for this item, so it can't be un-flagged. Please contact Local." },
        { status: 409 }
      );
    }

    await removeSupplierProductFlag(deliveryDay, supplierId, productName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unflag product error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove flag" },
      { status: 500 }
    );
  }
}
