"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { type Order, type OrderItemRefund, type OrderItemCheckin, type RefundPaidBy, type SupplierProductFlag, type OrderIssue, refundReasonConfig, faultHintLabel, orderIssueConfig, supplierPayoutAdjustment, getOrders, getRefundsForDeliveryDay, getOrderItemCheckins, getSupplierProductFlags, getOrderIssuesForDeliveryDay, createSupplierProductFlag, removeSupplierProductFlag } from "@/lib/data";
import { CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, Truck, AlertTriangle, FileText, Mail, Download, Send, Flag, PoundSterling } from "lucide-react";
import { ChilledTag, chilledRowClass } from "@/components/ChilledTag";

// A refund Luke has already paid back to the customer, waiting on Josie's
// who-pays call. Everything the queue row needs to make that call.
interface PendingRefund {
  refund: OrderItemRefund;
  orderNumber: number;
  boxNumber: number | null;
  customerName: string | null;
  supplierName: string;
  deliveryDay: string;
  // quantity × the line's unit price - the most the supplier could be docked.
  fullLineValue: number;
}

// A customer's "Something not right?" report, with everything Josie needs to
// decide on it without opening another tab.
interface PendingIssue {
  issue: OrderIssue;
  orderNumber: number;
  boxNumber: number | null;
  customerName: string | null;
  supplierName: string;
  deliveryDay: string;
  unitPrice: number;
  // Full value of the units they've reported - the ceiling on any refund.
  fullLineValue: number;
  // Which order this was for that customer. A first-timer with a problem is
  // the one to be most generous with.
  orderSeq: number;
}

interface IssueForm {
  outcome: "refund" | "decline";
  amount: string;
  paidBy: RefundPaidBy;
  deduction: string;
  customerNote: string;
  supplierNote: string;
  reply: string;
}

interface SettleForm {
  paidBy: RefundPaidBy;
  // £ off the payout. Follows who-pays unless Josie types over it.
  deduction: string;
  supplierNote: string;
  notify: boolean;
}

// Where the "whose fault" hint lands before Josie touches it. A hint only -
// she overrules it whenever a new supplier is getting grace.
const faultDefaults: Record<string, RefundPaidBy> = {
  supplier: "supplier",
  local: "local",
  unsure: "supplier",
};

