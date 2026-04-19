import { NextRequest, NextResponse } from "next/server";
import {
  sendOrderConfirmation,
  sendProductApproved,
  sendProductRejected,
  sendSupplierNewOrder,
} from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case "order_confirmation":
        await sendOrderConfirmation(data);
        break;
      case "product_approved":
        await sendProductApproved(data);
        break;
      case "product_rejected":
        await sendProductRejected(data);
        break;
      case "supplier_new_order":
        await sendSupplierNewOrder(data);
        break;
      default:
        return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
