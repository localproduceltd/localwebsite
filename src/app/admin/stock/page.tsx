"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Order, type OrderItem, type DeliveryStockTracking, type OrderItemRefund, type OrderItemCheckin, type RefundPaidBy, type RefundReasonType, type SupplierProductFlag, refundReasonConfig, getOrders, getDeliveryStockTracking, upsertDeliveryStockTracking, getRefundsForDeliveryDay, getOrderItemCheckins, toggleOrderItemCheckin, getSupplierProductFlags, resolveSupplierProductFlag, createSupplierProductFlag, removeSupplierProductFlag, getCompletedCheckins, setCheckinComplete, reopenCheckin } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, Truck, AlertTriangle, FileText, Mail, Download, Send, Users, Eye, Flag, PoundSterling } from "lucide-react";
import { ChilledTag, chilledRowClass } from "@/components/ChilledTag";

interface StockIssue {
  type: "shortage" | "flagged";
  deliveryDay: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  shortfall: number;
  orderedQty: number;
  arrivedQty: number | null;
  affectedOrders: Array<{ orderId: string; orderNumber: number; customerName: string | null; customerEmail: string | null; quantity: number; price: number }>;
}

interface ReviewModalState {
  issue: StockIssue;
  // orderId -> quantity to refund (1..their remaining line quantity)
  selectedQtys: Map<string, number>;
  reasonType: RefundReasonType;
  paidBy: RefundPaidBy;
  notes: string;
}

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function isUpcoming(dateStr: string) {
  if (!dateStr || dateStr === "unassigned") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return d >= today;
}

function formatItemLine(name: string, unit: string, qty: number) {
  return unit ? `${name} — ${unit} × ${qty}` : `${name} × ${qty}`;
}

interface SupplierOrderItems {
  orderId: string;
  orderNumber: number;
  boxNumber: number | null;
  items: Array<{ productName: string; unit: string; quantity: number; refrigerated: boolean }>;
}

interface SupplierSummary {
  supplierId: string;
  supplierName: string;
  totalItems: number;
  totalPrice: number;
  items: Array<{ productName: string; unit: string; quantity: number; price: number; refrigerated: boolean }>;
  orders: SupplierOrderItems[];
}