// The supplier's share of one line's refund under "match refund" (£).
function matchRefundDeduction(refundAmount: number, paidBy: RefundPaidBy): number {
  if (paidBy === "local") return 0;
  if (paidBy === "supplier") return refundAmount;
  return Math.round(refundAmount * 50) / 100;
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
  // Packers get the check-in + didn't-arrive refund flow only: the commercial
  // controls (summaries, payouts, refund reason/who-pays/percent) are hidden
  // and the refund API rejects any non-didnt_arrive reason from them.
  const { user } = useUser();
  const isPacker = (user?.publicMetadata?.role as string | undefined) === "packer";

  const [orderList, setOrderList] = useState<Order[]>([]);
  const [productRefrigerated, setProductRefrigerated] = useState<Map<string, boolean>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [expandedRefunds, setExpandedRefunds] = useState<Set<string>>(new Set());
  
  const [orderCheckins, setOrderCheckins] = useState<Map<string, OrderItemCheckin>>(new Map());
  const [refunds, setRefunds] = useState<Map<string, OrderItemRefund[]>>(new Map());
  const [productFlags, setProductFlags] = useState<Map<string, SupplierProductFlag>>(new Map());
  // Keys are `${deliveryDay}-${supplierId}` for suppliers whose check-in is marked complete.
  const [payoutModal, setPayoutModal] = useState<string | null>(null);
  const [sendingPayouts, setSendingPayouts] = useState(false);
  const [sendingSummaries, setSendingSummaries] = useState<string | null>(null);
  // Which suppliers have already had their order summary, per delivery day.
  // Read from the server rather than assumed, so the page shows whether the
  // Wednesday cron actually ran instead of leaving Josie to guess.
  const [summariesSent, setSummariesSent] = useState<Map<string, Set<string>>>(new Map());
  // Customer-reported problems, per delivery day.
  const [orderIssues, setOrderIssues] = useState<Map<string, OrderIssue[]>>(new Map());
  const [resolving, setResolving] = useState<PendingIssue | null>(null);
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueForm, setIssueForm] = useState<IssueForm>({
    outcome: "refund",
    amount: "",
    paidBy: "local",
    deduction: "0.00",
    customerNote: "",
    supplierNote: "",
    reply: "",
  });
  
  // Settle queue state: Josie's who-pays call on refunds Luke has already
  // made to the customer.
  const [settling, setSettling] = useState<PendingRefund | null>(null);
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState<SettleForm>({
    paidBy: "supplier",
    deduction: "",
    supplierNote: "",
    notify: true,
  });

  const openResolve = (pending: PendingIssue) => {
    const config = orderIssueConfig[pending.issue.issueType];
    const paidBy = config.defaultPaidBy;
    setResolving(pending);
    setIssueForm({
      outcome: config.refundable ? "refund" : "decline",
      amount: pending.fullLineValue.toFixed(2),
      paidBy,
      deduction: (paidBy === "supplier"
        ? pending.fullLineValue
        : paidBy === "50-50"
          ? Math.round(pending.fullLineValue * 50) / 100
          : 0
      ).toFixed(2),
      customerNote: "",
      supplierNote: "",
      reply: "",
    });
    setIssueError(null);
  };

  // Who-pays moves the default deduction with it, but only up to whatever
  // she's actually refunding - the farm can never be docked more than the
  // customer got back.
  const changeIssuePaidBy = (paidBy: RefundPaidBy) => {
    const amount = Number(issueForm.amount) || 0;
    const deduction = paidBy === "supplier" ? amount : paidBy === "50-50" ? Math.round(amount * 50) / 100 : 0;
    setIssueForm(prev => ({ ...prev, paidBy, deduction: deduction.toFixed(2) }));
  };

  const submitResolve = async () => {
    if (!resolving) return;
    setIssueSaving(true);
    setIssueError(null);
    try {
      const body = issueForm.outcome === "refund"
        ? {
            outcome: "refund",
            refundAmount: Number(issueForm.amount) || 0,
            paidBy: issueForm.paidBy,
            supplierDeduction: Number(issueForm.deduction) || 0,
            customerNote: issueForm.customerNote,
            supplierNote: issueForm.supplierNote,
          }
        : {
            outcome: orderIssueConfig[resolving.issue.issueType].refundable ? "decline" : "note",
            reply: issueForm.reply,
          };

      const response = await fetch(`/api/admin/order-issues/${resolving.issue.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setIssueError(data?.error?.message || "Couldn't sort that one out");
        return;
      }
      const day = resolving.deliveryDay;
      setResolving(null);
      await loadCheckinData([day]);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Couldn't sort that one out");
    } finally {
      setIssueSaving(false);
    }
  };

  const openSettle = (pending: PendingRefund) => {
    const paidBy = faultDefaults[pending.refund.faultHint ?? "unsure"] ?? "supplier";
    setSettling(pending);
    setSettleForm({
      paidBy,
      deduction: settleDeduction(pending, paidBy).toFixed(2),
      supplierNote: "",
      notify: true,
    });
    setSettleError(null);
  };

  // What the supplier bears by default. For a line that never arrived that's
  // the full value of the missing units (they're simply not paid for goods
  // they didn't send); for one that arrived but was no good it's the who-pays
  // share of what the customer got back.
  const settleDeduction = (pending: PendingRefund, paidBy: RefundPaidBy) => {
    if (!pending.refund.itemArrived) {
      if (paidBy === "local") return 0;
      if (paidBy === "supplier") return pending.fullLineValue;
      return Math.round(pending.fullLineValue * 50) / 100;
    }
    return matchRefundDeduction(pending.refund.refundAmount, paidBy);
  };

  const changePaidBy = (paidBy: RefundPaidBy) => {
    if (!settling) return;
    setSettleForm(prev => ({ ...prev, paidBy, deduction: settleDeduction(settling, paidBy).toFixed(2) }));
  };

  const submitSettle = async () => {
    if (!settling) return;
    setSettleSaving(true);
    setSettleError(null);
    try {
      const response = await fetch(`/api/admin/refunds/${settling.refund.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidBy: settleForm.paidBy,
          supplierDeduction: Number(settleForm.deduction) || 0,
          supplierNote: settleForm.supplierNote || null,
          notifySupplier: settleForm.notify,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSettleError(data?.error?.message || "Couldn't settle that refund");
        return;
      }
      setSettling(null);
      await loadCheckinData([settling.deliveryDay]);
    } catch (error) {
      setSettleError(error instanceof Error ? error.message : "Couldn't settle that refund");
    } finally {
      setSettleSaving(false);
    }
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
  // Every refunded unit on a line, whatever the reason. This is what decides
  // whether there's anything left for Luke to put in the box - a punnet
  // refunded for being squashed isn't going in it either.
  const refundedQtyAll = useCallback((orderId: string, productName: string) => {
    return (refunds.get(orderId) || [])
      .filter(r => r.productName === productName)
      .reduce((sum, r) => sum + r.quantityRefunded, 0);
  }, [refunds]);

  const productRefundedQtyAll = useCallback((supplier: SupplierSummary, productName: string) => {
    let total = 0;
    for (const orderEntry of supplier.orders) {
      if (orderEntry.items.some(i => i.productName === productName)) {
        total += refundedQtyAll(orderEntry.orderId, productName);
      }
    }
    return total;
  }, [refundedQtyAll]);

  const productRefundedQty = useCallback((supplier: SupplierSummary, productName: string) => {
    let total = 0;
    for (const orderEntry of supplier.orders) {
      if (orderEntry.items.some(i => i.productName === productName)) {
        total += notArrivedRefundedQty(orderEntry.orderId, supplier.supplierId, productName);
      }
    }
    return total;
  }, [notArrivedRefundedQty]);

  // Live arrived total for a supplier's product: the sum of each ticked order
  // line's still-expected quantity. The bag ticks are the single source of
  // truth, so this always agrees with the checklist below it.
  const tickedArrivedQty = useCallback((supplier: SupplierSummary, productName: string) => {
    let total = 0;
    for (const orderEntry of supplier.orders) {
      for (const item of orderEntry.items) {
        if (item.productName !== productName) continue;

        const notArrived = notArrivedRefundedQty(orderEntry.orderId, supplier.supplierId, productName);
        const stillToPack = item.quantity - refundedQtyAll(orderEntry.orderId, productName);
        const ticked = isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, productName);

        // What the supplier actually delivered = everything bar the units that
        // never turned up. Counted once the line is settled either way: packed
        // into the box, or refunded away. A quality refund still arrived - they
        // sent it, we chose not to pass it on - so they're still paid for it
        // here, and whether they bear the refund is the settle decision.
        if (ticked || stillToPack <= 0) total += Math.max(0, item.quantity - notArrived);
      }
    }
    return total;
  }, [isOrderItemCheckedIn, notArrivedRefundedQty, refundedQtyAll]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const loadCheckinData = useCallback(async (deliveryDays: string[]) => {
    const checkinsMap = new Map<string, OrderItemCheckin>();
    const refundsMap = new Map<string, OrderItemRefund[]>();
    const flagsMap = new Map<string, SupplierProductFlag>();
    const sentMap = new Map<string, Set<string>>();
    const issuesMap = new Map<string, OrderIssue[]>();

    for (const day of deliveryDays) {
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

      issuesMap.set(day, await getOrderIssuesForDeliveryDay(day));

      try {
        const res = await fetch(`/api/send-supplier-summaries?deliveryDate=${day}`);
        if (res.ok) {
          const data = await res.json();
          sentMap.set(day, new Set<string>(data.sentSupplierIds ?? []));
        }
      } catch {
        // Not knowing is survivable - the button still works and still skips
        // anyone already emailed.
      }
    }
    setOrderCheckins(checkinsMap);
    setRefunds(refundsMap);
    setProductFlags(flagsMap);
    setSummariesSent(prev => {
      const next = new Map(prev);
      for (const [day, ids] of sentMap) next.set(day, ids);
      return next;
    });
    setOrderIssues(prev => {
      const next = new Map(prev);
      for (const [day, list] of issuesMap) next.set(day, list);
      return next;
    });
  }, []);

  useEffect(() => {
    getOrders().then(async (orders) => {
      setOrderList(orders);
      const deliveryDays = [...new Set(orders.map(o => o.deliveryDay).filter(Boolean))];
      await loadCheckinData(deliveryDays);
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
  }, [loadCheckinData]);

  // Whether a supplier's crate is finished for a delivery day.
  //
  // Derived, never declared: done = every one of their order lines is either
  // packed into a box or refunded as short. The old "Done checking in" button
  // was removed in Aug 2026 - it existed only to tell the shortfall engine the
  // count was final, and that engine is gone. (It was also routinely pressed
  // the morning after, which made the figures lie overnight.)
  const isSupplierComplete = useCallback(
    (deliveryDay: string, supplierId: string, supplier: SupplierSummary) => {
      let lines = 0;
      for (const orderEntry of supplier.orders) {
        for (const item of orderEntry.items) {
          lines++;
          const stillToPack = item.quantity - refundedQtyAll(orderEntry.orderId, item.productName);
          if (stillToPack > 0 && !isOrderItemCheckedIn(orderEntry.orderId, supplierId, item.productName)) return false;
        }
      }
      return lines > 0;
    },
    [isOrderItemCheckedIn, refundedQtyAll]
  );

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
      alert("Customers have already been refunded against this flag, so it can't be removed.");
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

  // Backup for the Wednesday 7:10pm cron. Safe to press at any time: the
  // engine skips suppliers who already had theirs.
  const handleSendSupplierSummaries = async (deliveryDay: string, alreadySent: number) => {
    const note = alreadySent > 0
      ? `\n\n${alreadySent} supplier${alreadySent !== 1 ? "s have" : " has"} already had theirs - they'll be skipped.`
      : "";
    if (!confirm(`Send supplier summaries for ${formatDeliveryDate(deliveryDay)}?${note}`)) return;

    setSendingSummaries(deliveryDay);
    try {
      const response = await fetch("/api/send-supplier-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryDate: deliveryDay }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(`Error: ${data.error}`);
        return;
      }
      alert(`✅ ${data.message}`);
      await loadCheckinData([deliveryDay]);
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

  // Header pill: X/Y order-line ticks for this supplier. Fully-refunded lines
  // drop out of Y - they can't be ticked.
  const getSupplierBagCounts = (supplier: SupplierSummary) => {
    let total = 0;
    let checkedIn = 0;
    for (const orderEntry of supplier.orders) {
      for (const item of orderEntry.items) {
        const remaining = item.quantity - refundedQtyAll(orderEntry.orderId, item.productName);
        if (remaining <= 0) continue;
        total++;
        if (isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, item.productName)) {
          checkedIn++;
        }
      }
    }
    return { checkedIn, total };
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary">Stock Management</h1>
      <p className="mt-1 text-muted">
        What&apos;s been packed, the payouts, and the who-pays call on this week&apos;s refunds.
        The counting itself happens on <Link href="/admin/packing" className="text-secondary underline">Packing</Link>.
      </p>

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
                {/* CUSTOMERS REPORTING A PROBLEM */}
                {(() => {
                  // Reports off "Something not right?" on /account. A report is
                  // never a refund - Josie decides here, and settles both
                  // halves at once because she's making both calls anyway.
                  const dayIssues = (orderIssues.get(deliveryDay) ?? []).filter(i => i.status === "open");
                  if (dayIssues.length === 0 || isPacker) return null;

                  // How many orders each customer has had, for the badge.
                  const seqOf = new Map<string, number>();
                  const byCustomer = new Map<string, Order[]>();
                  for (const o of orderList) {
                    if (o.status === "cancelled") continue;
                    const k = o.userId || o.customerEmail?.toLowerCase() || `one-off-${o.id}`;
                    if (!byCustomer.has(k)) byCustomer.set(k, []);
                    byCustomer.get(k)!.push(o);
                  }
                  for (const list of byCustomer.values()) {
                    list.sort((a, b) => a.orderNumber - b.orderNumber);
                    list.forEach((o, i) => seqOf.set(o.id, i + 1));
                  }

                  const pending: PendingIssue[] = [];
                  for (const issue of dayIssues) {
                    const order = orders.find(o => o.id === issue.orderId);
                    if (!order) continue;
                    const line = order.items.find(i => i.productName === issue.productName);
                    pending.push({
                      issue,
                      orderNumber: order.orderNumber,
                      boxNumber: order.boxNumber,
                      customerName: order.customerName,
                      supplierName: line?.supplierName ?? "Unknown supplier",
                      deliveryDay,
                      unitPrice: line?.price ?? 0,
                      fullLineValue: Math.round((line?.price ?? 0) * issue.quantity * 100) / 100,
                      orderSeq: seqOf.get(order.id) ?? 1,
                    });
                  }

                  return (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 overflow-hidden">
                      <div className="px-4 sm:px-6 py-3 border-b border-rose-200">
                        <h3 className="font-bold text-rose-900 flex items-center gap-2">
                          <AlertTriangle size={18} />
                          Customers reporting a problem
                          <span className="rounded-full bg-rose-200 px-2 py-0.5 text-xs font-bold text-rose-900">
                            {pending.length}
                          </span>
                        </h3>
                        <p className="text-xs text-rose-800 mt-0.5">
                          Nothing has been refunded. Decide each one - they get an email either way.
                        </p>
                      </div>
                      <div className="divide-y divide-rose-200">
                        {pending.map((item) => (
                          <div key={item.issue.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-rose-900">
                                  {item.issue.productName} × {item.issue.quantity}
                                </span>
                                <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900 uppercase">
                                  {orderIssueConfig[item.issue.issueType]?.label ?? "Problem"}
                                </span>
                                {item.orderSeq === 1 && (
                                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                    1st order
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-rose-800 mt-0.5">
                                {item.boxNumber != null ? `Box ${item.boxNumber}` : `Order #${item.orderNumber}`}
                                {item.customerName ? ` · ${item.customerName}` : ""}
                                {" · "}{item.supplierName}
                                {" · "}worth £{item.fullLineValue.toFixed(2)}
                              </p>
                              {item.issue.customerNote && (
                                <p className="text-xs text-rose-800/80 italic mt-1">
                                  &ldquo;{item.issue.customerNote}&rdquo;
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => openResolve(item)}
                              className="flex-shrink-0 rounded-lg bg-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-300 transition"
                            >
                              Sort it out
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* REFUNDS TO SETTLE */}
                {(() => {
                  // Luke refunds the customer at the bench and moves on; the
                  // supplier half waits here. Nothing has reached the producer
                  // yet, and a supplier with unsettled refunds isn't safe to
                  // pay out.
                  const pending: PendingRefund[] = [];
                  for (const order of orders) {
                    for (const refund of refunds.get(order.id) || []) {
                      if (refund.supplierStatus !== "pending") continue;
                      const line = order.items.find(i => i.productName === refund.productName);
                      const supplierName =
                        supplierSummaries.find(s => s.supplierId === refund.supplierId)?.supplierName
                        ?? line?.supplierName
                        ?? "Unknown supplier";
                      pending.push({
                        refund,
                        orderNumber: order.orderNumber,
                        boxNumber: order.boxNumber,
                        customerName: order.customerName,
                        supplierName,
                        deliveryDay,
                        fullLineValue: Math.round((line?.price ?? 0) * refund.quantityRefunded * 100) / 100,
                      });
                    }
                  }
                  if (pending.length === 0 || isPacker) return null;
                  pending.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

                  return (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 overflow-hidden">
                      <div className="px-4 sm:px-6 py-3 border-b border-amber-200">
                        <h3 className="font-bold text-amber-900 flex items-center gap-2">
                          <PoundSterling size={18} />
                          Refunds to settle
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                            {pending.length}
                          </span>
                        </h3>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Customers have been refunded and emailed. Decide who bears each one -
                          nothing reaches the farm until you do.
                        </p>
                      </div>
                      <div className="divide-y divide-amber-200">
                        {pending.map((item) => (
                          <div key={item.refund.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-amber-900">
                                  {item.refund.productName} × {item.refund.quantityRefunded}
                                </span>
                                <span className="text-xs text-amber-700">from {item.supplierName}</span>
                                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                                  {refundReasonConfig[item.refund.reasonType]?.label ?? "Refund"}
                                </span>
                              </div>
                              <p className="text-xs text-amber-700 mt-0.5">
                                {item.boxNumber != null ? `Box ${item.boxNumber}` : `Order #${item.orderNumber}`}
                                {item.customerName ? ` · ${item.customerName}` : ""}
                                {" · "}£{item.refund.refundAmount.toFixed(2)} refunded
                                {item.refund.faultHint && ` · ${faultHintLabel[item.refund.faultHint]}`}
                              </p>
                              {item.refund.customerNote && (
                                <p className="text-xs text-amber-700/80 italic mt-1">
                                  &ldquo;{item.refund.customerNote}&rdquo;
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => openSettle(item)}
                              className="flex-shrink-0 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300 transition"
                            >
                              Settle
                            </button>
                          </div>
                        ))}
                      </div>
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
                                      {refund.customerNote && <span> - {refund.customerNote}</span>}
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
                {(() => {
                  // Summaries go out on their own at 7:10pm Wednesday. This
                  // header reports what actually happened rather than leaving
                  // Josie to remember - the button below is only the backup.
                  const sentIds = summariesSent.get(deliveryDay) ?? new Set<string>();
                  const withEmail = supplierSummaries.filter(s => s.supplierId !== "unknown");
                  const sentCount = withEmail.filter(s => sentIds.has(s.supplierId)).length;
                  const outstanding = withEmail.length - sentCount;
                  return (
                <div className="rounded-xl bg-surface shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/5 px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Truck size={18} className="text-secondary" />
                      <h3 className="font-bold text-primary">Suppliers</h3>
                      <span className="text-xs text-muted">({supplierSummaries.length})</span>
                      {!isPacker && withEmail.length > 0 && (
                        outstanding === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                            <CheckCircle size={11} />
                            Summaries sent to all {sentCount}
                          </span>
                        ) : sentCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <AlertTriangle size={11} />
                            Summaries: {sentCount} sent, {outstanding} still to go
                          </span>
                        ) : (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-muted">
                            Summaries go automatically at 7:10pm Wed
                          </span>
                        )
                      )}
                    </div>
                    {/* Both buttons hit admin-only APIs, so hide them from the packer */}
                    {!isPacker && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSendSupplierSummaries(deliveryDay, sentCount)}
                          disabled={sendingSummaries === deliveryDay}
                          title="Backup for the automatic Wednesday send - skips anyone who already had theirs"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/30 transition disabled:opacity-50"
                        >
                          <Send size={14} />
                          {sendingSummaries === deliveryDay
                            ? "Sending..."
                            : outstanding > 0 && sentCount > 0
                              ? `Send the remaining ${outstanding}`
                              : "Send summaries"}
                        </button>
                        <button
                          onClick={() => setPayoutModal(deliveryDay)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                        >
                          <FileText size={14} />
                          Supplier Payouts
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-primary/5">
                    {supplierSummaries.map((supplier) => {
                      const key = `supplier-${deliveryDay}-${supplier.supplierId}`;
                      const isExpanded = expandedSuppliers.has(key);
                      const bags = getSupplierBagCounts(supplier);
                      const supplierDone = isSupplierComplete(deliveryDay, supplier.supplierId, supplier);

                      // Progress pill: green = done, amber = started,
                      // grey = Luke hasn't reached this crate yet.
                      const checkInPillClass = supplierDone || (bags.checkedIn === bags.total && bags.total > 0)
                        ? "bg-green-100 text-green-700"
                        : bags.checkedIn > 0
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
                                {supplierDone ? "✓ Packed" : `Packed ${bags.checkedIn}/${bags.total}`}
                              </span>
                              <span className="font-semibold text-primary">£{supplier.totalPrice.toFixed(2)}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="bg-primary/5 px-3 sm:px-6 py-4 space-y-4">
                              {/* WHAT'S BEEN PACKED */}
                              {/* Read-only since Aug 2026: the counting all
                                  happens on /admin/packing. This mirrors it so
                                  Josie can see how far Luke has got, and it's
                                  where she logs a "no chillies this week"
                                  message so it reaches his bench. */}
                              <div className="rounded-lg border border-primary/10 bg-surface overflow-hidden">
                                <div className="px-3 py-2 border-b border-primary/10">
                                  <span className="text-xs font-semibold text-muted uppercase">What&apos;s been packed</span>
                                </div>
                                <div className="divide-y divide-primary/5">
                                  {supplier.items.map((item) => {
                                    const flag = productFlags.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
                                    const isFlagged = !!(flag && !flag.resolved);
                                    const packed = tickedArrivedQty(supplier, item.productName);
                                    const refunded = productRefundedQtyAll(supplier, item.productName);
                                    // Refunded units aren't coming, so they're
                                    // not part of what's left to pack.
                                    const expected = Math.max(0, item.quantity - refunded);
                                    const flagQty = isFlagged ? Math.min(flag!.quantityUnavailable ?? item.quantity, item.quantity) : 0;
                                    const flagCovered = isFlagged && refunded >= flagQty;
                                    const flagOpen = isFlagged && !flagCovered;
                                    const allPacked = packed >= expected;
                                    const affectsList = supplier.orders
                                      .filter(o => o.items.some(i => i.productName === item.productName))
                                      .map(o => o.boxNumber != null ? `Box ${o.boxNumber}` : `#${o.orderNumber}`)
                                      .join(", ");

                                    return (
                                      <div
                                        key={`${item.productName}|${item.unit}`}
                                        className={`px-3 py-2.5 ${flagOpen ? "bg-red-50" : allPacked && expected > 0 ? "bg-green-50" : item.refrigerated ? chilledRowClass : ""}`}
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="font-medium text-primary">{item.productName}</span>
                                            {item.unit && <span className="text-xs text-muted">{item.unit}</span>}
                                            {item.refrigerated && <ChilledTag />}
                                          </div>
                                          <div className="flex items-center gap-3 flex-shrink-0 text-sm">
                                            <span className={`font-semibold ${allPacked && expected > 0 ? "text-green-600" : "text-primary"}`}>
                                              Packed {packed} of {expected}
                                            </span>
                                            <span className="text-muted">£{(item.quantity * item.price).toFixed(2)}</span>
                                          </div>
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            {flagOpen && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">
                                                <XCircle size={11} />
                                                {flagQty >= item.quantity ? "Won't arrive" : `${flagQty} of ${item.quantity} won't arrive`}
                                                <span className="font-normal normal-case">
                                                  · flagged by {flag!.flaggedBy === "admin" ? "you" : "them"}
                                                </span>
                                              </span>
                                            )}
                                            {flagCovered && (
                                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                                <CheckCircle size={12} />
                                                Flag handled
                                              </span>
                                            )}
                                            {refunded > 0 && (
                                              <span className="text-xs text-muted">{refunded} refunded</span>
                                            )}
                                            {flagOpen && (
                                              <span className="text-[10px] text-red-600">Affects: {affectsList}</span>
                                            )}
                                          </div>

                                          {!isPacker && (flagOpen ? (
                                            <button
                                              onClick={() => handleUnflag(deliveryDay, supplier, item.productName)}
                                              className="flex-shrink-0 rounded border border-red-200 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 transition"
                                            >
                                              Unflag
                                            </button>
                                          ) : !isFlagged ? (
                                            <button
                                              onClick={() => handleAdminFlag(deliveryDay, supplier, item)}
                                              title="They've told you it isn't coming - flag it so it reaches Luke's packing screen"
                                              className="flex-shrink-0 inline-flex items-center gap-1 rounded border border-primary/10 px-2.5 py-1 text-[10px] font-medium text-muted hover:text-red-600 hover:border-red-200 transition"
                                            >
                                              <Flag size={11} />
                                              Not coming
                                            </button>
                                          ) : null)}
                                        </div>
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
                  </div>
                </div>
                  );
                })()}
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
          const supplierTracking: Array<{ productName: string; ordered: number; arrived: number; price: number; orderedValue: number; arrivedValue: number }> = [];
          for (const item of supplier.items) {
            const arrived = tickedArrivedQty(supplier, item.productName);
            supplierTracking.push({
              productName: item.productName,
              ordered: item.quantity,
              arrived,
              price: item.price,
              orderedValue: item.quantity * item.price,
              arrivedValue: arrived * item.price,
            });
          }

          const supplierRefunds = dayRefunds.filter(r => r.supplierId === supplier.supplierId);

          // Per-refund payout adjustment: positive = deducted, negative = a
          // credit back for didn't-arrive units the supplier isn't being fully
          // docked for (they're excluded from the arrived total below).
          const refundUnitPrice = (productName: string) =>
            supplier.items.find(i => i.productName === productName)?.price ?? 0;
          let supplierRefundDeduction = 0;
          for (const refund of supplierRefunds) {
            supplierRefundDeduction += supplierPayoutAdjustment(refund, refundUnitPrice(refund.productName));
          }

          const orderedTotal = supplierTracking.reduce((sum, item) => sum + item.orderedValue, 0);
          const arrivedTotal = supplierTracking.reduce((sum, item) => sum + item.arrivedValue, 0);
          const payout = Math.max(0, (arrivedTotal - supplierRefundDeduction) * 0.8);
          // Unticked check-in: no ticks at all means every line counts as 0 and
          // the payout is £0 - flagged below so it can't slip through.
          const hasAnyArrival = supplier.orders.some(o =>
            o.items.some(i => isOrderItemCheckedIn(o.orderId, supplier.supplierId, i.productName))
          );

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
                {(() => {
                  // A pending refund hasn't had its who-pays call made yet, so
                  // these figures aren't final. Settle first, then pay.
                  const unsettled = dayRefunds.filter(r => r.supplierStatus === "pending");
                  if (unsettled.length === 0) return null;
                  return (
                    <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>{unsettled.length} refund{unsettled.length !== 1 ? "s" : ""} still to settle.</strong>{" "}
                        These figures don&apos;t include them - settle the queue above before sending payouts.
                      </span>
                    </div>
                  );
                })()}
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
                          {Math.abs(supplier.supplierRefundDeduction) > 0.005 && (
                            <div className={`flex justify-between ${supplier.supplierRefundDeduction > 0 ? 'text-red-600' : 'text-green-700'}`}>
                              <span>{supplier.supplierRefundDeduction > 0 ? 'Refund Deductions' : 'Refund Credits'}</span>
                              <span className="font-semibold">{supplier.supplierRefundDeduction > 0 ? '-' : '+'}£{Math.abs(supplier.supplierRefundDeduction).toFixed(2)}</span>
                            </div>
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
                          {Math.abs(supplier.supplierRefundDeduction) > 0.005 && (
                            <tr>
                              <td colSpan={4} className={`px-4 py-2 text-right font-medium ${supplier.supplierRefundDeduction > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                {supplier.supplierRefundDeduction > 0 ? 'Refund Deductions:' : 'Refund Credits:'}
                              </td>
                              <td className={`px-4 py-2 text-right font-semibold ${supplier.supplierRefundDeduction > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                {supplier.supplierRefundDeduction > 0 ? '-' : '+'}£{Math.abs(supplier.supplierRefundDeduction).toFixed(2)}
                              </td>
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
                      {(() => {
                        const adjustments = supplier.supplierRefunds
                          .map(r => ({
                            refund: r,
                            adjustment: supplierPayoutAdjustment(r, supplier.items.find(i => i.productName === r.productName)?.price ?? 0),
                          }))
                          .filter(a => Math.abs(a.adjustment) > 0.005);
                        if (adjustments.length === 0) return null;
                        return (
                          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                            <p className="text-xs font-semibold text-red-700 mb-1">Refund adjustments on payout:</p>
                            <ul className="text-xs space-y-0.5">
                              {adjustments.map(({ refund: r, adjustment }, i) => {
                                const reasonLabel = refundReasonConfig[r.reasonType]?.label || r.reasonType;
                                return (
                                  <li key={i} className={adjustment > 0 ? "text-red-600" : "text-green-700"}>
                                    • {r.productName}: {adjustment > 0 ? `-£${adjustment.toFixed(2)}` : `+£${Math.abs(adjustment).toFixed(2)} credited back`} — {reasonLabel}
                                    {r.supplierDeduction !== null
                                      ? ` (supplier docked £${r.supplierDeduction.toFixed(2)})`
                                      : r.paidBy === "supplier" ? " (Supplier pays)" : " (50-50)"}
                                    {r.customerNote && <span className="opacity-80"> - {r.customerNote}</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })()}
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
                              refunds: s.supplierRefunds.map(r => ({
                                productName: r.productName,
                                amount: r.refundAmount,
                                paidBy: r.paidBy,
                                reason: r.customerNote,
                                deduction: supplierPayoutAdjustment(r, s.items.find(i => i.productName === r.productName)?.price ?? 0),
                              })),
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
                          const deduction = supplierPayoutAdjustment(r, supplier.items.find(i => i.productName === r.productName)?.price ?? 0);
                          rows.push([
                            supplier.supplierName,
                            r.productName,
                            "", "", "", "",
                            `£${r.refundAmount.toFixed(2)}`,
                            r.paidBy === "supplier" ? "Supplier" : r.paidBy === "50-50" ? "50-50" : "Local",
                            r.customerNote || "",
                            Math.abs(deduction) > 0.005 ? `${deduction > 0 ? "-" : "+"}£${Math.abs(deduction).toFixed(2)}` : "",
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

      {/* Settle a refund - the supplier half */}
      {settling && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface shadow-xl">
            <div className="sticky top-0 bg-surface border-b border-primary/10 px-5 py-4">
              <h2 className="text-lg font-bold text-primary">
                {settling.refund.productName} × {settling.refund.quantityRefunded}
              </h2>
              <p className="text-sm text-muted">
                {settling.supplierName} ·{" "}
                {settling.boxNumber != null ? `Box ${settling.boxNumber}` : `Order #${settling.orderNumber}`}
                {" · "}£{settling.refund.refundAmount.toFixed(2)} already refunded to the customer
              </p>
            </div>

            <div className="px-5 py-4 space-y-5">
              <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5 text-sm">
                <p className="text-muted text-xs uppercase font-semibold mb-1">
                  {refundReasonConfig[settling.refund.reasonType]?.label ?? "Refund"}
                  {settling.refund.faultHint && ` · ${faultHintLabel[settling.refund.faultHint]}`}
                </p>
                {settling.refund.customerNote && (
                  <p className="text-primary italic">&ldquo;{settling.refund.customerNote}&rdquo;</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">Who bears it?</label>
                <div className="flex gap-2">
                  {([
                    { value: "supplier" as RefundPaidBy, label: "The farm" },
                    { value: "50-50" as RefundPaidBy, label: "50-50" },
                    { value: "local" as RefundPaidBy, label: "We cover it" },
                  ]).map(option => (
                    <button
                      key={option.value}
                      onClick={() => changePaidBy(option.value)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        settleForm.paidBy === option.value
                          ? "border-secondary bg-secondary/10 text-primary"
                          : "border-primary/15 text-muted hover:bg-primary/5"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {!settling.refund.itemArrived && settleForm.paidBy === "local" && (
                  <p className="text-xs text-muted mt-1.5">
                    Grace: they&apos;ll be paid in full for the units that never turned up.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">
                  Off their payout (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settleForm.deduction}
                  onChange={(e) => setSettleForm({ ...settleForm, deduction: e.target.value })}
                  className="w-32 rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                />
                <p className="text-xs text-muted mt-1">
                  Full value of the line is £{settling.fullLineValue.toFixed(2)}. Type over it for a part deduction.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">
                  Note to the farm (they see this)
                </label>
                <textarea
                  value={settleForm.supplierNote}
                  onChange={(e) => setSettleForm({ ...settleForm, supplierNote: e.target.value })}
                  rows={3}
                  placeholder="Optional - e.g. third week running on the apples, can we talk Monday?"
                  className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                />
                <p className="text-xs text-muted mt-1">
                  The customer never sees this. Their own note is quoted to the farm either way.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={settleForm.notify}
                  onChange={(e) => setSettleForm({ ...settleForm, notify: e.target.checked })}
                  className="h-5 w-5 rounded border-primary/30 text-green-600 focus:ring-green-500"
                />
                Email the farm about this one
              </label>

              {settleError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {settleError}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-surface border-t border-primary/10 px-5 py-4 flex gap-3">
              <button
                onClick={() => setSettling(null)}
                disabled={settleSaving}
                className="rounded-lg border border-primary/20 px-4 py-2.5 text-sm font-medium text-muted hover:bg-primary/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitSettle}
                disabled={settleSaving}
                className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:bg-secondary/90 transition disabled:opacity-50"
              >
                {settleSaving ? "Settling..." : "Settle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort out a customer-reported problem: both halves in one go */}
      {resolving && (() => {
        const config = orderIssueConfig[resolving.issue.issueType];
        return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface shadow-xl">
            <div className="sticky top-0 bg-surface border-b border-primary/10 px-5 py-4">
              <h2 className="text-lg font-bold text-primary">
                {resolving.issue.productName} × {resolving.issue.quantity}
              </h2>
              <p className="text-sm text-muted">
                {resolving.boxNumber != null ? `Box ${resolving.boxNumber}` : `Order #${resolving.orderNumber}`}
                {resolving.customerName ? ` · ${resolving.customerName}` : ""}
                {resolving.orderSeq === 1 ? " · their first order" : ` · ${resolving.orderSeq} orders in`}
              </p>
            </div>

            <div className="px-5 py-4 space-y-5">
              <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5 text-sm">
                <p className="text-muted text-xs uppercase font-semibold mb-1">
                  {config.label} · {resolving.supplierName}
                </p>
                {resolving.issue.customerNote ? (
                  <p className="text-primary italic">&ldquo;{resolving.issue.customerNote}&rdquo;</p>
                ) : (
                  <p className="text-muted italic">They didn&apos;t add a note.</p>
                )}
              </div>

              {config.refundable ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIssueForm({ ...issueForm, outcome: "refund" })}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      issueForm.outcome === "refund"
                        ? "border-secondary bg-secondary/10 text-primary"
                        : "border-primary/15 text-muted hover:bg-primary/5"
                    }`}
                  >
                    Refund them
                  </button>
                  <button
                    onClick={() => setIssueForm({ ...issueForm, outcome: "decline" })}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      issueForm.outcome === "decline"
                        ? "border-secondary bg-secondary/10 text-primary"
                        : "border-primary/15 text-muted hover:bg-primary/5"
                    }`}
                  >
                    No refund
                  </button>
                </div>
              ) : (
                <p className="rounded-lg bg-primary/5 px-3 py-2.5 text-sm text-muted">
                  Nothing&apos;s owed here - they got more than they ordered. Send them a line back and close it.
                </p>
              )}

              {config.refundable && issueForm.outcome === "refund" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-2">Refund them (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={resolving.fullLineValue}
                      value={issueForm.amount}
                      onChange={(e) => setIssueForm({ ...issueForm, amount: e.target.value })}
                      className="w-32 rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                    />
                    <p className="text-xs text-muted mt-1">
                      Full value is £{resolving.fullLineValue.toFixed(2)} - type over it for a part refund.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-2">Who bears it?</label>
                    <div className="flex gap-2">
                      {([
                        { value: "supplier" as RefundPaidBy, label: "The farm" },
                        { value: "50-50" as RefundPaidBy, label: "50-50" },
                        { value: "local" as RefundPaidBy, label: "We cover it" },
                      ]).map(option => (
                        <button
                          key={option.value}
                          onClick={() => changeIssuePaidBy(option.value)}
                          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                            issueForm.paidBy === option.value
                              ? "border-secondary bg-secondary/10 text-primary"
                              : "border-primary/15 text-muted hover:bg-primary/5"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted mt-1.5">
                      {resolving.issue.issueType === "quality"
                        ? "Quality is usually the farm's - they sent it."
                        : resolving.issue.issueType === "damaged"
                          ? "Damage is usually ours - we packed and carried it."
                          : "Pre-set from what they reported. Change it if that's not fair."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-2">Off the farm&apos;s payout (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={issueForm.deduction}
                      onChange={(e) => setIssueForm({ ...issueForm, deduction: e.target.value })}
                      className="w-32 rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                    />
                    <p className="text-xs text-muted mt-1">£0 means we absorb it and they&apos;re paid in full.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-2">Note to the customer</label>
                    <textarea
                      value={issueForm.customerNote}
                      onChange={(e) => setIssueForm({ ...issueForm, customerNote: e.target.value })}
                      rows={2}
                      placeholder="Goes in their refund email - e.g. So sorry about that, refunded in full."
                      className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                    />
                  </div>

                  {Number(issueForm.deduction) > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-muted uppercase mb-2">Note to the farm</label>
                      <textarea
                        value={issueForm.supplierNote}
                        onChange={(e) => setIssueForm({ ...issueForm, supplierNote: e.target.value })}
                        rows={2}
                        placeholder="Private - the customer never sees this."
                        className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-2">What shall we tell them?</label>
                  <textarea
                    value={issueForm.reply}
                    onChange={(e) => setIssueForm({ ...issueForm, reply: e.target.value })}
                    rows={4}
                    placeholder="They'll get this by email, from you."
                    className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-primary"
                  />
                  <p className="text-xs text-muted mt-1">Nobody gets left without an answer.</p>
                </div>
              )}

              {issueError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {issueError}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-surface border-t border-primary/10 px-5 py-4 flex gap-3">
              <button
                onClick={() => setResolving(null)}
                disabled={issueSaving}
                className="rounded-lg border border-primary/20 px-4 py-2.5 text-sm font-medium text-muted hover:bg-primary/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitResolve}
                disabled={issueSaving}
                className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:bg-secondary/90 transition disabled:opacity-50"
              >
                {issueSaving
                  ? "Sending..."
                  : config.refundable && issueForm.outcome === "refund"
                    ? `Refund £${(Number(issueForm.amount) || 0).toFixed(2)} and email them`
                    : "Send the reply"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );
}
