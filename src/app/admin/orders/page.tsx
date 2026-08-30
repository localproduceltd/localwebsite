"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Order, type OrderItem, type OrderItemRefund, type RefundPaidBy, type RefundReasonType, refundReasonConfig, DELIVERY_OPTION_LABELS, getOrders, updateOrderStatus, getCustomerBoxStatuses, getRefundsForDeliveryDay, deleteOrderItemRefund, getOrderIssuesForDeliveryDay, orderIssueConfig, type OrderIssue } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, Home, MapPin, Users, Truck, Search, MoreVertical, Play, AlertTriangle } from "lucide-react";

const statusConfig = {
  ordered: { label: "Ordered", icon: Clock, color: "text-amber-600 bg-amber-50" },
  prepped: { label: "Prepped", icon: Package, color: "text-blue-600 bg-blue-50" },
  next_hour: { label: "Next Hour", icon: Truck, color: "text-purple-600 bg-purple-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

const statusOptions: Order["status"][] = ["ordered", "prepped", "next_hour", "delivered", "cancelled"];

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

function formatAddressOneLine(order: Order): string {
  if (!order.address) return "—";
  return `${order.address.addressLine1}, ${order.address.postcode}`;
}

function groupItemsBySupplier(items: OrderItem[]): Array<{ supplierId: string; supplierName: string; items: OrderItem[] }> {
  const map = new Map<string, { supplierName: string; items: OrderItem[] }>();
  for (const item of items) {
    const id = item.supplierId || "unknown";
    const name = item.supplierName || "Unknown Supplier";
    if (!map.has(id)) map.set(id, { supplierName: name, items: [] });
    map.get(id)!.items.push(item);
  }
  return Array.from(map.entries())
    .map(([supplierId, data]) => ({ supplierId, ...data }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}
// "1st", "2nd", "3rd", "11th"...
function ordinal(n: number) {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// How many orders this customer has had, counting this one. Same badge as the
// packing bench, so a first-timer reads the same wherever they turn up.
function OrderCount({ seq }: { seq: number }) {
  if (seq === 1) {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-white">
        1st order
      </span>
    );
  }
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-muted">
      {ordinal(seq)}
    </span>
  );
}

// Status progression: ordered → prepped → next_hour → delivered
const statusProgression: Record<string, Order["status"] | null> = {
  ordered: "prepped",
  prepped: "next_hour",
  next_hour: "delivered",
  delivered: null,
  cancelled: null,
};

export default function AdminDeliveriesPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [boxStatuses, setBoxStatuses] = useState<Map<string, boolean>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [markingAllPrepped, setMarkingAllPrepped] = useState<string | null>(null);
  
  const [refunds, setRefunds] = useState<Map<string, OrderItemRefund[]>>(new Map());
  const [refundModal, setRefundModal] = useState<{ orderId: string; orderNumber: number; productName: string; price: number; quantity: number; supplierId: string } | null>(null);
  const [refundQty, setRefundQty] = useState(1);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReasonType, setRefundReasonType] = useState<RefundReasonType>("didnt_arrive");
  const [refundReason, setRefundReason] = useState("");
  const [refundPaidBy, setRefundPaidBy] = useState<RefundPaidBy>("supplier");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const loadRefunds = useCallback(async (deliveryDays: string[]) => {
    const refundsMap = new Map<string, OrderItemRefund[]>();
    const issuesMap = new Map<string, OrderIssue[]>();
    for (const day of deliveryDays) {
      const dayRefunds = await getRefundsForDeliveryDay(day);
      for (const r of dayRefunds) {
        const key = r.orderId;
        if (!refundsMap.has(key)) refundsMap.set(key, []);
        refundsMap.get(key)!.push(r);
      }
      try {
        for (const issue of await getOrderIssuesForDeliveryDay(day)) {
          if (!issuesMap.has(issue.orderId)) issuesMap.set(issue.orderId, []);
          issuesMap.get(issue.orderId)!.push(issue);
        }
      } catch {
        // The badge is a nicety - never block the orders list over it.
      }
    }
    setRefunds(refundsMap);
    setIssuesByOrder(issuesMap);
  }, []);

  useEffect(() => {
    getOrders().then(async (orders) => {
      setOrderList(orders);
      const userIds = [...new Set(orders.map(o => o.userId))];
      const statuses = await getCustomerBoxStatuses(userIds);
      setBoxStatuses(statuses);
      
      const deliveryDays = [...new Set(orders.map(o => o.deliveryDay).filter(Boolean))];
      await loadRefunds(deliveryDays);
    }).catch(console.error);
  }, [loadRefunds]);

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    const order = orderList.find((o) => o.id === orderId);

    if (newStatus === "delivered") {
      // Same server path as the Driver Run tab: records the box outcome
      // (default here: a box goes out with box-deposit orders, nothing
      // collected - the driver page asks explicitly), keeps the customer's
      // outstanding-box flag in step, and sends the delivered email.
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/delivered`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boxLeft: order?.boxDepositPaid ?? false, boxCollected: false }),
        });
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.error?.message || "Failed to mark delivered");
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to mark delivered");
        return;
      }
      const updated = await getOrders();
      setOrderList(updated);
      const userIds = [...new Set(updated.map(o => o.userId))];
      setBoxStatuses(await getCustomerBoxStatuses(userIds));
      return;
    }

    await updateOrderStatus(orderId, newStatus);

    const updated = await getOrders();
    setOrderList(updated);

    if (order && order.customerEmail && ["prepped", "next_hour", "cancelled"].includes(newStatus)) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order_status_update",
          data: {
            customerEmail: order.customerEmail,
            customerName: order.customerName || order.customerEmail.split("@")[0],
            orderNumber: order.orderNumber,
            status: newStatus,
            deliveryDay: order.deliveryDay
              ? new Date(order.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
              : "Not set",
            deliveryWindow: order.deliveryWindow,
          },
        }),
      }).catch(console.error);
    }
  };

  const advanceStatus = async (orderId: string) => {
    const order = orderList.find(o => o.id === orderId);
    if (!order) return;
    const nextStatus = statusProgression[order.status];
    if (nextStatus) {
      await updateStatus(orderId, nextStatus);
    }
  };

  // Which order this is for each customer, counted across their whole history
  // (cancelled ones don't count), keyed on their login with email as fallback.
  // Open "Something not right?" reports, so an order carrying one is obvious
  // here as well as on Stock, where it actually gets dealt with.
  const [issuesByOrder, setIssuesByOrder] = useState<Map<string, OrderIssue[]>>(new Map());

  const orderSequence = useMemo(() => {
    const byCustomer = new Map<string, Order[]>();
    for (const order of orderList) {
      if (order.status === "cancelled") continue;
      const key = order.userId || order.customerEmail?.toLowerCase() || `one-off-${order.id}`;
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key)!.push(order);
    }
    const seq = new Map<string, number>();
    for (const list of byCustomer.values()) {
      list.sort((a, b) => a.orderNumber - b.orderNumber);
      list.forEach((order, i) => seq.set(order.id, i + 1));
    }
    return seq;
  }, [orderList]);

  const handleMarkAllPrepped = async (deliveryDay: string, orders: Order[]) => {
    const eligibleOrders = orders.filter(o => o.status !== "cancelled" && o.status !== "delivered");
    if (eligibleOrders.length === 0) {
      alert("No orders to mark as prepped.");
      return;
    }
    
    const notYet = eligibleOrders.filter(o => o.status === "ordered").length;
    if (!confirm(`Send the "coming tomorrow" email to ${notYet} customer${notYet !== 1 ? "s" : ""}?\n\nAnyone already emailed is skipped. These normally go on their own at 6pm Thursday.`)) {
      return;
    }
    
    setMarkingAllPrepped(deliveryDay);
    try {
      const res = await fetch("/api/admin/prepped-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_day: deliveryDay }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to mark all prepped");
      }
      // Refresh so the new statuses show
      setOrderList(await getOrders());
      alert(`✅ Emailed ${result.sent} customer${result.sent === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} already had theirs)` : ""}.`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setMarkingAllPrepped(null);
    }
  };

  const handleCreateRefund = async () => {
    if (!refundModal) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    setRefundLoading(true);
    setRefundError(null);
    
    const reasonConfig = refundReasonConfig[refundReasonType];
    const itemArrived = reasonConfig.itemArrived;
    
    try {
      const response = await fetch("/api/refund-order-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: refundModal.orderId,
          productName: refundModal.productName,
          quantity: refundQty,
          refundAmount: amount,
          reasonType: refundReasonType,
          refundReason: refundReason || null,
          itemArrived,
          paidBy: refundPaidBy,
          supplierId: refundModal.supplierId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to process refund");
      }
      
      const order = orderList.find(o => o.id === refundModal.orderId);
      if (order) {
        const dayRefunds = await getRefundsForDeliveryDay(order.deliveryDay);
        setRefunds(prev => {
          const next = new Map(prev);
          for (const r of dayRefunds) {
            const key = r.orderId;
            if (!next.has(key)) next.set(key, []);
            else next.set(key, dayRefunds.filter(ref => ref.orderId === key));
          }
          return next;
        });
      }
      
      if (data.manualRefundRequired) {
        alert(`Refund recorded! ⚠️ This order doesn't have Stripe data - please process the £${amount.toFixed(2)} refund manually in Stripe dashboard.`);
      }
      
      setRefundModal(null);
      setRefundAmount("");
      setRefundReasonType("didnt_arrive");
      setRefundReason("");
      setRefundPaidBy("supplier");
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : "Failed to process refund");
    } finally {
      setRefundLoading(false);
    }
  };

  const handleDeleteRefund = async (refundId: string, orderId: string) => {
    await deleteOrderItemRefund(refundId);
    const order = orderList.find(o => o.id === orderId);
    if (order) {
      const dayRefunds = await getRefundsForDeliveryDay(order.deliveryDay);
      setRefunds(prev => {
        const next = new Map(prev);
        next.set(orderId, dayRefunds.filter(r => r.orderId === orderId));
        return next;
      });
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

  const toggleExpand = useCallback((key: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

  // Filter orders by search query
  const filterOrders = (orders: Order[]) => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o => 
      o.customerName?.toLowerCase().includes(q) ||
      o.customerEmail?.toLowerCase().includes(q) ||
      o.address?.postcode?.toLowerCase().includes(q) ||
      o.orderNumber.toString().includes(q) ||
      o.boxNumber?.toString() === q
    );
  };

  // Sort orders: morning first, then afternoon, then either, then unscheduled, then by order number
  const sortOrders = (orders: Order[]) => {
    return [...orders].sort((a, b) => {
      const windowOrder: Record<string, number> = { morning: 0, afternoon: 1, any: 2 };
      const aWindow = a.deliveryWindow ? windowOrder[a.deliveryWindow] ?? 3 : 3;
      const bWindow = b.deliveryWindow ? windowOrder[b.deliveryWindow] ?? 3 : 3;
      if (aWindow !== bWindow) return aWindow - bWindow;
      return (a.boxNumber ?? a.orderNumber) - (b.boxNumber ?? b.orderNumber);
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Orders</h1>
          <p className="mt-1 text-muted">Every order by delivery day - status, addresses and refunds.</p>
        </div>
      </div>

      {grouped.map(([deliveryDay, allOrders]) => {
        const upcoming = isUpcoming(deliveryDay);
        const isOpen = !collapsed.has(deliveryDay);
        const total = allOrders.reduce((sum, o) => sum + o.total, 0);
        const filteredOrders = filterOrders(allOrders);
        const sortedOrders = sortOrders(filteredOrders);

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
                {allOrders.length} order{allOrders.length !== 1 ? "s" : ""} · £{total.toFixed(2)}
              </span>
            </button>

            {isOpen && (
              <div className="space-y-4">
                {/* CONTROLS BAR */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      placeholder="Search by name, postcode, or order #..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-primary/20 pl-9 pr-4 py-2 text-sm focus:border-secondary focus:outline-none"
                    />
                  </div>
                  {(() => {
                    // The "coming tomorrow" emails send themselves at 6pm
                    // Thursday (/api/cron/prepped-emails), and an order's
                    // status IS the record of whether its email went - so this
                    // reports the truth rather than leaving Josie guessing,
                    // and the button is only the backup. Pressing it is always
                    // safe: the same engine skips already-prepped orders.
                    const live = allOrders.filter(o => o.status !== "cancelled");
                    const emailed = live.filter(o => o.status !== "ordered").length;
                    const outstanding = live.length - emailed;
                    return (
                      <div className="flex items-center gap-3 flex-wrap">
                        {live.length > 0 && (
                          outstanding === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
                              <CheckCircle size={12} />
                              All {emailed} emailed
                            </span>
                          ) : emailed > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                              <Clock size={12} />
                              {emailed} emailed, {outstanding} to go
                            </span>
                          ) : (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-muted">
                              &quot;Coming tomorrow&quot; emails go automatically at 6pm Thu
                            </span>
                          )
                        )}
                        {outstanding > 0 && (
                          <button
                            onClick={() => handleMarkAllPrepped(deliveryDay, allOrders)}
                            disabled={markingAllPrepped === deliveryDay}
                            title="Backup for the automatic 6pm Thursday send - skips anyone already emailed"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                          >
                            <Package size={16} />
                            {markingAllPrepped === deliveryDay ? "Sending..." : `Send the remaining ${outstanding}`}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* CUSTOMERS TABLE - split by window for easier delivery routing */}
                {(() => {
                  // Build window groups from the already-filtered + sorted set
                  const morningOrders = sortedOrders.filter(o => o.deliveryWindow === "morning");
                  const afternoonOrders = sortedOrders.filter(o => o.deliveryWindow === "afternoon");
                  const eitherOrders = sortedOrders.filter(o => o.deliveryWindow === "any");
                  const unscheduledOrders = sortedOrders.filter(o => !o.deliveryWindow || (o.deliveryWindow !== "morning" && o.deliveryWindow !== "afternoon" && o.deliveryWindow !== "any"));
                  const morningTotal = morningOrders.reduce((sum, o) => sum + o.total, 0);
                  const afternoonTotal = afternoonOrders.reduce((sum, o) => sum + o.total, 0);
                  const eitherTotal = eitherOrders.reduce((sum, o) => sum + o.total, 0);
                  const unscheduledTotal = unscheduledOrders.reduce((sum, o) => sum + o.total, 0);

                  return (
                <div className="rounded-xl bg-surface shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-primary/5 px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-secondary" />
                      <h3 className="font-bold text-primary">Customers</h3>
                      <span className="text-xs text-muted">({filteredOrders.length}{filteredOrders.length !== allOrders.length ? ` of ${allOrders.length}` : ""})</span>
                    </div>
                  </div>
                  {[
                    { label: "Morning", subLabel: "9am-1pm", orders: morningOrders, total: morningTotal },
                    { label: "Afternoon", subLabel: "1pm-5pm", orders: afternoonOrders, total: afternoonTotal },
                    { label: "Either", subLabel: "I don't mind", orders: eitherOrders, total: eitherTotal },
                    { label: "Unscheduled", subLabel: "No window set", orders: unscheduledOrders, total: unscheduledTotal },
                  ].filter(g => g.orders.length > 0).map((group) => (
                    <div key={group.label}>
                      <div className="bg-primary/5 px-3 sm:px-6 py-2 flex items-center justify-between border-b border-primary/5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-primary">{group.label}</span>
                          <span className="text-xs text-muted">{group.subLabel}</span>
                        </div>
                        <span className="text-xs text-muted">
                          {group.orders.length} order{group.orders.length !== 1 ? "s" : ""} · £{group.total.toFixed(2)}
                        </span>
                      </div>
                      <div className="divide-y divide-primary/5">
                    {group.orders.map((order) => {
                      const key = `customer-${order.id}`;
                      const isExpanded = expandedCustomers.has(key);
                      const status = statusConfig[order.status];
                      const hasBox = boxStatuses.get(order.userId);
                      const nextStatus = statusProgression[order.status];
                      const orderRefunds = refunds.get(order.id) || [];
                      const totalRefunded = orderRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                      
                      return (
                        <div key={order.id}>
                          {/* Main row - larger for mobile */}
                          <div
                            onClick={() => toggleExpand(key)}
                            className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 px-3 sm:px-6 py-4 cursor-pointer hover:bg-primary/5 transition"
                          >
                            {/* Box number (weekly), order # small underneath */}
                            <div className="w-12 sm:w-16 flex-shrink-0">
                              <span className="font-bold text-primary text-lg">{order.boxNumber ?? "?"}</span>
                              <span className="block text-[10px] text-muted">#{order.orderNumber}</span>
                              {totalRefunded > 0 && (
                                <span className="block text-[10px] text-red-600 font-medium">-£{totalRefunded.toFixed(2)}</span>
                              )}
                            </div>
                            
                            {/* Customer info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-primary flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="truncate">{order.customerName || order.customerEmail?.split("@")[0] || "—"}</span>
                                <OrderCount seq={orderSequence.get(order.id) ?? 1} />
                                {(() => {
                                  const open = (issuesByOrder.get(order.id) ?? []).filter(i => i.status === "open");
                                  if (open.length === 0) return null;
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800"
                                      title={open.map(i => `${i.productName}: ${orderIssueConfig[i.issueType]?.label}`).join(" · ")}
                                    >
                                      <AlertTriangle size={10} />
                                      Reported a problem
                                    </span>
                                  );
                                })()}
                              </p>
                              <p className="text-sm text-muted truncate">{formatAddressOneLine(order)}</p>
                            </div>
                            
                            {/* Window pill */}
                            <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
                              {order.deliveryWindow && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${order.deliveryWindow === "morning" ? "bg-amber-100 text-amber-700" : order.deliveryWindow === "afternoon" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                                  {order.deliveryWindow === "morning" ? "9–1" : order.deliveryWindow === "afternoon" ? "1–5" : "Any"}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                                {order.deliveryOption === "in" ? (
                                  <><Home size={10} /> In</>
                                ) : order.deliveryOption === "own_coolbag" ? (
                                  <><MapPin size={10} /> Own</>
                                ) : order.deliveryOption === "local_coolbox" ? (
                                  <><Package size={10} /> Local box</>
                                ) : order.willBeIn ? (
                                  <><Home size={10} /> In</>
                                ) : (
                                  <><MapPin size={10} /> Safe</>
                                )}
                              </span>
                            </div>
                            
                            {/* Box pill */}
                            <div className="block w-16 flex-shrink-0 text-center">
                              {order.boxDepositPaid && !hasBox ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  <Package size={10} />
                                  🆕 New
                                </span>
                              ) : hasBox ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  <Package size={10} />
                                  🔄 Swap
                                </span>
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </div>
                            
                            {/* Status dropdown */}
                            <div className="w-full sm:w-24 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={order.status}
                                onChange={(e) => updateStatus(order.id, e.target.value as Order["status"])}
                                className={`w-full appearance-none cursor-pointer rounded-full min-h-[44px] sm:min-h-0 px-3 sm:px-2 py-1 text-sm sm:text-xs font-semibold border-0 outline-none ${status.color}`}
                              >
                                {statusOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {statusConfig[s].label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Action button */}
                            <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              {nextStatus ? (
                                <button
                                  onClick={() => advanceStatus(order.id)}
                                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg bg-secondary px-3 py-2.5 sm:py-2 text-sm font-semibold text-white hover:bg-secondary/90 transition"
                                  title={`Advance to ${statusConfig[nextStatus].label}`}
                                >
                                  <Play size={14} />
                                  <span className="sm:inline">{statusConfig[nextStatus].label}</span>
                                </button>
                              ) : (
                                <span className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-2.5 sm:py-2 text-sm font-semibold text-gray-400">
                                  <CheckCircle size={14} />
                                  <span className="sm:inline">Done</span>
                                </span>
                              )}

                              {/* Cancel button - visible on mobile */}
                              <button
                                onClick={() => updateStatus(order.id, "cancelled")}
                                className="sm:hidden inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                              >
                                Cancel
                              </button>

                              {/* More menu for cancel (sm+) */}
                              <div className="relative hidden sm:block">
                                <button
                                  onClick={() => setActionMenuOpen(actionMenuOpen === order.id ? null : order.id)}
                                  className="p-2 text-muted hover:text-primary transition"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {actionMenuOpen === order.id && (
                                  <div className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-surface shadow-lg border border-primary/10 py-1 z-10">
                                    <button
                                      onClick={() => {
                                        updateStatus(order.id, "cancelled");
                                        setActionMenuOpen(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition"
                                    >
                                      Cancel Order
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="bg-primary/5 px-3 sm:px-6 py-4">
                              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-semibold text-muted uppercase mb-2">Order Items</h4>
                                  <div className="space-y-3">
                                    {groupItemsBySupplier(order.items).map((supplierGroup) => (
                                      <div key={supplierGroup.supplierId} className="rounded-lg border border-primary/10 bg-surface overflow-hidden">
                                        <div className="px-3 py-2 border-b border-primary/10">
                                          <span className="font-medium text-sm text-primary">{supplierGroup.supplierName}</span>
                                        </div>
                                        <div className="divide-y divide-primary/5">
                                          {supplierGroup.items.map((item, i) => {
                                            const itemRefunds = orderRefunds.filter(r => r.productName === item.productName);
                                            const itemRefunded = itemRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                                            const itemNotComing = itemRefunds.some(r => !r.itemArrived);
                                            return (
                                              <div key={i} className={`px-3 py-2 ${itemNotComing ? 'bg-red-50' : ''}`} onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                      <p className={`text-sm break-words ${itemNotComing ? 'text-red-400 line-through' : 'text-primary'}`}>{item.productName}</p>
                                                      {itemNotComing && (
                                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                                          Not coming
                                                        </span>
                                                      )}
                                                    </div>
                                                    {item.unit && <p className={`text-xs ${itemNotComing ? 'text-red-300' : 'text-muted'}`}>{item.unit}</p>}
                                                  </div>
                                                  <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className={`text-sm font-medium ${itemNotComing ? 'text-red-400 line-through' : 'text-primary'}`}>×{item.quantity} = £{(item.quantity * item.price).toFixed(2)}</span>
                                                    {itemRefunded > 0 ? (
                                                      <div className="flex items-center gap-1">
                                                        <span className="text-xs text-red-600 font-medium">-£{itemRefunded.toFixed(2)}</span>
                                                        <button
                                                          onClick={() => itemRefunds.forEach(r => handleDeleteRefund(r.id, order.id))}
                                                          className="text-red-400 hover:text-red-600"
                                                          title="Remove refund"
                                                        >
                                                          <XCircle size={12} />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <button
                                                        onClick={() => {
                                                          setRefundModal({ orderId: order.id, orderNumber: order.orderNumber, productName: item.productName, price: item.price, quantity: item.quantity, supplierId: supplierGroup.supplierId });
                                                          setRefundQty(item.quantity);
                                                          setRefundAmount((item.quantity * item.price).toFixed(2));
                                                        }}
                                                        className="text-xs text-muted hover:text-red-600 transition"
                                                      >
                                                        Refund
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-primary/20">
                                    <div className="flex justify-between">
                                      <span className="font-semibold text-primary">Subtotal</span>
                                      <span className="font-bold text-primary">£{order.total.toFixed(2)}</span>
                                    </div>
                                    {totalRefunded > 0 && (
                                      <>
                                        <div className="flex justify-between text-red-600">
                                          <span className="text-sm">Refunds</span>
                                          <span className="text-sm font-medium">-£{totalRefunded.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between mt-1 pt-1 border-t border-primary/10">
                                          <span className="font-semibold text-primary">Net Total</span>
                                          <span className="font-bold text-primary">£{(order.total - totalRefunded).toFixed(2)}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="w-full sm:w-64 flex-shrink-0">
                                  <h4 className="text-xs font-semibold text-muted uppercase mb-2">Delivery Details</h4>
                                  {order.address && (
                                    <p className="text-sm text-primary mb-2">
                                      {order.address.addressLine1}<br />
                                      {order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}
                                      {order.address.city}, {order.address.postcode}
                                    </p>
                                  )}
                                  {order.deliveryWindow && (
                                    <p className="text-sm text-muted mb-2">
                                      Window: {order.deliveryWindow === "morning" ? "9am – 1pm" : order.deliveryWindow === "afternoon" ? "1pm – 5pm" : "I don't mind"}
                                    </p>
                                  )}
                                  {order.deliveryOption && (
                                    <p className="text-sm text-muted mb-2">
                                      <Home size={12} className="inline mr-1" />
                                      {DELIVERY_OPTION_LABELS[order.deliveryOption]}
                                    </p>
                                  )}
                                  {order.safePlace && (
                                    <p className="text-xs text-secondary">
                                      <MapPin size={12} className="inline mr-1" />
                                      {order.safePlace}
                                    </p>
                                  )}
                                  {order.instructions && (
                                    <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded px-2 py-1">
                                      📍 {order.instructions}
                                    </p>
                                  )}
                                  {order.pinLat && order.pinLng && (
                                    <a
                                      href={`https://www.google.com/maps?q=${order.pinLat},${order.pinLng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 mt-1"
                                    >
                                      <MapPin size={10} />
                                      View pin on map
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                    </div>
                  ))}
                </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRefundModal(null)}>
          <div className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary mb-4">Issue Refund</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted">Order #{refundModal.orderNumber}</p>
                <p className="font-medium text-primary">{refundModal.productName}</p>
                <p className="text-sm text-muted">
                  {refundModal.quantity} × £{refundModal.price.toFixed(2)} = £{(refundModal.quantity * refundModal.price).toFixed(2)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">How many?</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={refundModal.quantity}
                      value={refundQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        const qty = isNaN(val) ? 1 : Math.max(1, Math.min(refundModal.quantity, val));
                        setRefundQty(qty);
                        // Keep the amount in step with the quantity; still editable after.
                        setRefundAmount((qty * refundModal.price).toFixed(2));
                      }}
                      className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-center focus:border-secondary focus:outline-none"
                    />
                    <span className="text-sm text-muted whitespace-nowrap">of {refundModal.quantity}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">Refund Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={refundModal.quantity * refundModal.price}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={(refundQty * refundModal.price).toFixed(2)}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Reason</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(refundReasonConfig) as RefundReasonType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setRefundReasonType(type);
                        setRefundPaidBy(refundReasonConfig[type].defaultPaidBy);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${refundReasonType === type ? "bg-secondary text-white" : "border border-primary/20 text-muted hover:bg-primary/5"}`}
                    >
                      {refundReasonConfig[type].label}
                    </button>
                  ))}
                </div>
                {!refundReasonConfig[refundReasonType].itemArrived && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                    ⚠️ &quot;Didn&apos;t arrive&quot; means it never reached the warehouse — the supplier isn&apos;t paid for it, so no deduction applies. If it was checked in but missed the customer&apos;s box, use &quot;Missing from box&quot; instead so who-pays works properly.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Note to customer (optional - included in the refund emails)</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g., 1x garlic bulb missing"
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                />
              </div>
              {refundReasonConfig[refundReasonType].itemArrived && (
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">Who pays?</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundPaidBy("local")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${refundPaidBy === "local" ? "bg-primary text-white" : "border border-primary/20 text-muted hover:bg-primary/5"}`}
                    >
                      Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundPaidBy("supplier")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${refundPaidBy === "supplier" ? "bg-primary text-white" : "border border-primary/20 text-muted hover:bg-primary/5"}`}
                    >
                      Supplier
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundPaidBy("50-50")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${refundPaidBy === "50-50" ? "bg-primary text-white" : "border border-primary/20 text-muted hover:bg-primary/5"}`}
                    >
                      50-50
                    </button>
                  </div>
                </div>
              )}
              {refundError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {refundError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setRefundModal(null); setRefundError(null); }}
                  disabled={refundLoading}
                  className="flex-1 rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-primary/5 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRefund}
                  disabled={!refundAmount || parseFloat(refundAmount) <= 0 || refundLoading}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refundLoading ? "Processing..." : "Issue Refund via Stripe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
