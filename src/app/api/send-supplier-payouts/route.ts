import { NextRequest, NextResponse } from "next/server";
import { getSupplier } from "@/lib/data";
import { sendSupplierPayout, sendPayoutRunSheet } from "@/lib/email";

interface PayoutSupplier {
  supplierId: string;
  supplierName: string;
  items: Array<{
    productName: string;
    ordered: number;
    arrived: number | null;
    unitPrice: number;
    orderedValue: number;
    arrivedValue: number;
  }>;
  refunds: Array<{
    productName: string;
    amount: number;
    paidBy: string;
    reason: string | null;
    deduction: number;
  }>;
  orderedTotal: number;
  arrivedTotal: number;
  supplierRefundDeduction: number;
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

    const results: Array<{ supplierId: string; supplierName: string; supplierEmail?: string; success: boolean; error?: string }> = [];

    for (const supplier of suppliers) {
      let supplierEmail: string | undefined;
      try {
        // Get supplier email
        const supplierData = await getSupplier(supplier.supplierId);
        supplierEmail = supplierData?.email ?? undefined;
        
        if (!supplierData?.email) {
          results.push({
            supplierId: supplier.supplierId,
            supplierName: supplier.supplierName,
            supplierEmail: undefined,
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
          orderedTotal: supplier.orderedTotal,
          arrivedTotal: supplier.arrivedTotal,
          supplierRefundDeduction: supplier.supplierRefundDeduction,
          finalPayout: supplier.finalPayout,
        });

        results.push({
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          supplierEmail,
          success: true,
        });
      } catch (error) {
        results.push({
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          supplierEmail,
          success: false,
          error: error instanceof Error ? error.message : "Failed to send",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    // Send admin summary email
    let adminSummarySent = false;
    try {
      await sendPayoutRunSheet({
        deliveryDate,
        suppliers,
        results,
      });
      adminSummarySent = true;
    } catch (adminError) {
      console.error("Failed to send admin payout run sheet:", adminError);
      // Don't fail the request - supplier emails were the important bit
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      results,
      adminSummarySent,
    });
  } catch (error) {
    console.error("Send payouts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send payouts" },
      { status: 500 }
    );
  }
}
