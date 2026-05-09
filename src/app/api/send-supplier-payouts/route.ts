import { NextRequest, NextResponse } from "next/server";
import { getSupplier } from "@/lib/data";
import { sendSupplierPayout } from "@/lib/email";

interface PayoutSupplier {
  supplierId: string;
  supplierName: string;
  items: Array<{
    productName: string;
    ordered: number;
    arrived: number | null;
    unitPrice: number;
    value: number;
  }>;
  refunds: Array<{
    productName: string;
    amount: number;
    paidBy: string;
    reason: string | null;
    deduction: number;
  }>;
  arrivedValue: number;
  refundDeduction: number;
  finalPayout: number;
}

export async function POST(request: NextRequest) {
  try {
    const { deliveryDate, suppliers } = await request.json() as {
      deliveryDate: string;
      suppliers: PayoutSupplier[];
    };

    if (!deliveryDate || !suppliers || suppliers.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const results: Array<{ supplierId: string; supplierName: string; success: boolean; error?: string }> = [];

    for (const supplier of suppliers) {
      try {
        // Get supplier email
        const supplierData = await getSupplier(supplier.supplierId);
        
        if (!supplierData?.email) {
          results.push({
            supplierId: supplier.supplierId,
            supplierName: supplier.supplierName,
            success: false,
            error: "No email address",
          });
          continue;
        }

        // Send payout email
        await sendSupplierPayout({
          supplierEmail: supplierData.email,
          supplierName: supplier.supplierName,
          deliveryDate,
          items: supplier.items,
          refunds: supplier.refunds,
          arrivedValue: supplier.arrivedValue,
          refundDeduction: supplier.refundDeduction,
          finalPayout: supplier.finalPayout,
        });

        results.push({
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          success: true,
        });
      } catch (error) {
        results.push({
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          success: false,
          error: error instanceof Error ? error.message : "Failed to send",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error("Send payouts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send payouts" },
      { status: 500 }
    );
  }
}