function getSupplierSummaries(orders: Order[], productRefrigerated?: Map<string, boolean>): SupplierSummary[] {
  const map = new Map<string, SupplierSummary>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      const id = item.supplierId || "unknown";
      const name = item.supplierName || "Unknown Supplier";
      if (!map.has(id)) {
        map.set(id, { supplierId: id, supplierName: name, totalItems: 0, totalPrice: 0, items: [], orders: [] });
      }
      const summary = map.get(id)!;
      summary.totalItems += item.quantity;
      summary.totalPrice += item.quantity * item.price;
      const refrigerated = productRefrigerated?.get(item.productId) ?? false;
      const itemKey = `${item.productName}|${item.unit || ""}`;
      const existing = summary.items.find(i => `${i.productName}|${i.unit || ""}` === itemKey);
      if (existing) {
        existing.quantity += item.quantity;
        existing.refrigerated = existing.refrigerated || refrigerated;
      } else {
        summary.items.push({ productName: item.productName, unit: item.unit, quantity: item.quantity, price: item.price, refrigerated });
      }
      let orderEntry = summary.orders.find(o => o.orderId === order.id);
      if (!orderEntry) {
        orderEntry = { orderId: order.id, orderNumber: order.orderNumber, boxNumber: order.boxNumber, items: [] };
        summary.orders.push(orderEntry);
      }
      orderEntry.items.push({ productName: item.productName, unit: item.unit, quantity: item.quantity, refrigerated });
    }
  }
  for (const summary of map.values()) {
    summary.orders.sort((a, b) => (a.boxNumber ?? a.orderNumber) - (b.boxNumber ?? b.orderNumber));
  }
  return Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export default function AdminStockPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [productRefrigerated, setProductRefrigerated] = useState<Map<string, boolean>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [expandedRefunds, setExpandedRefunds] = useState<Set<string>>(new Set());
  
  const [stockTracking, setStockTracking] = useState<Map<string, DeliveryStockTracking>>(new Map());
  const [orderCheckins, setOrderCheckins] = useState<Map<string, OrderItemCheckin>>(new Map());
  const [refunds, setRefunds] = useState<Map<string, OrderItemRefund[]>>(new Map());
  const [productFlags, setProductFlags] = useState<Map<string, SupplierProductFlag>>(new Map());
  // Keys are `${deliveryDay}-${supplierId}` for suppliers whose check-in is marked complete.
  const [completedCheckins, setCompletedCheckins] = useState<Set<string>>(new Set());
  const [payoutModal, setPayoutModal] = useState<string | null>(null);
  const [sendingPayouts, setSendingPayouts] = useState(false);
  const [sendingSummaries, setSendingSummaries] = useState<string | null>(null);
  
  // Issue review modal state
  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const handleOrderCheckIn = async (
    deliveryDay: string,
    supplierId: string,
    orderId: string,
    productName: string,
    quantity: number
  ) => {
    const checkinKey = `${orderId}-${supplierId}-${productName}`;
    const isNowChecked = await toggleOrderItemCheckin(orderId, supplierId, productName, quantity);
    
    if (isNowChecked) {
      setOrderCheckins(prev => {
        const next = new Map(prev);
        next.set(checkinKey, {
          id: "",
          orderId,
          supplierId,
          productName,
          quantity,
          checkedInAt: new Date().toISOString(),
        });
        return next;
      });
    } else {
      setOrderCheckins(prev => {
        const next = new Map(prev);
        next.delete(checkinKey);
        return next;
      });
    }
    
    const tracking = await getDeliveryStockTracking(deliveryDay);
    setStockTracking(prev => {
      const next = new Map(prev);
      for (const t of tracking) {
        next.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      return next;
    });
  };
  
  const isOrderItemCheckedIn = useCallback((orderId: string, supplierId: string, productName: string) => {
    return orderCheckins.has(`${orderId}-${supplierId}-${productName}`);
  }, [orderCheckins]);

  // Quantity of this order's line already refunded as "never arrived / not
  // coming" (itemArrived = false). These units are no longer expected in the
  // crate, so they come off what we check in and count towards.
  const notArrivedRefundedQty = useCallback((orderId: string, supplierId: string, productName: string) => {
    const orderRefunds = refunds.get(orderId) || [];
    return orderRefunds
      .filter(r => r.productName === productName && !r.itemArrived && (!r.supplierId || r.supplierId === supplierId))
      .reduce((sum, r) => sum + r.quantityRefunded, 0);
  }, [refunds]);

  // Total not-arrived refunded quantity for a supplier's product across the
  // day's orders. expected-to-arrive = ordered - this.
  const productRefundedQty = useCallback((supplier: SupplierSummary, productName: string) => {
    let total = 0;
    for (const orderEntry of supplier.orders) {
      if (orderEntry.items.some(i => i.productName === productName)) {
        total += notArrivedRefundedQty(orderEntry.orderId, supplier.supplierId, productName);
      }
    }
    return total;
  }, [notArrivedRefundedQty]);

  // Customers still on the hook for this product (not yet fully refunded),
  // with their remaining quantities, plus the total quantity already refunded
  // (any reason - a refunded line shouldn't be refunded twice).
  const buildAffectedOrders = useCallback((orders: Order[], supplierId: string, productName: string) => {
    const affectedOrders: StockIssue["affectedOrders"] = [];
    let totalRefundedQty = 0;
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      for (const orderItem of order.items) {
        if (orderItem.supplierId !== supplierId || orderItem.productName !== productName) continue;
        const orderRefunds = (refunds.get(order.id) || []).filter(r => r.productName === productName);
        const refundedQty = orderRefunds.reduce((sum, r) => sum + r.quantityRefunded, 0);
        totalRefundedQty += refundedQty;
        const remaining = orderItem.quantity - refundedQty;
        if (remaining > 0) {
          affectedOrders.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            quantity: remaining,
            price: orderItem.price,
          });
        }
      }
    }
    return { affectedOrders, totalRefundedQty };
  }, [refunds]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const loadTrackingData = useCallback(async (deliveryDays: string[]) => {
    const trackingMap = new Map<string, DeliveryStockTracking>();
    const checkinsMap = new Map<string, OrderItemCheckin>();
    const refundsMap = new Map<string, OrderItemRefund[]>();
    const flagsMap = new Map<string, SupplierProductFlag>();
    const completeSet = new Set<string>();

    for (const day of deliveryDays) {
      const tracking = await getDeliveryStockTracking(day);
      for (const t of tracking) {
        trackingMap.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      
      const checkins = await getOrderItemCheckins(day);
      for (const c of checkins) {
        checkinsMap.set(`${c.orderId}-${c.supplierId}-${c.productName}`, c);
      }
      
      const dayRefunds = await getRefundsForDeliveryDay(day);
      for (const r of dayRefunds) {
        const key = r.orderId;
        if (!refundsMap.has(key)) refundsMap.set(key, []);
        refundsMap.get(key)!.push(r);
      }
      
      const flags = await getSupplierProductFlags(day);
      for (const f of flags) {
        flagsMap.set(`${f.deliveryDay}-${f.supplierId}-${f.productName}`, f);
      }

      const completed = await getCompletedCheckins(day);
      for (const supplierId of completed) {
        completeSet.add(`${day}-${supplierId}`);
      }
    }
    setStockTracking(trackingMap);
    setOrderCheckins(checkinsMap);
    setRefunds(refundsMap);
    setProductFlags(flagsMap);
    setCompletedCheckins(completeSet);
  }, []);

  useEffect(() => {
    getOrders().then(async (orders) => {
      setOrderList(orders);
      const deliveryDays = [...new Set(orders.map(o => o.deliveryDay).filter(Boolean))];
      await loadTrackingData(deliveryDays);
      const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))].filter(Boolean);
      if (productIds.length > 0) {
        try {
          const res = await fetch(`/api/products?ids=${productIds.join(",")}`);
          if (res.ok) {
            const products = await res.json();
            const refMap = new Map<string, boolean>();
            for (const p of products) refMap.set(p.id, !!p.refrigerated);
            setProductRefrigerated(refMap);
          }
        } catch (e) {
          console.error("Failed to load product refrigerated flags", e);
        }
      }
    }).catch(console.error);
  }, [loadTrackingData]);

  const handleArrivalUpdate = async (
    deliveryDay: string,
    supplierId: string,
    productName: string,
    quantityOrdered: number,
    quantityArrived: number | null,
    arrivalNotes: string | null
  ) => {
    await upsertDeliveryStockTracking(deliveryDay, supplierId, productName, quantityOrdered, quantityArrived, arrivalNotes);
    const tracking = await getDeliveryStockTracking(deliveryDay);
    setStockTracking(prev => {
      const next = new Map(prev);
      for (const t of tracking) {
        next.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      return next;
    });
  };

  const handleMarkAllArrived = async (
    deliveryDay: string,
    supplier: SupplierSummary
  ) => {
    // Open flags that aren't yet covered by refunds mean some units are known
    // NOT to be coming - "mark all arrived" would contradict that and hide the
    // issue. Make Josie handle (refund/dismiss) those first.
    const uncoveredFlags = supplier.items.filter(item => {
      const flag = productFlags.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
      if (!flag || flag.resolved) return false;
      const flagQty = Math.min(flag.quantityUnavailable ?? item.quantity, item.quantity);
      return productRefundedQty(supplier, item.productName) < flagQty;
    });
    if (uncoveredFlags.length > 0) {
      alert(`These items are flagged as won't arrive and haven't been refunded yet:\n\n${uncoveredFlags.map(i => i.productName).join(", ")}\n\nReview them in the issues box first (refund or dismiss), then mark the rest arrived.`);
      return;
    }
    for (const item of supplier.items) {
      // Expected = ordered minus units already refunded as not coming.
      const expected = Math.max(0, item.quantity - productRefundedQty(supplier, item.productName));
      await upsertDeliveryStockTracking(deliveryDay, supplier.supplierId, item.productName, item.quantity, expected, null);
    }
    const tracking = await getDeliveryStockTracking(deliveryDay);
    setStockTracking(prev => {
      const next = new Map(prev);
      for (const t of tracking) {
        next.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      return next;
    });
    // Marking everything arrived in full also completes check-in for this supplier.
    await markCheckinComplete(deliveryDay, supplier.supplierId);
  };

  // Whether a supplier's check-in is marked complete for a delivery day.
  const isSupplierComplete = useCallback(
    (deliveryDay: string, supplierId: string) => completedCheckins.has(`${deliveryDay}-${supplierId}`),
    [completedCheckins]
  );

  const markCheckinComplete = async (deliveryDay: string, supplierId: string) => {
    await setCheckinComplete(deliveryDay, supplierId);
    setCompletedCheckins(prev => new Set(prev).add(`${deliveryDay}-${supplierId}`));
  };

  // "Done checking in" - completes as-is, locking in any shortages. Warns first.
  // Anything untouched counts as 0 arrived: a no-show must flag, not slip
  // through as "not checked".
  const handleDoneCheckin = async (deliveryDay: string, supplier: SupplierSummary) => {
    const shortItems: string[] = [];
    for (const item of supplier.items) {
      const t = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
      const arrived = t?.quantityArrived ?? 0;
      const expected = Math.max(0, item.quantity - productRefundedQty(supplier, item.productName));
      if (arrived < expected) shortItems.push(`${item.productName} (${arrived} of ${expected} arrived)`);
    }

    let msg = `Mark ${supplier.supplierName}'s check-in as complete?`;
    if (shortItems.length > 0) {
      msg += `\n\nShort:\n${shortItems.map(s => `• ${s}`).join("\n")}\n\nThese will be flagged as not arrived and raise refund issues for the affected customers. If something's actually here, cancel and tick it in first.`;
    } else {
      msg += `\n\nEverything has arrived in full.`;
    }
    if (!confirm(msg)) return;
    await markCheckinComplete(deliveryDay, supplier.supplierId);
  };

  // Admin "flag as won't arrive" from the top stock list - e.g. a supplier
  // texts the day before. Same flag the supplier portal creates, so it rides
  // the same issue-queue rails.
  const handleAdminFlag = async (deliveryDay: string, supplier: SupplierSummary, item: { productName: string; quantity: number }) => {
    const input = prompt(
      `How many "${item.productName}" won't arrive?\n\nOrdered: ${item.quantity}. Leave as ${item.quantity} if the whole line isn't coming.`,
      String(item.quantity)
    );
    if (input === null) return;
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty < 1 || qty > item.quantity) {
      alert(`Please enter a number between 1 and ${item.quantity}.`);
      return;
    }
    try {
      await createSupplierProductFlag(deliveryDay, supplier.supplierId, item.productName, "admin", qty >= item.quantity ? null : qty);
      const flags = await getSupplierProductFlags(deliveryDay);
      setProductFlags(prev => {
        const next = new Map(prev);
        for (const f of flags) next.set(`${f.deliveryDay}-${f.supplierId}-${f.productName}`, f);
        return next;
      });
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Failed to flag item"}`);
    }
  };

  // Undo a flag (mis-click, or the supplier found some after all). Blocked once
  // refunds have gone out against it - those aren't reversible from here.
  const handleUnflag = async (deliveryDay: string, supplier: SupplierSummary, productName: string) => {
    if (productRefundedQty(supplier, productName) > 0) {
      alert("Customers have already been refunded against this flag, so it can't be removed. Use Reopen/Review if something else needs fixing.");
      return;
    }
    if (!confirm(`Remove the "won't arrive" flag on ${productName}?`)) return;
    try {
      await removeSupplierProductFlag(deliveryDay, supplier.supplierId, productName);
      setProductFlags(prev => {
        const next = new Map(prev);
        next.delete(`${deliveryDay}-${supplier.supplierId}-${productName}`);
        return next;
      });
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Failed to remove flag"}`);
    }
  };

  const handleReopenCheckin = async (deliveryDay: string, supplierId: string) => {
    await reopenCheckin(deliveryDay, supplierId);
    setCompletedCheckins(prev => {
      const next = new Set(prev);
      next.delete(`${deliveryDay}-${supplierId}`);
      return next;
    });
  };

  const handleSendSupplierSummaries = async (deliveryDay: string) => {
    if (!confirm(`Send supplier summary emails for ${formatDeliveryDate(deliveryDay)}?`)) return;
    
    setSendingSummaries(deliveryDay);
    try {
      const response = await fetch("/api/send-supplier-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryDate: deliveryDay }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ Sent summary emails to ${data.sent} suppliers!`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Failed to send: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSendingSummaries(null);
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build issue queue for a delivery day.
  // Before check-in is complete, only flags ("won't arrive") raise issues.
  // Once complete, the actual count is ground truth: shortfall = ordered -
  // arrived, with anything untouched counting as 0 arrived. Refunded
  // quantities always count towards covering a shortfall, so handled issues
  // drop out and only the uncovered remainder shows.
  const getIssuesForDay = useCallback((deliveryDay: string, orders: Order[], supplierSummaries: SupplierSummary[]): StockIssue[] => {
    const issues: StockIssue[] = [];

    for (const supplier of supplierSummaries) {
      for (const item of supplier.items) {
        const trackingKey = `${deliveryDay}-${supplier.supplierId}-${item.productName}`;
        const tracking = stockTracking.get(trackingKey);
        const flag = productFlags.get(trackingKey);

        // A resolved flag = dismissed for the day. Skip so it doesn't reappear.
        if (flag && flag.resolved) continue;

        const isFlagged = !!(flag && !flag.resolved);
        const supplierComplete = isSupplierComplete(deliveryDay, supplier.supplierId);
        const arrived = tracking?.quantityArrived ?? 0;

        let shortfall: number;
        if (supplierComplete) {
          // Counted: the real gap, whatever flags said.
          shortfall = item.quantity - arrived;
        } else if (isFlagged) {
          // Not counted yet, but flagged ahead of time (supplier portal or
          // admin). Partial quantity if recorded, whole line otherwise.
          shortfall = Math.min(flag!.quantityUnavailable ?? item.quantity, item.quantity);
        } else {
          // Still checking in - low counts aren't shortages yet.
          continue;
        }
        if (shortfall <= 0) continue;

        const { affectedOrders, totalRefundedQty } = buildAffectedOrders(orders, supplier.supplierId, item.productName);

        // Issue is handled once refunds cover the shortfall
        if (totalRefundedQty >= shortfall) continue;
        if (affectedOrders.length === 0) continue;

        issues.push({
          type: isFlagged ? "flagged" : "shortage",
          deliveryDay,
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          productName: item.productName,
          // Show the uncovered remainder, not the original gap.
          shortfall: shortfall - totalRefundedQty,
          orderedQty: item.quantity,
          arrivedQty: supplierComplete ? arrived : (tracking?.quantityArrived ?? null),
          affectedOrders,
        });
      }
    }

    return issues;
  }, [stockTracking, productFlags, isSupplierComplete, buildAffectedOrders]);

  // Handle opening the review modal for an issue
  const openReviewModal = (issue: StockIssue) => {
    setReviewModal({
      issue,
      selectedQtys: new Map(),
      reasonType: "didnt_arrive",
      paidBy: "supplier",
      notes: "",
    });
    setRefundError(null);
  };

  // "Missing" straight from a customer's bag row: same review modal, scoped to
  // this product with that customer pre-selected at their remaining quantity.
  const openMissingModal = (deliveryDay: string, supplier: SupplierSummary, orders: Order[], orderId: string, productName: string, remainingQty: number) => {
    const { affectedOrders } = buildAffectedOrders(orders, supplier.supplierId, productName);
    if (affectedOrders.length === 0) return;
    const tracking = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${productName}`);
    const ordered = supplier.items.find(i => i.productName === productName)?.quantity ?? remainingQty;
    setReviewModal({
      issue: {
        type: "shortage",
        deliveryDay,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        productName,
        shortfall: remainingQty,
        orderedQty: ordered,
        arrivedQty: tracking?.quantityArrived ?? null,
        affectedOrders,
      },
      selectedQtys: new Map([[orderId, remainingQty]]),
      reasonType: "didnt_arrive",
      paidBy: "supplier",
      notes: "",
    });
    setRefundError(null);
  };

  // Handle refunding selected orders
  const handleRefundSelected = async () => {
    if (!reviewModal || reviewModal.selectedQtys.size === 0) return;

    setRefundLoading(true);
    setRefundError(null);

    const { issue, selectedQtys, reasonType, paidBy, notes } = reviewModal;
    const reasonConfig = refundReasonConfig[reasonType];

    try {
      for (const [orderId, qty] of selectedQtys) {
        const orderInfo = issue.affectedOrders.find(o => o.orderId === orderId);
        if (!orderInfo) continue;

        const quantity = Math.min(qty, orderInfo.quantity);
        const refundAmount = quantity * orderInfo.price;

        const response = await fetch("/api/refund-order-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            productName: issue.productName,
            quantity,
            refundAmount,
            reasonType,
            refundReason: notes || null,
            itemArrived: reasonConfig.itemArrived,
            paidBy,
            supplierId: issue.supplierId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to process refund");
        }
      }

      // Flags are NOT auto-resolved here: the queue clears via the refunded
      // quantities, the row shows "handled", and if check-in later reveals the
      // line even shorter than flagged, the remainder still surfaces.
      // (Resolved is reserved for explicit dismissals.)

      // Reload data to reflect changes
      const deliveryDays = [...new Set(orderList.map(o => o.deliveryDay).filter(Boolean))];
      await loadTrackingData(deliveryDays);

      setReviewModal(null);
      alert(`✅ Refunded ${selectedQtys.size} order${selectedQtys.size !== 1 ? "s" : ""}`);
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : "Failed to process refunds");
    } finally {
      setRefundLoading(false);
    }
  };

  // Handle dismissing an issue without refunding
  const handleDismissIssue = async (issue: StockIssue) => {
    if (!confirm(`Dismiss this issue without issuing refunds?\n\n${issue.productName} from ${issue.supplierName}\n\nThis will clear the issue from the queue.`)) {
      return;
    }
    
    try {
      if (issue.type === "flagged") {
        // Resolve the supplier flag
        await resolveSupplierProductFlag(issue.deliveryDay, issue.supplierId, issue.productName);
      } else {
        // For shortages, create a resolved flag to mark as dismissed
        await createSupplierProductFlag(issue.deliveryDay, issue.supplierId, issue.productName, "admin");
        await resolveSupplierProductFlag(issue.deliveryDay, issue.supplierId, issue.productName);
      }
      
      // Reload data to reflect changes
      const deliveryDays = [...new Set(orderList.map(o => o.deliveryDay).filter(Boolean))];
      await loadTrackingData(deliveryDays);
      
      alert("✅ Issue dismissed");
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Failed to dismiss issue"}`);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of orderList) {
      const key = order.deliveryDay || "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "unassigned") return 1;
      if (b === "unassigned") return -1;
      const aUp = isUpcoming(a);
      const bUp = isUpcoming(b);
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      if (aUp && bUp) return a.localeCompare(b);
      return b.localeCompare(a);
    });
  }, [orderList]);

  useEffect(() => {
    if (orderList.length > 0) {
      const past = new Set<string>();
      for (const [key] of grouped) {
        if (!isUpcoming(key) && key !== "unassigned") past.add(key);
      }
      setCollapsed(past);
    }
  }, [orderList.length, grouped]);

  // Calculate stock and bags pills for a supplier
  const getSupplierPills = (deliveryDay: string, supplier: SupplierSummary) => {
    // Stock: X/Y where Y = distinct products, X = products where arrived covers
    // what's still expected (ordered minus not-coming refunds)
    const distinctProducts = supplier.items.length;
    let arrivedProducts = 0;
    let hasAnyArrival = false;
    for (const item of supplier.items) {
      const tracking = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
      const expected = Math.max(0, item.quantity - productRefundedQty(supplier, item.productName));
      if (tracking?.quantityArrived !== null && tracking?.quantityArrived !== undefined) {
        hasAnyArrival = true;
        if (tracking.quantityArrived >= expected) {
          arrivedProducts++;
        }
      } else if (expected === 0) {
        // Whole line refunded out - nothing left to count for it.
        arrivedProducts++;
      }
    }

    // Bags: X/Y where Y = order-line-items still expected (fully-refunded lines
    // drop out - they can't be ticked), X = checked in
    let totalBagItems = 0;
    let checkedInBagItems = 0;
    for (const orderEntry of supplier.orders) {
      for (const item of orderEntry.items) {
        const remaining = item.quantity - notArrivedRefundedQty(orderEntry.orderId, supplier.supplierId, item.productName);
        if (remaining <= 0) continue;
        totalBagItems++;
        if (isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, item.productName)) {
          checkedInBagItems++;
        }
      }
    }

    return {
      stock: { arrived: arrivedProducts, total: distinctProducts, hasAnyArrival },
      bags: { checkedIn: checkedInBagItems, total: totalBagItems },
    };
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary">Stock Management</h1>
      <p className="mt-1 text-muted">Supplier stock arrivals and per-customer bag check-in</p>

      {grouped.map(([deliveryDay, orders]) => {
        const upcoming = isUpcoming(deliveryDay);
        const isOpen = !collapsed.has(deliveryDay);
        const total = orders.reduce((sum, o) => sum + o.total, 0);
        const supplierSummaries = getSupplierSummaries(orders, productRefrigerated);

        return (
          <div key={deliveryDay} className="mt-8">
            <button
              onClick={() => toggleCollapse(deliveryDay)}
              className="flex w-full items-center gap-2 mb-4 text-left"
            >
              {isOpen ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} className="text-muted" />}
              <Calendar size={18} className={upcoming ? "text-secondary" : "text-muted"} />
              <h2 className={`text-lg font-bold ${upcoming ? "text-primary" : "text-muted"}`}>
                {deliveryDay === "unassigned" ? "No Delivery Date" : formatDeliveryDate(deliveryDay)}
              </h2>
              {upcoming && (
                <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase">Upcoming</span>
              )}
              <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {orders.length} order{orders.length !== 1 ? "s" : ""} · £{total.toFixed(2)}
              </span>
            </button>

            {isOpen && (
              <div className="space-y-6">
                {/* ISSUE QUEUE */}
                {(() => {
                  const issues = getIssuesForDay(deliveryDay, orders, supplierSummaries);
                  const dayRefunds = orders.flatMap(o => refunds.get(o.id) || []);
                  const totalRefunds = dayRefunds.reduce((sum, r) => sum + r.refundAmount, 0);

                  if (issues.length === 0 && totalRefunds === 0) return null;

                  return (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 overflow-hidden">
                      <div className="px-6 py-3 border-b border-amber-200 flex items-center justify-between">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2">
                          <AlertTriangle size={18} />
                          Issues Requiring Action
                          {issues.length > 0 && (
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                              {issues.length}
                            </span>
                          )}
                        </h3>
                        {totalRefunds > 0 && (
                          <span className="text-xs text-amber-700">
                            {dayRefunds.length} refund{dayRefunds.length !== 1 ? "s" : ""} issued · £{totalRefunds.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {issues.length > 0 && (
                        <div className="divide-y divide-amber-200">
                          {issues.map((issue, i) => (
                            <div key={i} className="px-6 py-3 flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    issue.type === "flagged" 
                                      ? "bg-red-100 text-red-700" 
                                      : "bg-amber-200 text-amber-800"
                                  }`}>
                                    {issue.type === "flagged" && issue.shortfall >= issue.orderedQty ? "Won't arrive" : `Short by ${issue.shortfall}`}
                                  </span>
                                  <span className="font-medium text-amber-900">{issue.productName}</span>
                                  <span className="text-xs text-amber-700">from {issue.supplierName}</span>
                                </div>
                                <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                                  <Users size={12} />
                                  {issue.affectedOrders.length} customer{issue.affectedOrders.length !== 1 ? "s" : ""} affected
                                  {issue.arrivedQty !== null && (
                                    <span className="ml-2">· {issue.arrivedQty}/{issue.orderedQty} arrived</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => openReviewModal(issue)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-300 transition"
                                >
                                  <Eye size={14} />
                                  Review
                                </button>
                                <button
                                  onClick={() => handleDismissIssue(issue)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition"
                                  title="Dismiss without refunding"
                                >
                                  <XCircle size={14} />
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* REFUNDS THIS WEEK */}
                {(() => {
                  const dayRefunds = orders.flatMap(o => (refunds.get(o.id) || []).map(r => ({ refund: r, order: o })));
                  if (dayRefunds.length === 0) return null;
                  const totalRefunds = dayRefunds.reduce((sum, { refund }) => sum + refund.refundAmount, 0);
                  const isRefundsOpen = expandedRefunds.has(deliveryDay);

                  // Group by supplier (falling back to the order line's supplier name)
                  const bySupplier = new Map<string, { supplierName: string; rows: typeof dayRefunds; total: number }>();
                  for (const entry of dayRefunds) {
                    const supplierId = entry.refund.supplierId || "unknown";
                    if (!bySupplier.has(supplierId)) {
                      const name = supplierSummaries.find(s => s.supplierId === supplierId)?.supplierName
                        ?? entry.order.items.find(i => i.supplierId === supplierId)?.supplierName
                        ?? "Unknown supplier";
                      bySupplier.set(supplierId, { supplierName: name, rows: [], total: 0 });
                    }
                    const group = bySupplier.get(supplierId)!;
                    group.rows.push(entry);
                    group.total += entry.refund.refundAmount;
                  }
                  const groups = Array.from(bySupplier.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
                  const paidByLabel = (p: RefundPaidBy) => p === "supplier" ? "Supplier pays" : p === "50-50" ? "50-50" : "Local pays";

                  return (
                    <div className="rounded-xl bg-surface shadow-sm overflow-hidden">
                      <button
                        onClick={() => setExpandedRefunds(prev => {
                          const next = new Set(prev);
                          if (next.has(deliveryDay)) next.delete(deliveryDay);
                          else next.add(deliveryDay);
                          return next;
                        })}
                        className="flex w-full items-center justify-between px-3 sm:px-6 py-3 sm:py-4 text-left hover:bg-primary/5 transition"
                      >
                        <div className="flex items-center gap-2">
                          {isRefundsOpen ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                          <PoundSterling size={18} className="text-red-500" />
                          <h3 className="font-bold text-primary">Refunds</h3>
                          <span className="text-xs text-muted">({dayRefunds.length})</span>
                        </div>
                        <span className="font-semibold text-red-600">£{totalRefunds.toFixed(2)}</span>
                      </button>
                      {isRefundsOpen && (
                        <div className="divide-y divide-primary/5 border-t border-primary/5">
                          {groups.map((group) => (
                            <div key={group.supplierName}>
                              <div className="px-3 sm:px-6 py-2 bg-primary/5 flex items-center justify-between">
                                <span className="text-sm font-semibold text-primary">{group.supplierName}</span>
                                <span className="text-sm font-semibold text-red-600">£{group.total.toFixed(2)}</span>
                              </div>
                              {group.rows.map(({ refund, order }) => (
                                <div key={refund.id} className="px-3 sm:px-6 py-2 flex items-start justify-between gap-3 text-sm">
                                  <div className="min-w-0">
                                    <p className="text-primary">
                                      {refund.productName}
                                      <span className="text-muted"> × {refund.quantityRefunded}</span>
                                    </p>
                                    <p className="text-xs text-muted">
                                      #{order.orderNumber} · {order.customerName || order.customerEmail?.split("@")[0] || "Customer"}
                                      {" · "}{refundReasonConfig[refund.reasonType]?.label || refund.reasonType}
                                      {refund.refundReason && <span> - {refund.refundReason}</span>}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <p className="font-medium text-red-600">£{refund.refundAmount.toFixed(2)}</p>
                                    <p className={`text-[10px] font-semibold ${refund.paidBy === "local" ? "text-muted" : "text-amber-700"}`}>{paidByLabel(refund.paidBy)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* SUPPLIERS SECTION */}
                <div className="rounded-xl bg-surface shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-primary/5 px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2">
                      <Truck size={18} className="text-secondary" />
                      <h3 className="font-bold text-primary">Suppliers</h3>
                      <span className="text-xs text-muted">({supplierSummaries.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendSupplierSummaries(deliveryDay)}
                        disabled={sendingSummaries === deliveryDay}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/30 transition disabled:opacity-50"
                      >
                        <Send size={14} />
                        {sendingSummaries === deliveryDay ? "Sending..." : "Send Summaries"}
                      </button>
                      <button
                        onClick={() => setPayoutModal(deliveryDay)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                      >
                        <FileText size={14} />
                        Supplier Payouts
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-primary/5">
                    {supplierSummaries.map((supplier) => {
                      const key = `supplier-${deliveryDay}-${supplier.supplierId}`;
                      const isExpanded = expandedSuppliers.has(key);
                      const pills = getSupplierPills(deliveryDay, supplier);

                      // One progress pill covering every check-in job for this
                      // supplier: product arrivals + per-customer bag ticks.
                      // Green = all done, amber = started, grey = not started.
                      const checkedIn = pills.stock.arrived + pills.bags.checkedIn;
                      const checkInTotal = pills.stock.total + pills.bags.total;
                      const started = pills.stock.hasAnyArrival || pills.bags.checkedIn > 0;
                      const checkInPillClass = checkedIn === checkInTotal && checkInTotal > 0
                        ? "bg-green-100 text-green-700"
                        : started
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600";

                      return (
                        <div key={supplier.supplierId}>
                          <button
                            onClick={() => toggleExpand(key)}
                            className="flex w-full items-center justify-between px-3 sm:px-6 py-3 text-left hover:bg-primary/5 transition"
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              {isExpanded ? <ChevronDown size={16} className="text-muted flex-shrink-0" /> : <ChevronRight size={16} className="text-muted flex-shrink-0" />}
                              <span className="font-medium text-primary truncate">{supplier.supplierName}</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-sm flex-shrink-0">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${checkInPillClass}`}>
                                Checked in {checkedIn}/{checkInTotal}
                              </span>
                              <span className="font-semibold text-primary">£{supplier.totalPrice.toFixed(2)}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="bg-primary/5 px-3 sm:px-6 py-4 space-y-4">
                              {/* STOCK ARRIVALS */}
                              <div className="rounded-lg border border-primary/10 bg-surface overflow-x-auto">
                                <div className="px-3 py-2 border-b border-primary/10 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-muted uppercase">Stock Arrivals</span>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    {isSupplierComplete(deliveryDay, supplier.supplierId) ? (
                                      <>
                                        <span className="text-xs font-semibold text-green-600">✓ Check-in complete</span>
                                        <button
                                          onClick={() => handleReopenCheckin(deliveryDay, supplier.supplierId)}
                                          className="rounded border border-primary/10 px-3 py-2 sm:border-0 sm:px-0 sm:py-0 text-xs font-medium text-muted hover:text-primary transition"
                                        >
                                          Reopen
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleMarkAllArrived(deliveryDay, supplier)}
                                          className="rounded border border-primary/10 px-3 py-2 sm:border-0 sm:px-0 sm:py-0 text-xs font-medium text-secondary hover:text-secondary/80 transition"
                                        >
                                          Mark all arrived
                                        </button>
                                        <button
                                          onClick={() => handleDoneCheckin(deliveryDay, supplier)}
                                          className="rounded border border-green-200 px-3 py-2 sm:border-0 sm:px-0 sm:py-0 text-xs font-semibold text-green-600 hover:text-green-700 transition"
                                        >
                                          Done checking in
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {/* Mobile card view */}
                                <div className="sm:hidden space-y-3 p-3">
                                  {supplier.items.map((item) => {
                                    const trackingKey = `${deliveryDay}-${supplier.supplierId}-${item.productName}`;
                                    const tracking = stockTracking.get(trackingKey);
                                    const flag = productFlags.get(trackingKey);
                                    const isFlagged = !!(flag && !flag.resolved);
                                    const arrived = tracking?.quantityArrived ?? 0;
                                    const hasOverride = tracking?.quantityArrivedOverride !== null && tracking?.quantityArrivedOverride !== undefined;
                                    const computedDiffers = hasOverride && tracking?.quantityArrivedComputed !== tracking?.quantityArrivedOverride;
                                    const supplierComplete = isSupplierComplete(deliveryDay, supplier.supplierId);
                                    const refunded = productRefundedQty(supplier, item.productName);
                                    const expected = Math.max(0, item.quantity - refunded);
                                    const flagQty = isFlagged ? Math.min(flag!.quantityUnavailable ?? item.quantity, item.quantity) : 0;
                                    const flagCovered = isFlagged && refunded >= flagQty;
                                    const flagOpen = isFlagged && !flagCovered;
                                    const hasShortage = supplierComplete && arrived < expected;
                                    const isComplete = supplierComplete && arrived >= expected;
                                    const affectsList = supplier.orders
                                      .filter(o => o.items.some(i => i.productName === item.productName))
                                      .map(o => o.boxNumber != null ? `Box ${o.boxNumber}` : `#${o.orderNumber}`)
                                      .join(", ");

                                    return (
                                      <div key={`${item.productName}|${item.unit}`} className={`rounded-xl border border-primary/10 bg-surface p-3 shadow-sm ${flagOpen ? 'bg-red-50' : isComplete ? 'bg-green-50' : hasShortage ? 'bg-amber-50' : item.refrigerated ? chilledRowClass : ''}`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-primary">{item.productName}</span>
                                          {item.refrigerated && <ChilledTag />}
                                          {flagOpen && (
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">
                                              {flagQty >= item.quantity ? "Won't arrive" : `${flagQty} of ${item.quantity} won't arrive`}
                                            </span>
                                          )}
                                        </div>
                                        {item.unit && <span className="block text-xs text-muted">{item.unit}</span>}
                                        <div className="mt-2 flex items-center justify-between text-sm">
                                          <span className="text-muted">Ordered</span>
                                          <span className="font-semibold text-primary">
                                            {item.quantity}
                                            {refunded > 0 && <span className="ml-1 text-xs font-normal text-muted">({refunded} refunded, expect {expected})</span>}
                                          </span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-sm">
                                          <span className="text-muted">Arrived</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="0"
                                              max={item.quantity * 2}
                                              value={arrived}
                                              disabled={flagOpen}
                                              onChange={(e) => {
                                                const val = e.target.value === "" ? null : parseInt(e.target.value);
                                                handleArrivalUpdate(deliveryDay, supplier.supplierId, item.productName, item.quantity, val, tracking?.arrivalNotes ?? null);
                                              }}
                                              className={`w-20 min-h-[44px] rounded border border-primary/20 px-2 py-1 text-center text-sm focus:border-secondary focus:outline-none ${flagOpen ? 'bg-gray-100 text-gray-400' : ''}`}
                                            />
                                            {computedDiffers && (
                                              <span className="text-[10px] text-amber-600" title={`Computed from check-ins: ${tracking?.quantityArrivedComputed}`}>(override)</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                                          <div className="min-w-0">
                                          {flagOpen ? (
                                            <div>
                                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                                                <XCircle size={12} />
                                                Flagged by {flag!.flaggedBy === "admin" ? "you" : "supplier"}
                                              </span>
                                              <p className="text-[10px] text-red-600 mt-0.5">Affects: {affectsList}</p>
                                            </div>
                                          ) : flagCovered && !supplierComplete ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                              <CheckCircle size={12} />
                                              Flag handled ({refunded} refunded) · checking in ({arrived}/{expected})
                                            </span>
                                          ) : !supplierComplete ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                                              <Clock size={12} />
                                              Checking in ({arrived}/{expected})
                                              {refunded > 0 && <span className="text-muted">· {refunded} refunded</span>}
                                            </span>
                                          ) : hasShortage ? (
                                            <div>
                                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                                <AlertTriangle size={12} />
                                                Short by {expected - arrived}
                                              </span>
                                              <p className="text-[10px] text-amber-600 mt-0.5">Affects: {affectsList}</p>
                                            </div>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                              <CheckCircle size={12} />
                                              Complete{refunded > 0 && <span className="font-normal text-muted"> · {refunded} refunded</span>}
                                            </span>
                                          )}
                                          </div>
                                          {flagOpen ? (
                                            <button
                                              onClick={() => handleUnflag(deliveryDay, supplier, item.productName)}
                                              className="flex-shrink-0 rounded border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 transition"
                                            >
                                              Unflag
                                            </button>
                                          ) : !isFlagged && !supplierComplete ? (
                                            <button
                                              onClick={() => handleAdminFlag(deliveryDay, supplier, item)}
                                              title="Flag as won't arrive"
                                              className="flex-shrink-0 inline-flex items-center gap-1 rounded border border-primary/10 px-2 py-1 text-[10px] font-medium text-muted hover:text-red-600 hover:border-red-200 transition"
                                            >
                                              <Flag size={11} />
                                              Flag
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <table className="hidden sm:table w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs text-muted border-b border-primary/5">
                                      <th className="px-3 py-2 font-medium">Product</th>
                                      <th className="px-3 py-2 font-medium text-center">Ordered</th>
                                      <th className="px-3 py-2 font-medium text-center">Arrived</th>
                                      <th className="px-3 py-2 font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {supplier.items.map((item) => {
                                      const trackingKey = `${deliveryDay}-${supplier.supplierId}-${item.productName}`;
                                      const tracking = stockTracking.get(trackingKey);
                                      const flag = productFlags.get(trackingKey);
                                      const isFlagged = !!(flag && !flag.resolved);
                                      const arrived = tracking?.quantityArrived ?? 0;
                                      const hasOverride = tracking?.quantityArrivedOverride !== null && tracking?.quantityArrivedOverride !== undefined;
                                      const computedDiffers = hasOverride && tracking?.quantityArrivedComputed !== tracking?.quantityArrivedOverride;
                                      const supplierComplete = isSupplierComplete(deliveryDay, supplier.supplierId);
                                      const refunded = productRefundedQty(supplier, item.productName);
                                      const expected = Math.max(0, item.quantity - refunded);
                                      const flagQty = isFlagged ? Math.min(flag!.quantityUnavailable ?? item.quantity, item.quantity) : 0;
                                      const flagCovered = isFlagged && refunded >= flagQty;
                                      const flagOpen = isFlagged && !flagCovered;
                                      // Only a genuine shortage once check-in is marked complete.
                                      const hasShortage = supplierComplete && arrived < expected;
                                      const isComplete = supplierComplete && arrived >= expected;
                                      const affectsList = supplier.orders
                                        .filter(o => o.items.some(i => i.productName === item.productName))
                                        .map(o => o.boxNumber != null ? `Box ${o.boxNumber}` : `#${o.orderNumber}`)
                                        .join(", ");

                                      return (
                                        <tr key={`${item.productName}|${item.unit}`} className={`border-t border-primary/5 ${flagOpen ? 'bg-red-50' : isComplete ? 'bg-green-50' : hasShortage ? 'bg-amber-50' : item.refrigerated ? chilledRowClass : ''}`}>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-primary">{item.productName}</span>
                                              {item.refrigerated && <ChilledTag />}
                                              {flagOpen && (
                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">
                                                  {flagQty >= item.quantity ? "Won't arrive" : `${flagQty} of ${item.quantity} won't arrive`}
                                                </span>
                                              )}
                                            </div>
                                            {item.unit && <span className="block text-xs text-muted">{item.unit}</span>}
                                          </td>
                                          <td className="px-3 py-2 text-center font-semibold text-primary">
                                            {item.quantity}
                                            {refunded > 0 && <span className="block text-[10px] font-normal text-muted">{refunded} refunded · expect {expected}</span>}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={item.quantity * 2}
                                                value={arrived}
                                                disabled={flagOpen}
                                                onChange={(e) => {
                                                  const val = e.target.value === "" ? null : parseInt(e.target.value);
                                                  handleArrivalUpdate(deliveryDay, supplier.supplierId, item.productName, item.quantity, val, tracking?.arrivalNotes ?? null);
                                                }}
                                                className={`w-16 rounded border border-primary/20 px-2 py-1 text-center text-sm focus:border-secondary focus:outline-none ${flagOpen ? 'bg-gray-100 text-gray-400' : ''}`}
                                              />
                                              {computedDiffers && (
                                                <span className="text-[10px] text-amber-600" title={`Computed from check-ins: ${tracking?.quantityArrivedComputed}`}>(override)</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="min-w-0">
                                              {flagOpen ? (
                                                <div>
                                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                                                    <XCircle size={12} />
                                                    Flagged by {flag!.flaggedBy === "admin" ? "you" : "supplier"}
                                                  </span>
                                                  <p className="text-[10px] text-red-600 mt-0.5">Affects: {affectsList}</p>
                                                </div>
                                              ) : flagCovered && !supplierComplete ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                                  <CheckCircle size={12} />
                                                  Flag handled ({refunded} refunded) · checking in ({arrived}/{expected})
                                                </span>
                                              ) : !supplierComplete ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                                                  <Clock size={12} />
                                                  Checking in ({arrived}/{expected})
                                                  {refunded > 0 && <span>· {refunded} refunded</span>}
                                                </span>
                                              ) : hasShortage ? (
                                                <div>
                                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                                    <AlertTriangle size={12} />
                                                    Short by {expected - arrived}
                                                  </span>
                                                  <p className="text-[10px] text-amber-600 mt-0.5">Affects: {affectsList}</p>
                                                </div>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                                  <CheckCircle size={12} />
                                                  Complete{refunded > 0 && <span className="font-normal text-muted"> · {refunded} refunded</span>}
                                                </span>
                                              )}
                                              </div>
                                              {flagOpen ? (
                                                <button
                                                  onClick={() => handleUnflag(deliveryDay, supplier, item.productName)}
                                                  className="flex-shrink-0 rounded border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 transition"
                                                >
                                                  Unflag
                                                </button>
                                              ) : !isFlagged && !supplierComplete ? (
                                                <button
                                                  onClick={() => handleAdminFlag(deliveryDay, supplier, item)}
                                                  title="Flag as won't arrive (e.g. supplier told you separately)"
                                                  className="flex-shrink-0 inline-flex items-center gap-1 rounded border border-primary/10 px-2 py-0.5 text-[10px] font-medium text-muted hover:text-red-600 hover:border-red-200 transition"
                                                >
                                                  <Flag size={11} />
                                                  Flag
                                                </button>
                                              ) : null}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* ORDER CHECK-IN */}
                              {(() => {
                                // "Packable" = still expected in the crate: line quantity minus
                                // any not-coming refunds. Fully-refunded lines grey out.
                                const itemRemaining = (orderEntry: SupplierOrderItems, item: { productName: string; quantity: number }) =>
                                  item.quantity - notArrivedRefundedQty(orderEntry.orderId, supplier.supplierId, item.productName);
                                const allBagsChecked = supplier.orders.every(o => o.items.every(item =>
                                  itemRemaining(o, item) <= 0 || isOrderItemCheckedIn(o.orderId, supplier.supplierId, item.productName)
                                ));
                                return (
                              <div className={`rounded-lg border ${allBagsChecked ? 'border-green-300 bg-green-50' : 'border-primary/10 bg-surface'} overflow-hidden`}>
                                <div className="px-3 py-2 border-b border-primary/10 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted uppercase">Order Check-in (per-customer bags)</span>
                                  {allBagsChecked && (
                                    <span className="text-xs font-semibold text-green-600">✓ Complete</span>
                                  )}
                                </div>
                                <div className="divide-y divide-primary/5">
                                  {supplier.orders.map((orderEntry) => {
                                    const allItemsChecked = orderEntry.items.every(item =>
                                      itemRemaining(orderEntry, item) <= 0 ||
                                      isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, item.productName)
                                    );
                                    return (
                                      <div key={orderEntry.orderId} className={`${allItemsChecked ? 'bg-green-50' : ''}`}>
                                        <div className="px-3 py-2 flex items-center justify-between">
                                          <span className={`font-medium ${allItemsChecked ? 'text-green-700' : 'text-primary'}`}>
                                            {orderEntry.boxNumber != null ? `Box ${orderEntry.boxNumber}` : `Order #${orderEntry.orderNumber}`}
                                            <span className="ml-1 text-xs font-normal text-muted">#{orderEntry.orderNumber}</span>
                                          </span>
                                          {allItemsChecked && <span className="text-xs text-green-600">✓</span>}
                                        </div>
                                        <div className="px-3 pb-2 space-y-1">
                                          {orderEntry.items.map((item, i) => {
                                            const isItemChecked = isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, item.productName);
                                            const refundedQty = notArrivedRefundedQty(orderEntry.orderId, supplier.supplierId, item.productName);
                                            const remaining = item.quantity - refundedQty;
                                            if (remaining <= 0) {
                                              return (
                                                <div key={i} className="flex items-center gap-2 pl-2 opacity-60">
                                                  <XCircle size={18} className="text-red-300 flex-shrink-0" />
                                                  <span className="text-sm text-red-400 line-through">
                                                    {formatItemLine(item.productName, item.unit, item.quantity)}
                                                  </span>
                                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Refunded</span>
                                                </div>
                                              );
                                            }
                                            return (
                                              <div key={i} className="flex items-center gap-2 pl-2">
                                                <label className="flex flex-1 items-center gap-2 cursor-pointer min-w-0">
                                                  <input
                                                    type="checkbox"
                                                    checked={isItemChecked}
                                                    onChange={() => handleOrderCheckIn(deliveryDay, supplier.supplierId, orderEntry.orderId, item.productName, remaining)}
                                                    className="h-5 w-5 rounded border-primary/30 text-green-600 focus:ring-green-500"
                                                  />
                                                  <span className={`text-sm ${isItemChecked ? 'text-green-600 line-through' : 'text-muted'}`}>
                                                    {formatItemLine(item.productName, item.unit, remaining)}
                                                    {refundedQty > 0 && <span className="ml-1 text-xs text-red-500">({refundedQty} refunded)</span>}
                                                  </span>
                                                  {item.refrigerated && <ChilledTag />}
                                                </label>
                                                {!isItemChecked && (
                                                  <button
                                                    onClick={() => openMissingModal(deliveryDay, supplier, orders, orderEntry.orderId, item.productName, remaining)}
                                                    title="Not in the crate - flag for refund"
                                                    className="flex-shrink-0 inline-flex items-center gap-1 rounded border border-primary/10 px-2 py-0.5 text-[10px] font-medium text-muted hover:text-red-600 hover:border-red-200 transition"
                                                  >
                                                    <XCircle size={11} />
                                                    Missing
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Supplier Payout Modal */}
      {payoutModal && (() => {
        const dayOrders = orderList.filter(o => o.deliveryDay === payoutModal);
        const daySummaries = getSupplierSummaries(dayOrders);
        const dayRefunds = dayOrders.flatMap(o => refunds.get(o.id) || []);
        
        const payouts = daySummaries.map(supplier => {
          const supplierTracking: Array<{ productName: string; ordered: number; arrived: number | null; price: number; orderedValue: number; arrivedValue: number }> = [];
          for (const item of supplier.items) {
            const tracking = stockTracking.get(`${payoutModal}-${supplier.supplierId}-${item.productName}`);
            const arrived = tracking?.quantityArrived ?? null;
            supplierTracking.push({
              productName: item.productName,
              ordered: item.quantity,
              arrived,
              price: item.price,
              orderedValue: item.quantity * item.price,
              arrivedValue: (arrived ?? 0) * item.price,
            });
          }
          
          const supplierRefunds = dayRefunds.filter(r => r.supplierId === supplier.supplierId);
          
          let supplierRefundDeduction = 0;
          for (const refund of supplierRefunds) {
            if (refund.paidBy === "local") continue;
            if (!refund.itemArrived) continue;
            const deduction = refund.paidBy === "supplier" ? refund.refundAmount : refund.refundAmount / 2;
            supplierRefundDeduction += deduction;
          }
          
          const orderedTotal = supplierTracking.reduce((sum, item) => sum + item.orderedValue, 0);
          const arrivedTotal = supplierTracking.reduce((sum, item) => sum + item.arrivedValue, 0);
          const payout = Math.max(0, (arrivedTotal - supplierRefundDeduction) * 0.8);
          // Zero-default check-in: no recorded arrivals means every line counts
          // as 0 and the payout is £0 - flagged below so it can't slip through.
          const hasAnyArrival = supplierTracking.some(t => t.arrived !== null);

          return {
            ...supplier,
            tracking: supplierTracking,
            supplierRefunds,
            supplierRefundDeduction,
            orderedTotal,
            arrivedTotal,
            payout,
            hasAnyArrival,
          };
        });

        const totalPayout = payouts.reduce((sum, p) => sum + p.payout, 0);
        const uncheckedSuppliers = payouts.filter(p => !p.hasAnyArrival);
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPayoutModal(null)}>
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary">Supplier Payouts</h3>
                  <p className="text-sm text-muted">{formatDeliveryDate(payoutModal)}</p>
                </div>
                <button onClick={() => setPayoutModal(null)} className="text-muted hover:text-primary">
                  <XCircle size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-6">
                  {payouts.map((supplier) => (
                    <div key={supplier.supplierId} className="rounded-lg border border-primary/10 overflow-hidden">
                      <div className="px-4 py-3 bg-primary/5 flex items-center justify-between">
                        <span className="font-semibold text-primary">{supplier.supplierName}</span>
                        <span className={`font-bold ${supplier.payout > 0 ? 'text-green-600' : 'text-muted'}`}>
                          Payout: £{supplier.payout.toFixed(2)}
                        </span>
                      </div>
                      {/* Mobile card view */}
                      <div className="sm:hidden space-y-3 p-3">
                        {supplier.tracking.map((item) => {
                          const arrived = item.arrived ?? 0;
                          const value = arrived * item.price;
                          const isShort = arrived < item.ordered;
                          return (
                            <div key={item.productName} className={`rounded-xl border border-primary/10 bg-surface p-3 shadow-sm ${isShort ? 'bg-amber-50' : ''}`}>
                              <p className="font-bold text-primary">{item.productName}</p>
                              <div className="mt-2 space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-muted">Ordered</span><span className="text-primary">{item.ordered}</span></div>
                                <div className="flex justify-between"><span className="text-muted">Arrived</span><span className={`font-medium ${isShort ? 'text-amber-600' : 'text-green-600'}`}>{item.arrived ?? 0}</span></div>
                                <div className="flex justify-between"><span className="text-muted">Unit Price</span><span className="text-muted">£{item.price.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-muted">Value</span><span className="font-medium text-primary">£{value.toFixed(2)}</span></div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 text-sm space-y-1">
                          <div className="flex justify-between"><span className="text-muted">Ordered Total</span><span className="text-muted">£{supplier.orderedTotal.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Arrived at Depot</span><span className="font-semibold text-primary">£{supplier.arrivedTotal.toFixed(2)}</span></div>
                          {supplier.supplierRefundDeduction > 0 && (
                            <div className="flex justify-between"><span className="text-red-600">Refunded by Supplier</span><span className="font-semibold text-red-600">-£{supplier.supplierRefundDeduction.toFixed(2)}</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-muted">Total Before Commission</span><span className="font-semibold text-primary">£{(supplier.arrivedTotal - supplier.supplierRefundDeduction).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Commission (20%)</span><span className="text-muted">-£{((supplier.arrivedTotal - supplier.supplierRefundDeduction) * 0.2).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="font-bold text-primary">Payout</span><span className="font-bold text-green-600">£{supplier.payout.toFixed(2)}</span></div>
                        </div>
                      </div>
                      <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted border-b border-primary/5">
                            <th className="px-4 py-2 font-medium">Product</th>
                            <th className="px-4 py-2 font-medium text-center">Ordered</th>
                            <th className="px-4 py-2 font-medium text-center">Arrived</th>
                            <th className="px-4 py-2 font-medium text-right">Unit Price</th>
                            <th className="px-4 py-2 font-medium text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplier.tracking.map((item) => {
                            const arrived = item.arrived ?? 0;
                            const value = arrived * item.price;
                            const isShort = arrived < item.ordered;
                            return (
                              <tr key={item.productName} className={`border-t border-primary/5 ${isShort ? 'bg-amber-50' : ''}`}>
                                <td className="px-4 py-2 text-primary">{item.productName}</td>
                                <td className="px-4 py-2 text-center">{item.ordered}</td>
                                <td className={`px-4 py-2 text-center font-medium ${isShort ? 'text-amber-600' : 'text-green-600'}`}>
                                  {item.arrived ?? 0}
                                </td>
                                <td className="px-4 py-2 text-right text-muted">£{item.price.toFixed(2)}</td>
                                <td className="px-4 py-2 text-right font-medium text-primary">£{value.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t border-primary/10 bg-primary/5">
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-medium text-muted">Ordered Total:</td>
                            <td className="px-4 py-2 text-right text-muted">£{supplier.orderedTotal.toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-medium text-muted">Arrived at Depot:</td>
                            <td className="px-4 py-2 text-right font-semibold text-primary">£{supplier.arrivedTotal.toFixed(2)}</td>
                          </tr>
                          {supplier.supplierRefundDeduction > 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-2 text-right font-medium text-red-600">
                                Refunded by Supplier:
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-red-600">-£{supplier.supplierRefundDeduction.toFixed(2)}</td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-medium text-muted">Total Before Commission:</td>
                            <td className="px-4 py-2 text-right font-semibold text-primary">£{(supplier.arrivedTotal - supplier.supplierRefundDeduction).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-medium text-muted">Commission (20%):</td>
                            <td className="px-4 py-2 text-right text-muted">-£{((supplier.arrivedTotal - supplier.supplierRefundDeduction) * 0.2).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-bold text-primary">Payout:</td>
                            <td className="px-4 py-2 text-right font-bold text-green-600">£{supplier.payout.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                      </div>
                      {supplier.supplierRefunds.filter(r => r.paidBy !== "local" && r.itemArrived).length > 0 && (
                        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                          <p className="text-xs font-semibold text-red-700 mb-1">Refunds deducted from payout:</p>
                          <ul className="text-xs text-red-600 space-y-0.5">
                            {supplier.supplierRefunds.filter(r => r.paidBy !== "local" && r.itemArrived).map((r, i) => {
                              const reasonLabel = refundReasonConfig[r.reasonType]?.label || r.reasonType;
                              const deduction = r.paidBy === "supplier" ? r.refundAmount : r.refundAmount / 2;
                              return (
                                <li key={i}>
                                  • {r.productName}: £{deduction.toFixed(2)} — {reasonLabel}
                                  {r.paidBy === "supplier" ? " (Supplier pays)" : " (50-50)"}
                                  {r.refundReason && <span className="text-red-500"> - {r.refundReason}</span>}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-primary/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-primary/5">
                <div className="flex flex-col gap-1">
                  {uncheckedSuppliers.length > 0 && (
                    <p className="text-xs font-semibold text-amber-700">
                      ⚠️ No check-in recorded for {uncheckedSuppliers.map(s => s.supplierName).join(", ")} - their payout will send as £0. Check their stock in first.
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-primary">Total Payouts:</span>
                    <span className="text-xl font-bold text-green-600">£{totalPayout.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={sendingPayouts}
                    onClick={async () => {
                      setSendingPayouts(true);
                      try {
                        const response = await fetch("/api/send-supplier-payouts", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            deliveryDate: payoutModal,
                            suppliers: payouts.map(s => ({
                              supplierId: s.supplierId,
                              supplierName: s.supplierName,
                              items: s.tracking.map(t => ({
                                productName: t.productName,
                                ordered: t.ordered,
                                arrived: t.arrived,
                                unitPrice: t.price,
                                orderedValue: t.orderedValue,
                                arrivedValue: t.arrivedValue,
                              })),
                              refunds: s.supplierRefunds.map(r => {
                                let deduction = 0;
                                if (r.itemArrived && r.paidBy !== "local") {
                                  deduction = r.paidBy === "supplier" ? r.refundAmount : r.refundAmount / 2;
                                }
                                return {
                                  productName: r.productName,
                                  amount: r.refundAmount,
                                  paidBy: r.paidBy,
                                  reason: r.refundReason,
                                  deduction,
                                };
                              }),
                              orderedTotal: s.orderedTotal,
                              arrivedTotal: s.arrivedTotal,
                              supplierRefundDeduction: s.supplierRefundDeduction,
                              finalPayout: s.payout,
                            })),
                          }),
                        });
                        const data = await response.json();
                        if (data.success) {
                          const failed = data.results.filter((r: { success: boolean }) => !r.success);
                          if (failed.length > 0) {
                            alert(`Sent ${data.sent} emails. ${failed.length} failed:\n${failed.map((f: { supplierName: string; error: string }) => `• ${f.supplierName}: ${f.error}`).join("\n")}`);
                          } else {
                            alert(`✅ Sent payout emails to ${data.sent} suppliers!`);
                          }
                        } else {
                          alert(`Error: ${data.error}`);
                        }
                      } catch (error) {
                        alert(`Failed to send: ${error instanceof Error ? error.message : "Unknown error"}`);
                      } finally {
                        setSendingPayouts(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    <Mail size={16} />
                    {sendingPayouts ? "Sending..." : "Send to Suppliers"}
                  </button>
                  <button
                    onClick={() => {
                      const headers = ["Supplier", "Product", "Ordered", "Arrived", "Unit Price", "Arrived Value", "Refund Amount", "Refund Paid By", "Refund Reason", "Supplier Deduction", "Final Payout"];
                      const rows: string[][] = [];
                      
                      for (const supplier of payouts) {
                        for (const item of supplier.tracking) {
                          const arrived = item.arrived ?? 0;
                          const value = arrived * item.price;
                          rows.push([
                            supplier.supplierName,
                            item.productName,
                            item.ordered.toString(),
                            (item.arrived ?? 0).toString(),
                            `£${item.price.toFixed(2)}`,
                            `£${value.toFixed(2)}`,
                            "", "", "", "", ""
                          ]);
                        }
                        for (const r of supplier.supplierRefunds) {
                          const deduction = r.paidBy === "supplier" ? r.refundAmount : r.paidBy === "50-50" ? r.refundAmount / 2 : 0;
                          rows.push([
                            supplier.supplierName,
                            r.productName,
                            "", "", "", "",
                            `£${r.refundAmount.toFixed(2)}`,
                            r.paidBy === "supplier" ? "Supplier" : r.paidBy === "50-50" ? "50-50" : "Local",
                            r.refundReason || "",
                            deduction > 0 ? `-£${deduction.toFixed(2)}` : "",
                            ""
                          ]);
                        }
                        rows.push([
                          supplier.supplierName,
                          "TOTAL",
                          "", "", "",
                          `£${supplier.arrivedTotal.toFixed(2)}`,
                          "", "",
                          supplier.supplierRefundDeduction > 0 ? `-£${supplier.supplierRefundDeduction.toFixed(2)}` : "",
                          "",
                          `£${supplier.payout.toFixed(2)}`
                        ]);
                        rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
                      }
                      
                      const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `supplier-payouts-${payoutModal}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90 transition"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Issue Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-primary/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-primary">Review Issue</h2>
                <p className="text-sm text-muted">
                  {reviewModal.issue.productName} from {reviewModal.issue.supplierName}
                </p>
              </div>
              <button
                onClick={() => setReviewModal(null)}
                className="text-muted hover:text-primary transition"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Issue summary */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    reviewModal.issue.type === "flagged" 
                      ? "bg-red-100 text-red-700" 
                      : "bg-amber-200 text-amber-800"
                  }`}>
                    {reviewModal.issue.type === "flagged" && reviewModal.issue.shortfall >= reviewModal.issue.orderedQty ? "Won't arrive" : `Short by ${reviewModal.issue.shortfall}`}
                  </span>
                  {reviewModal.issue.arrivedQty !== null && (
                    <span className="text-sm text-amber-700">
                      {reviewModal.issue.arrivedQty} of {reviewModal.issue.orderedQty} arrived
                    </span>
                  )}
                </div>
              </div>

              {/* Customer selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-primary">
                    Select customers to refund ({reviewModal.selectedQtys.size} of {reviewModal.issue.affectedOrders.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReviewModal(prev => prev ? {
                        ...prev,
                        selectedQtys: new Map(prev.issue.affectedOrders.map(o => [o.orderId, o.quantity]))
                      } : null)}
                      className="text-xs text-secondary hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setReviewModal(prev => prev ? {
                        ...prev,
                        selectedQtys: new Map()
                      } : null)}
                      className="text-xs text-muted hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-primary/10 divide-y divide-primary/5 max-h-48 overflow-y-auto">
                  {reviewModal.issue.affectedOrders.map((order) => {
                    const selectedQty = reviewModal.selectedQtys.get(order.orderId);
                    const isSelected = selectedQty !== undefined;
                    return (
                    <div
                      key={order.orderId}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          setReviewModal(prev => {
                            if (!prev) return null;
                            const next = new Map(prev.selectedQtys);
                            if (e.target.checked) next.set(order.orderId, order.quantity);
                            else next.delete(order.orderId);
                            return { ...prev, selectedQtys: next };
                          });
                        }}
                        className="w-4 h-4 rounded border-primary/30 text-secondary focus:ring-secondary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary">
                          #{order.orderNumber} · {order.customerName || order.customerEmail?.split("@")[0] || "Customer"}
                        </p>
                        <p className="text-xs text-muted">
                          {order.quantity} × £{order.price.toFixed(2)} = £{(order.quantity * order.price).toFixed(2)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <label className="text-xs text-muted">Refund</label>
                          <input
                            type="number"
                            min={1}
                            max={order.quantity}
                            value={selectedQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setReviewModal(prev => {
                                if (!prev) return null;
                                const next = new Map(prev.selectedQtys);
                                next.set(order.orderId, isNaN(val) ? 1 : Math.max(1, Math.min(order.quantity, val)));
                                return { ...prev, selectedQtys: next };
                              });
                            }}
                            className="w-14 rounded border border-primary/20 px-1.5 py-1 text-center text-sm focus:border-secondary focus:outline-none"
                          />
                          <span className="text-xs text-muted">of {order.quantity}</span>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Refund options */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">Reason</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(refundReasonConfig) as RefundReasonType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setReviewModal(prev => prev ? {
                          ...prev,
                          reasonType: type,
                          paidBy: refundReasonConfig[type].defaultPaidBy,
                        } : null)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          reviewModal.reasonType === type 
                            ? "bg-secondary text-white" 
                            : "border border-primary/20 text-muted hover:bg-primary/5"
                        }`}
                      >
                        {refundReasonConfig[type].label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">Who pays?</label>
                  <div className="flex gap-2">
                    {(["supplier", "50-50", "local"] as RefundPaidBy[]).map((who) => (
                      <button
                        key={who}
                        type="button"
                        onClick={() => setReviewModal(prev => prev ? { ...prev, paidBy: who } : null)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          reviewModal.paidBy === who 
                            ? "bg-primary text-white" 
                            : "border border-primary/20 text-muted hover:bg-primary/5"
                        }`}
                      >
                        {who === "supplier" ? "Supplier" : who === "50-50" ? "50-50" : "Local Produce"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={reviewModal.notes}
                  onChange={(e) => setReviewModal(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Additional notes for the refund..."
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                />
              </div>

              {refundError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {refundError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-primary/10 flex items-center justify-between">
              <p className="text-sm text-muted">
                {reviewModal.selectedQtys.size > 0 && (
                  <>
                    Total refund: <strong className="text-primary">
                      £{reviewModal.issue.affectedOrders
                        .reduce((sum, o) => sum + (reviewModal.selectedQtys.get(o.orderId) ?? 0) * o.price, 0)
                        .toFixed(2)}
                    </strong>
                  </>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewModal(null)}
                  className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-primary/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefundSelected}
                  disabled={refundLoading || reviewModal.selectedQtys.size === 0}
                  className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90 transition disabled:opacity-50"
                >
                  {refundLoading ? "Processing..." : `Refund ${reviewModal.selectedQtys.size} selected`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
