"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Order, type OrderItem, type DeliveryStockTracking, type OrderItemRefund, type OrderItemCheckin, type RefundPaidBy, getOrders, getDeliveryStockTracking, upsertDeliveryStockTracking, getRefundsForDeliveryDay, getOrderItemCheckins, toggleOrderItemCheckin } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, Truck, AlertTriangle, FileText, Mail, Download, Send } from "lucide-react";

const refundReasonConfig: Record<string, { label: string }> = {
  didnt_arrive: { label: "Didn't arrive" },
  quality: { label: "Quality issue" },
  damaged: { label: "Damaged in transit" },
  changed_mind: { label: "Customer changed mind" },
  other: { label: "Other" },
};

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
  items: Array<{ productName: string; unit: string; quantity: number }>;
}

interface SupplierSummary {
  supplierId: string;
  supplierName: string;
  totalItems: number;
  totalPrice: number;
  items: Array<{ productName: string; unit: string; quantity: number; price: number }>;
  orders: SupplierOrderItems[];
}

function getSupplierSummaries(orders: Order[]): SupplierSummary[] {
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
      const itemKey = `${item.productName}|${item.unit || ""}`;
      const existing = summary.items.find(i => `${i.productName}|${i.unit || ""}` === itemKey);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        summary.items.push({ productName: item.productName, unit: item.unit, quantity: item.quantity, price: item.price });
      }
      let orderEntry = summary.orders.find(o => o.orderId === order.id);
      if (!orderEntry) {
        orderEntry = { orderId: order.id, orderNumber: order.orderNumber, items: [] };
        summary.orders.push(orderEntry);
      }
      orderEntry.items.push({ productName: item.productName, unit: item.unit, quantity: item.quantity });
    }
  }
  for (const summary of map.values()) {
    summary.orders.sort((a, b) => a.orderNumber - b.orderNumber);
  }
  return Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export default function AdminStockPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  
  const [stockTracking, setStockTracking] = useState<Map<string, DeliveryStockTracking>>(new Map());
  const [orderCheckins, setOrderCheckins] = useState<Map<string, OrderItemCheckin>>(new Map());
  const [refunds, setRefunds] = useState<Map<string, OrderItemRefund[]>>(new Map());
  const [payoutModal, setPayoutModal] = useState<string | null>(null);
  const [sendingPayouts, setSendingPayouts] = useState(false);
  const [sendingSummaries, setSendingSummaries] = useState<string | null>(null);

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
    }
    setStockTracking(trackingMap);
    setOrderCheckins(checkinsMap);
    setRefunds(refundsMap);
  }, []);

  useEffect(() => {
    getOrders().then(async (orders) => {
      setOrderList(orders);
      const deliveryDays = [...new Set(orders.map(o => o.deliveryDay).filter(Boolean))];
      await loadTrackingData(deliveryDays);
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
    supplierId: string,
    items: Array<{ productName: string; quantity: number }>
  ) => {
    for (const item of items) {
      await upsertDeliveryStockTracking(deliveryDay, supplierId, item.productName, item.quantity, item.quantity, null);
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
    // Stock: X/Y where Y = distinct products, X = products with quantityArrived >= quantityOrdered
    const distinctProducts = supplier.items.length;
    let arrivedProducts = 0;
    let hasAnyArrival = false;
    for (const item of supplier.items) {
      const tracking = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
      if (tracking?.quantityArrived !== null && tracking?.quantityArrived !== undefined) {
        hasAnyArrival = true;
        if (tracking.quantityArrived >= item.quantity) {
          arrivedProducts++;
        }
      }
    }
    
    // Bags: X/Y where Y = total order-line-items, X = checked in
    const totalBagItems = supplier.orders.reduce((sum, o) => sum + o.items.length, 0);
    let checkedInBagItems = 0;
    for (const orderEntry of supplier.orders) {
      for (const item of orderEntry.items) {
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
        const supplierSummaries = getSupplierSummaries(orders);

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
                {/* DAY SUMMARY */}
                {(() => {
                  // Only roll up shortages from suppliers where every item has been counted.
                  // While items are still "Not checked" (quantityArrived === null), the supplier
                  // isn't done yet and its partial state shouldn't fire alarms at the top.
                  const shortages: Array<{ supplierName: string; productName: string; short: number }> = [];
                  let suppliersComplete = 0;
                  for (const supplier of supplierSummaries) {
                    const trackings = supplier.items.map(item =>
                      stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`)
                    );
                    const allCounted = trackings.every(
                      t => t?.quantityArrived !== null && t?.quantityArrived !== undefined,
                    );
                    if (!allCounted) continue;
                    suppliersComplete++;
                    for (const item of supplier.items) {
                      const tracking = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
                      if (tracking && tracking.quantityArrived !== null && tracking.quantityArrived < item.quantity) {
                        shortages.push({ supplierName: supplier.supplierName, productName: item.productName, short: item.quantity - tracking.quantityArrived });
                      }
                    }
                  }
                  const dayRefunds = orders.flatMap(o => refunds.get(o.id) || []);
                  const totalRefunds = dayRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                  const totalSuppliers = supplierSummaries.length;
                  const allSuppliersDone = suppliersComplete === totalSuppliers;

                  if (shortages.length === 0 && totalRefunds === 0) return null;

                  return (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-6 py-4">
                      <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Day Summary - {allSuppliersDone ? "Issues" : `Check-in ${suppliersComplete}/${totalSuppliers} suppliers complete · ${shortages.length} shortage${shortages.length !== 1 ? "s" : ""} so far`}
                      </h3>
                      <div className="flex flex-wrap gap-6">
                        {shortages.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Stock Shortages</p>
                            <ul className="text-sm text-amber-800 space-y-0.5">
                              {shortages.map((s, i) => (
                                <li key={i}>• {s.supplierName}: {s.productName} (short by {s.short})</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {totalRefunds > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Refunds Issued</p>
                            <p className="text-sm text-amber-800">
                              {dayRefunds.length} refund{dayRefunds.length !== 1 ? "s" : ""} totalling <strong>£{totalRefunds.toFixed(2)}</strong>
                            </p>
                          </div>
                        )}
                      </div>
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
                      
                      // Stock pill color
                      let stockPillClass = "bg-gray-100 text-gray-600"; // grey when nothing arrived
                      if (pills.stock.hasAnyArrival) {
                        stockPillClass = pills.stock.arrived === pills.stock.total 
                          ? "bg-green-100 text-green-700" 
                          : "bg-amber-100 text-amber-700";
                      }
                      
                      // Bags pill color
                      const bagsPillClass = pills.bags.checkedIn === pills.bags.total && pills.bags.total > 0
                        ? "bg-green-100 text-green-700"
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
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockPillClass}`}>
                                Stock {pills.stock.arrived}/{pills.stock.total}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${bagsPillClass}`}>
                                Bags {pills.bags.checkedIn}/{pills.bags.total}
                              </span>
                              <span className="font-semibold text-primary">£{supplier.totalPrice.toFixed(2)}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="bg-primary/5 px-3 sm:px-6 py-4 space-y-4">
                              {/* STOCK ARRIVALS */}
                              <div className="rounded-lg border border-primary/10 bg-surface overflow-x-auto">
                                <div className="px-3 py-2 border-b border-primary/10 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted uppercase">Stock Arrivals</span>
                                  <div className="flex items-center gap-2">
                                    {supplier.items.every(item => {
                                      const tracking = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
                                      return tracking?.quantityArrived !== null && tracking?.quantityArrived !== undefined;
                                    }) ? (
                                      <span className="text-xs font-semibold text-green-600">✓ All checked in</span>
                                    ) : (
                                      <button
                                        onClick={() => handleMarkAllArrived(deliveryDay, supplier.supplierId, supplier.items)}
                                        className="text-xs font-medium text-secondary hover:text-secondary/80 transition"
                                      >
                                        Mark All Arrived
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <table className="w-full text-sm">
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
                                      const arrived = tracking?.quantityArrived;
                                      const hasOverride = tracking?.quantityArrivedOverride !== null && tracking?.quantityArrivedOverride !== undefined;
                                      const computedDiffers = hasOverride && tracking?.quantityArrivedComputed !== tracking?.quantityArrivedOverride;
                                      const hasShortage = arrived !== null && arrived !== undefined && arrived < item.quantity;
                                      const isComplete = arrived !== null && arrived !== undefined && arrived >= item.quantity;
                                      
                                      return (
                                        <tr key={`${item.productName}|${item.unit}`} className={`border-t border-primary/5 ${isComplete ? 'bg-green-50' : hasShortage ? 'bg-amber-50' : ''}`}>
                                          <td className="px-3 py-2">
                                            <span className="text-primary">{item.productName}</span>
                                            {item.unit && <span className="block text-xs text-muted">{item.unit}</span>}
                                          </td>
                                          <td className="px-3 py-2 text-center font-semibold text-primary">{item.quantity}</td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={item.quantity * 2}
                                                value={arrived ?? ""}
                                                placeholder="—"
                                                onChange={(e) => {
                                                  const val = e.target.value === "" ? null : parseInt(e.target.value);
                                                  handleArrivalUpdate(deliveryDay, supplier.supplierId, item.productName, item.quantity, val, tracking?.arrivalNotes ?? null);
                                                }}
                                                className="w-16 rounded border border-primary/20 px-2 py-1 text-center text-sm focus:border-secondary focus:outline-none"
                                              />
                                              {computedDiffers && (
                                                <span className="text-[10px] text-amber-600" title={`Computed from check-ins: ${tracking?.quantityArrivedComputed}`}>(override)</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            {arrived === null || arrived === undefined ? (
                                              <span className="text-xs text-muted">Not checked</span>
                                            ) : hasShortage ? (
                                              <div>
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                                  <AlertTriangle size={12} />
                                                  Short by {item.quantity - arrived}
                                                </span>
                                                <p className="text-[10px] text-amber-600 mt-0.5">
                                                  Affects: {supplier.orders
                                                    .filter(o => o.items.some(i => i.productName === item.productName))
                                                    .map(o => `#${o.orderNumber}`)
                                                    .join(", ")}
                                                </p>
                                              </div>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                                <CheckCircle size={12} />
                                                Complete
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* ORDER CHECK-IN */}
                              <div className={`rounded-lg border ${supplier.orders.every(o => o.items.every(item => isOrderItemCheckedIn(o.orderId, supplier.supplierId, item.productName))) ? 'border-green-300 bg-green-50' : 'border-primary/10 bg-surface'} overflow-hidden`}>
                                <div className="px-3 py-2 border-b border-primary/10 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted uppercase">Order Check-in (per-customer bags)</span>
                                  {supplier.orders.every(o => o.items.every(item => isOrderItemCheckedIn(o.orderId, supplier.supplierId, item.productName))) && (
                                    <span className="text-xs font-semibold text-green-600">✓ Complete</span>
                                  )}
                                </div>
                                <div className="divide-y divide-primary/5">
                                  {supplier.orders.map((orderEntry) => {
                                    const allItemsChecked = orderEntry.items.every(item => 
                                      isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, item.productName)
                                    );
                                    return (
                                      <div key={orderEntry.orderId} className={`${allItemsChecked ? 'bg-green-50' : ''}`}>
                                        <div className="px-3 py-2 flex items-center justify-between">
                                          <span className={`font-medium ${allItemsChecked ? 'text-green-700' : 'text-primary'}`}>Order #{orderEntry.orderNumber}</span>
                                          {allItemsChecked && <span className="text-xs text-green-600">✓</span>}
                                        </div>
                                        <div className="px-3 pb-2 space-y-1">
                                          {orderEntry.items.map((item, i) => {
                                            const isItemChecked = isOrderItemCheckedIn(orderEntry.orderId, supplier.supplierId, item.productName);
                                            return (
                                              <label key={i} className="flex items-center gap-2 cursor-pointer pl-2">
                                                <input
                                                  type="checkbox"
                                                  checked={isItemChecked}
                                                  onChange={() => handleOrderCheckIn(deliveryDay, supplier.supplierId, orderEntry.orderId, item.productName, item.quantity)}
                                                  className="w-3.5 h-3.5 rounded border-primary/30 text-green-600 focus:ring-green-500"
                                                />
                                                <span className={`text-sm ${isItemChecked ? 'text-green-600 line-through' : 'text-muted'}`}>
                                                  {formatItemLine(item.productName, item.unit, item.quantity)}
                                                </span>
                                              </label>
                                            );
                                          })}
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
          
          return {
            ...supplier,
            tracking: supplierTracking,
            supplierRefunds,
            supplierRefundDeduction,
            orderedTotal,
            arrivedTotal,
            payout,
          };
        });
        
        const totalPayout = payouts.reduce((sum, p) => sum + p.payout, 0);
        
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
                            const isShort = item.arrived !== null && arrived < item.ordered;
                            return (
                              <tr key={item.productName} className={`border-t border-primary/5 ${isShort ? 'bg-amber-50' : ''}`}>
                                <td className="px-4 py-2 text-primary">{item.productName}</td>
                                <td className="px-4 py-2 text-center">{item.ordered}</td>
                                <td className={`px-4 py-2 text-center font-medium ${isShort ? 'text-amber-600' : 'text-green-600'}`}>
                                  {item.arrived ?? '—'}
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
              <div className="px-6 py-4 border-t border-primary/10 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-primary">Total Payouts:</span>
                  <span className="text-xl font-bold text-green-600">£{totalPayout.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
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
                            (item.arrived ?? "—").toString(),
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
    </div>
  );
}
