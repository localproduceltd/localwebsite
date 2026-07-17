import { NextRequest, NextResponse } from "next/server";
import { getSupplier } from "@/lib/data";
import { sendSupplierPayout, sendPayoutRunSheet } from "@/lib/email";
import { requireAdmin } from "@/lib/admin-auth";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  // Sends real money-figures to real suppliers - admin only, like /api/admin/*
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { deliveryDate, suppliers } = await request.json() as {
      deliveryDate: string;
      suppliers: PayoutSupplier[];
    };

    if (!deliveryDate || !suppliers || suppliers.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const results: Array<{ supplierId: string; supplierName: string; supplierEmail?: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < suppliers.length; i++) {
      const supplier = suppliers[i];
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
          if (i < suppliers.length - 1) await sleep(250);
          continue;
        }

        // Send payout email with retry on rate limit
        const sendWithRetry = async () => {
          try {
            await sendSupplierPayout({
              supplierEmail: supplierData.email!,
              supplierName: supplier.supplierName,
              deliveryDate,
              items: supplier.items,
              refunds: supplier.refunds,
              orderedTotal: supplier.orderedTotal,
              arrivedTotal: supplier.arrivedTotal,
              supplierRefundDeduction: supplier.supplierRefundDeduction,
              finalPayout: supplier.finalPayout,
            });
          } catch (err) {
            const isRateLimit = (err as { statusCode?: number; name?: string })?.statusCode === 429 ||
              (err as { name?: string })?.name === "rate_limit_exceeded";
            if (isRateLimit) {
              await sleep(1000);
              await sendSupplierPayout({
                supplierEmail: supplierData.email!,
                supplierName: supplier.supplierName,
                deliveryDate,
                items: supplier.items,
                refunds: supplier.refunds,
                orderedTotal: supplier.orderedTotal,
                arrivedTotal: supplier.arrivedTotal,
                supplierRefundDeduction: supplier.supplierRefundDeduction,
                finalPayout: supplier.finalPayout,
              });
            } else {
              throw err;
            }
          }
        };
        await sendWithRetry();

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
      // Throttle: sleep after each iteration except the last
      if (i < suppliers.length - 1) await sleep(250);
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    // Send admin summary email
    let adminSummarySent = false;
    try {
      await sleep(250);
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
