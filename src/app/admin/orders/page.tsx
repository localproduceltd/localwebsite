"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Order, type OrderItem, type DeliveryStockTracking, type OrderItemRefund, type RefundPaidBy, type RefundReasonType, getOrders, updateOrderStatus, getCustomerBoxStatuses, getDeliveryStockTracking, upsertDeliveryStockTracking, getRefundsForDeliveryDay, deleteOrderItemRefund } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, Home, MapPin, Download, Users, Truck, AlertTriangle, RefreshCw, FileText, Mail } from "lucide-react";

const statusConfig = {
  ordered: { label: "Ordered", icon: Clock, color: "text-amber-600 bg-amber-50" },
  prepped: { label: "Prepped", icon: Package, color: "text-blue-600 bg-blue-50" },
  next_hour: { label: "Next Hour", icon: Truck, color: "text-purple-600 bg-purple-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

const statusOptions: Order["status"][] = ["ordered", "prepped", "next_hour", "delivered", "cancelled"];

const refundReasonConfig: Record<RefundReasonType, { label: string; itemArrived: boolean; defaultPaidBy: RefundPaidBy }> = {
  didnt_arrive: { label: "Didn't arrive", itemArrived: false, defaultPaidBy: "supplier" }, // Always stored as "supplier" for records
  quality: { label: "Quality issue", itemArrived: true, defaultPaidBy: "supplier" },
  damaged: { label: "Damaged in transit", itemArrived: true, defaultPaidBy: "50-50" },
  changed_mind: { label: "Customer changed mind", itemArrived: true, defaultPaidBy: "local" },
  other: { label: "Other", itemArrived: true, defaultPaidBy: "local" },
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

interface SupplierOrderItems {
  orderId: string;
  orderNumber: number;
  items: Array<{ productName: string; quantity: number }>;
}

interface SupplierSummary {
  supplierId: string;
  supplierName: string;
  totalItems: number;
  totalPrice: number;
  items: Array<{ productName: string; quantity: number; price: number }>;
  orders: SupplierOrderItems[];
}

function getSupplierSummaries(orders: Order[]): SupplierSummary[] {
  const map = new Map<string, SupplierSummary>();
  for (const order of orders) {
    for (const item of order.items) {
      const id = item.supplierId || "unknown";
      const name = item.supplierName || "Unknown Supplier";
      if (!map.has(id)) {
        map.set(id, { supplierId: id, supplierName: name, totalItems: 0, totalPrice: 0, items: [], orders: [] });
      }
      const summary = map.get(id)!;
      summary.totalItems += item.quantity;
      summary.totalPrice += item.quantity * item.price;
      const existing = summary.items.find(i => i.productName === item.productName);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        summary.items.push({ productName: item.productName, quantity: item.quantity, price: item.price });
      }
      // Track per-order items for this supplier
      let orderEntry = summary.orders.find(o => o.orderId === order.id);
      if (!orderEntry) {
        orderEntry = { orderId: order.id, orderNumber: order.orderNumber, items: [] };
        summary.orders.push(orderEntry);
      }
      orderEntry.items.push({ productName: item.productName, quantity: item.quantity });
    }
  }
  // Sort orders by order number
  for (const summary of map.values()) {
    summary.orders.sort((a, b) => a.orderNumber - b.orderNumber);
  }
  return Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

function formatAddress(order: Order): string {
  if (!order.address) return "—";
  const parts = [order.address.addressLine1];
  if (order.address.addressLine2) parts.push(order.address.addressLine2);
  parts.push(order.address.city, order.address.postcode);
  return parts.join(", ");
}

function exportCustomersCSV(orders: Order[], boxStatuses: Map<string, boolean>, deliveryDate: string) {
  const headers = ["Order #", "Email", "Name", "Created", "Address Line 1", "Address Line 2", "City", "Postcode", "Delivery Window", "Will Be In", "Safe Place", "Box Action"];
  const rows = orders.map(o => {
    const hasBox = boxStatuses.get(o.userId) ?? false;
    const boxAction = o.boxDepositPaid && !hasBox ? "New" : hasBox ? "Swap" : "";
    return [
      o.orderNumber.toString(),
      o.customerEmail || "",
      o.customerName || "",
      o.createdAt,
      o.address?.addressLine1 || "",
      o.address?.addressLine2 || "",
      o.address?.city || "",
      o.address?.postcode || "",
      o.deliveryWindow === "morning" ? "9am-1pm" : o.deliveryWindow === "afternoon" ? "1pm-5pm" : "",
      o.willBeIn ? "Yes" : "No",
      o.safePlace || "",
      boxAction,
    ];
  });
  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customers-${deliveryDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

export default function AdminOrdersPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [boxStatuses, setBoxStatuses] = useState<Map<string, boolean>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set());
  const [orderCheckedIn, setOrderCheckedIn] = useState<Set<string>>(new Set());
  
  // Persistent tracking data
  const [stockTracking, setStockTracking] = useState<Map<string, DeliveryStockTracking>>(new Map());
  const [refunds, setRefunds] = useState<Map<string, OrderItemRefund[]>>(new Map());
  const [refundModal, setRefundModal] = useState<{ orderId: string; orderNumber: number; productName: string; price: number; quantity: number; supplierId: string } | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReasonType, setRefundReasonType] = useState<RefundReasonType>("didnt_arrive");
  const [refundReason, setRefundReason] = useState("");
  const [refundPaidBy, setRefundPaidBy] = useState<RefundPaidBy>("supplier");
  const [payoutModal, setPayoutModal] = useState<string | null>(null); // delivery day
  const [sendingPayouts, setSendingPayouts] = useState(false);

  const toggleSet = useCallback((setName: "packed" | "order", key: string) => {
    const setter = setName === "packed" ? setPackedItems : setOrderCheckedIn;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Handle order check-in with stock arrivals sync
  const handleOrderCheckIn = async (
    deliveryDay: string,
    supplierId: string,
    orderId: string,
    itemIndex: number,
    productName: string,
    quantity: number,
    totalOrderedForProduct: number
  ) => {
    const itemKey = `order-${deliveryDay}-${supplierId}-${orderId}-${itemIndex}`;
    const isCurrentlyChecked = orderCheckedIn.has(itemKey);
    
    // Toggle the checkbox
    setOrderCheckedIn(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
    
    // Calculate new arrived quantity based on all checked items for this product
    const trackingKey = `${deliveryDay}-${supplierId}-${productName}`;
    const currentTracking = stockTracking.get(trackingKey);
    const currentArrived = currentTracking?.quantityArrived ?? 0;
    
    // If checking, add quantity; if unchecking, subtract
    const newArrived = isCurrentlyChecked 
      ? Math.max(0, currentArrived - quantity)
      : currentArrived + quantity;
    
    // Update stock tracking
    await upsertDeliveryStockTracking(deliveryDay, supplierId, productName, totalOrderedForProduct, newArrived, null);
    
    // Refresh tracking data
    const tracking = await getDeliveryStockTracking(deliveryDay);
    setStockTracking(prev => {
      const next = new Map(prev);
      for (const t of tracking) {
        next.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      return next;
    });
  };

  const toggleExpand = useCallback((set: "suppliers" | "customers", key: string) => {
    const setter = set === "suppliers" ? setExpandedSuppliers : setExpandedCustomers;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const loadTrackingData = useCallback(async (deliveryDays: string[]) => {
    const trackingMap = new Map<string, DeliveryStockTracking>();
    const refundsMap = new Map<string, OrderItemRefund[]>();
    
    for (const day of deliveryDays) {
      const tracking = await getDeliveryStockTracking(day);
      for (const t of tracking) {
        trackingMap.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      const dayRefunds = await getRefundsForDeliveryDay(day);
      for (const r of dayRefunds) {
        const key = r.orderId;
        if (!refundsMap.has(key)) refundsMap.set(key, []);
        refundsMap.get(key)!.push(r);
      }
    }
    setStockTracking(trackingMap);
    setRefunds(refundsMap);
  }, []);

  useEffect(() => {
    getOrders().then(async (orders) => {
      setOrderList(orders);
      const userIds = [...new Set(orders.map(o => o.userId))];
      const statuses = await getCustomerBoxStatuses(userIds);
      setBoxStatuses(statuses);
      
      // Load tracking data for all delivery days
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
    // Refresh tracking data
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
    // Mark all items as arrived with full quantity
    for (const item of items) {
      await upsertDeliveryStockTracking(deliveryDay, supplierId, item.productName, item.quantity, item.quantity, null);
    }
    // Refresh tracking data
    const tracking = await getDeliveryStockTracking(deliveryDay);
    setStockTracking(prev => {
      const next = new Map(prev);
      for (const t of tracking) {
        next.set(`${t.deliveryDay}-${t.supplierId}-${t.productName}`, t);
      }
      return next;
    });
  };

  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const handleCreateRefund = async () => {
    if (!refundModal) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    setRefundLoading(true);
    setRefundError(null);
    
    // Get itemArrived from reason type config
    const reasonConfig = refundReasonConfig[refundReasonType];
    const itemArrived = reasonConfig.itemArrived;
    
    try {
      const response = await fetch("/api/refund-order-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: refundModal.orderId,
          productName: refundModal.productName,
          quantity: refundModal.quantity,
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
      
      // Refresh refunds for this order
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
      
      // Show warning if manual Stripe refund is needed
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

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    const order = orderList.find((o) => o.id === orderId);
    await updateOrderStatus(orderId, newStatus);
    const updated = await getOrders();
    setOrderList(updated);

    // Send status update emails for prepped, next_hour, delivered, cancelled
    if (order && order.customerEmail && ["prepped", "next_hour", "delivered", "cancelled"].includes(newStatus)) {
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

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary">Order Management</h1>
      <p className="mt-1 text-muted">{orderList.length} total orders</p>

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
                  // Calculate shortages
                  const shortages: Array<{ supplierName: string; productName: string; short: number }> = [];
                  for (const supplier of supplierSummaries) {
                    for (const item of supplier.items) {
                      const tracking = stockTracking.get(`${deliveryDay}-${supplier.supplierId}-${item.productName}`);
                      if (tracking?.quantityArrived !== null && tracking?.quantityArrived !== undefined && tracking.quantityArrived < item.quantity) {
                        shortages.push({ supplierName: supplier.supplierName, productName: item.productName, short: item.quantity - tracking.quantityArrived });
                      }
                    }
                  }
                  // Calculate refunds for this day
                  const dayRefunds = orders.flatMap(o => refunds.get(o.id) || []);
                  const totalRefunds = dayRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                  
                  if (shortages.length === 0 && totalRefunds === 0) return null;
                  
                  return (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-6 py-4">
                      <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Day Summary - Issues
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
                    <button
                      onClick={() => setPayoutModal(deliveryDay)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                    >
                      <FileText size={14} />
                      Supplier Payouts
                    </button>
                  </div>
                  <div className="divide-y divide-primary/5">
                    {supplierSummaries.map((supplier) => {
                      const key = `supplier-${deliveryDay}-${supplier.supplierId}`;
                      const isExpanded = expandedSuppliers.has(key);
                      return (
                        <div key={supplier.supplierId}>
                          <button
                            onClick={() => toggleExpand("suppliers", key)}
                            className="flex w-full items-center justify-between px-3 sm:px-6 py-3 text-left hover:bg-primary/5 transition"
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              {isExpanded ? <ChevronDown size={16} className="text-muted flex-shrink-0" /> : <ChevronRight size={16} className="text-muted flex-shrink-0" />}
                              <span className="font-medium text-primary truncate">{supplier.supplierName}</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 text-sm flex-shrink-0">
                              <span className="text-muted hidden sm:inline">{supplier.totalItems} items</span>
                              <span className="font-semibold text-primary">£{supplier.totalPrice.toFixed(2)}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="bg-primary/5 px-3 sm:px-6 py-4 space-y-4">
                              {/* STOCK ARRIVALS - Persistent tracking */}
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
                                      const hasShortage = arrived !== null && arrived !== undefined && arrived < item.quantity;
                                      const isComplete = arrived !== null && arrived !== undefined && arrived >= item.quantity;
                                      
                                      return (
                                        <tr key={item.productName} className={`border-t border-primary/5 ${isComplete ? 'bg-green-50' : hasShortage ? 'bg-amber-50' : ''}`}>
                                          <td className="px-3 py-2 text-primary">{item.productName}</td>
                                          <td className="px-3 py-2 text-center font-semibold text-primary">{item.quantity}</td>
                                          <td className="px-3 py-2 text-center">
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

                              {/* ORDER CHECK-IN - Session-based for packing */}
                              <div className={`rounded-lg border ${supplier.orders.every(o => o.items.every((_, i) => orderCheckedIn.has(`order-${deliveryDay}-${supplier.supplierId}-${o.orderId}-${i}`))) ? 'border-green-300 bg-green-50' : 'border-primary/10 bg-surface'} overflow-hidden`}>
                                <div className="px-3 py-2 border-b border-primary/10 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted uppercase">Order Check-in (per-customer bags)</span>
                                  {supplier.orders.every(o => o.items.every((_, i) => orderCheckedIn.has(`order-${deliveryDay}-${supplier.supplierId}-${o.orderId}-${i}`))) && (
                                    <span className="text-xs font-semibold text-green-600">✓ Complete</span>
                                  )}
                                </div>
                                <div className="divide-y divide-primary/5">
                                  {supplier.orders.map((orderEntry) => {
                                    const allItemsChecked = orderEntry.items.every((_, i) => 
                                      orderCheckedIn.has(`order-${deliveryDay}-${supplier.supplierId}-${orderEntry.orderId}-${i}`)
                                    );
                                    return (
                                      <div key={orderEntry.orderId} className={`${allItemsChecked ? 'bg-green-50' : ''}`}>
                                        <div className="px-3 py-2 flex items-center justify-between">
                                          <span className={`font-medium ${allItemsChecked ? 'text-green-700' : 'text-primary'}`}>Order #{orderEntry.orderNumber}</span>
                                          {allItemsChecked && <span className="text-xs text-green-600">✓</span>}
                                        </div>
                                        <div className="px-3 pb-2 space-y-1">
                                          {orderEntry.items.map((item, i) => {
                                            const itemKey = `order-${deliveryDay}-${supplier.supplierId}-${orderEntry.orderId}-${i}`;
                                            const isItemChecked = orderCheckedIn.has(itemKey);
                                            const totalOrderedForProduct = supplier.items.find(si => si.productName === item.productName)?.quantity ?? item.quantity;
                                            return (
                                              <label key={i} className="flex items-center gap-2 cursor-pointer pl-2">
                                                <input
                                                  type="checkbox"
                                                  checked={isItemChecked}
                                                  onChange={() => handleOrderCheckIn(deliveryDay, supplier.supplierId, orderEntry.orderId, i, item.productName, item.quantity, totalOrderedForProduct)}
                                                  className="w-3.5 h-3.5 rounded border-primary/30 text-green-600 focus:ring-green-500"
                                                />
                                                <span className={`text-sm ${isItemChecked ? 'text-green-600 line-through' : 'text-muted'}`}>
                                                  {item.productName} x{item.quantity}
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

                {/* CUSTOMERS SECTION */}
                <div className="rounded-xl bg-surface shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-primary/5 px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-secondary" />
                      <h3 className="font-bold text-primary">Customers</h3>
                      <span className="text-xs text-muted">({orders.length})</span>
                    </div>
                    <button
                      onClick={() => exportCustomersCSV(orders, boxStatuses, deliveryDay)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/20 px-2 sm:px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/30 transition"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">Export CSV</span>
                    </button>
                  </div>
                  <div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted border-b border-primary/5">
                          <th className="px-2 sm:px-4 py-3 font-medium">#</th>
                          <th className="px-2 sm:px-4 py-3 font-medium">Customer</th>
                          <th className="px-2 sm:px-4 py-3 font-medium hidden lg:table-cell">Created</th>
                          <th className="px-2 sm:px-4 py-3 font-medium hidden lg:table-cell">Address</th>
                          <th className="px-2 sm:px-4 py-3 font-medium text-center hidden lg:table-cell">Box</th>
                          <th className="px-2 sm:px-4 py-3 font-medium text-center hidden sm:table-cell">Delivery</th>
                          <th className="px-2 sm:px-4 py-3 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {orders.map((order) => {
                          const key = `customer-${order.id}`;
                          const isExpanded = expandedCustomers.has(key);
                          const status = statusConfig[order.status];
                          const StatusIcon = status.icon;
                          const hasBox = boxStatuses.get(order.userId);
                          return (
                            <>
                              <tr
                                key={order.id}
                                onClick={() => toggleExpand("customers", key)}
                                className="cursor-pointer hover:bg-primary/5 transition"
                              >
                                <td className="px-2 sm:px-4 py-3">
                                  <span className="font-semibold text-primary">{order.orderNumber}</span>
                                  {(() => {
                                    const orderRefunds = refunds.get(order.id) || [];
                                    const totalRefunded = orderRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                                    if (totalRefunded > 0) {
                                      return (
                                        <span className="ml-1 sm:ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600" title={`Refund: £${totalRefunded.toFixed(2)}`}>
                                          -£{totalRefunded.toFixed(2)}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </td>
                                <td className="px-2 sm:px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                                    <div className="min-w-0">
                                      <p className="font-medium text-primary truncate">{order.customerName || "—"}</p>
                                      <p className="text-xs text-muted truncate max-w-[120px] sm:max-w-none">{order.customerEmail}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-muted hidden lg:table-cell">{order.createdAt}</td>
                                <td className="px-2 sm:px-4 py-3 text-muted max-w-[200px] truncate hidden lg:table-cell" title={formatAddress(order)}>
                                  {formatAddress(order)}
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center hidden lg:table-cell">
                                  {(() => {
                                    // Box action logic:
                                    // - "new": paid deposit, no existing box → drop off only
                                    // - "swap": has existing box → drop off + collect old one
                                    // - null: no box involved
                                    if (order.boxDepositPaid && !hasBox) {
                                      return (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700" title="New box - drop off only">
                                          <Package size={10} />
                                          🆕 New
                                        </span>
                                      );
                                    }
                                    if (hasBox) {
                                      return (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700" title="Swap - drop off new, collect old">
                                          <Package size={10} />
                                          � Swap
                                        </span>
                                      );
                                    }
                                    return <span className="text-xs text-muted">—</span>;
                                  })()}
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center hidden sm:table-cell">
                                  <div className="flex flex-col items-center gap-0.5">
                                    {order.deliveryWindow && (
                                      <span className="text-xs text-muted">
                                        {order.deliveryWindow === "morning" ? "9–1" : "1–5"}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                                      {order.willBeIn ? (
                                        <><Home size={10} /> In</>
                                      ) : (
                                        <><MapPin size={10} /> Safe</>
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.color}`}>
                                    <StatusIcon size={10} />
                                    <span className="hidden sm:inline">{status.label}</span>
                                  </span>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${order.id}-details`}>
                                  <td colSpan={7} className="bg-primary/5 px-2 sm:px-6 py-4">
                                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-semibold text-muted uppercase mb-2">Order Items</h4>
                                        <div className="space-y-3">
                                          {groupItemsBySupplier(order.items).map((supplierGroup) => {
                                            const allItemsPacked = supplierGroup.items.every((_, i) => 
                                              packedItems.has(`packed-${order.id}-${supplierGroup.supplierId}-${i}`)
                                            );
                                            return (
                                              <div key={supplierGroup.supplierId} className={`rounded-lg border ${allItemsPacked ? 'border-green-300 bg-green-50' : 'border-primary/10 bg-surface'} overflow-hidden`}>
                                                <div className="px-2 sm:px-3 py-2 border-b border-primary/10">
                                                  <span className="font-medium text-sm text-primary">{supplierGroup.supplierName}</span>
                                                </div>
                                                <div className="divide-y divide-primary/5">
                                                  {supplierGroup.items.map((item, i) => {
                                                    const itemKey = `packed-${order.id}-${supplierGroup.supplierId}-${i}`;
                                                    const isItemPacked = packedItems.has(itemKey);
                                                    const itemRefunds = (refunds.get(order.id) || []).filter(r => r.productName === item.productName);
                                                    const totalRefunded = itemRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                                                    return (
                                                      <div key={i} className={`px-2 sm:px-3 py-2 ${isItemPacked ? 'bg-green-50' : ''}`} onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-start gap-2">
                                                          <input
                                                            type="checkbox"
                                                            checked={isItemPacked}
                                                            onChange={() => toggleSet("packed", itemKey)}
                                                            className="w-4 h-4 mt-0.5 rounded border-primary/30 text-green-600 focus:ring-green-500 flex-shrink-0"
                                                          />
                                                          <div className="flex-1 min-w-0 overflow-hidden">
                                                            <p className={`text-sm break-words ${isItemPacked ? 'text-green-700 line-through' : 'text-primary'}`}>{item.productName}</p>
                                                            <div className="flex items-center justify-between mt-1">
                                                              <span className={`text-sm font-medium ${isItemPacked ? 'text-green-700' : 'text-primary'}`}>x{item.quantity} = £{(item.quantity * item.price).toFixed(2)}</span>
                                                              {totalRefunded > 0 ? (
                                                                <div className="flex items-center gap-1">
                                                                  <span className="text-xs text-red-600 font-medium">-£{totalRefunded.toFixed(2)}</span>
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
                                                                  onClick={() => setRefundModal({ orderId: order.id, orderNumber: order.orderNumber, productName: item.productName, price: item.price, quantity: item.quantity, supplierId: supplierGroup.supplierId })}
                                                                  className="text-xs text-muted hover:text-red-600 transition"
                                                                >
                                                                  Refund
                                                                </button>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {(() => {
                                          const orderRefunds = refunds.get(order.id) || [];
                                          const totalRefunded = orderRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
                                          return (
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
                                          );
                                        })()}
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
                                        {!order.willBeIn && order.safePlace && (
                                          <p className="text-xs text-secondary">
                                            <MapPin size={12} className="inline mr-1" />
                                            {order.safePlace}
                                          </p>
                                        )}
                                        <div className="mt-3 flex items-center gap-2">
                                          <label className="text-xs font-medium text-muted">Status:</label>
                                          <select
                                            value={order.status}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => updateStatus(order.id, e.target.value as Order["status"])}
                                            className="rounded-lg border border-primary/20 bg-surface px-2 py-1 text-xs outline-none focus:border-secondary"
                                          >
                                            {statusOptions.map((s) => (
                                              <option key={s} value={s}>
                                                {s.charAt(0).toUpperCase() + s.slice(1)}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRefundModal(null)}>
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
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Refund Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={refundModal.quantity * refundModal.price}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={(refundModal.quantity * refundModal.price).toFixed(2)}
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                />
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
                    ⚠️ Item didn&apos;t arrive — supplier won&apos;t be paid for it, so no additional deduction applies.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Additional notes (optional)</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g., 1x garlic bulb missing"
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                />
              </div>
              {/* Only show "Who pays?" if item arrived - otherwise it doesn't affect payout */}
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

      {/* Supplier Payout Modal */}
      {payoutModal && (() => {
        const dayOrders = orderList.filter(o => o.deliveryDay === payoutModal);
        const daySummaries = getSupplierSummaries(dayOrders);
        const dayRefunds = dayOrders.flatMap(o => refunds.get(o.id) || []);
        
        // Calculate payouts per supplier
        const payouts = daySummaries.map(supplier => {
          // Get stock tracking for this supplier
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
          
          // Get refunds for this supplier
          const supplierRefunds = dayRefunds.filter(r => r.supplierId === supplier.supplierId);
          
          // Calculate supplier refund deduction based on itemArrived flag
          // If item didn't arrive (itemArrived=false), no deduction - supplier already not paid
          let supplierRefundDeduction = 0;
          for (const refund of supplierRefunds) {
            if (refund.paidBy === "local") continue; // Local pays = no supplier deduction
            if (!refund.itemArrived) continue; // Item didn't arrive = supplier already not paid
            
            // Item arrived and supplier/50-50 pays - deduct from payout
            const deduction = refund.paidBy === "supplier" ? refund.refundAmount : refund.refundAmount / 2;
            supplierRefundDeduction += deduction;
          }
          
          // Calculate totals
          const orderedTotal = supplierTracking.reduce((sum, item) => sum + item.orderedValue, 0);
          const arrivedTotal = supplierTracking.reduce((sum, item) => sum + item.arrivedValue, 0);
          
          // Final payout: (arrivedTotal - supplierRefundDeduction) * 0.8
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
                      {supplier.supplierRefunds.length > 0 && (
                        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                          <p className="text-xs font-semibold text-red-700 mb-1">Refunds for this supplier:</p>
                          <ul className="text-xs text-red-600 space-y-0.5">
                            {supplier.supplierRefunds.map((r, i) => {
                              const reasonLabel = refundReasonConfig[r.reasonType]?.label || r.reasonType;
                              const deducted = r.itemArrived && r.paidBy !== "local";
                              return (
                                <li key={i} className={!deducted ? "text-amber-600" : ""}>
                                  • {r.productName}: £{r.refundAmount.toFixed(2)} — {reasonLabel}
                                  {r.paidBy === "supplier" ? " (Supplier pays)" : r.paidBy === "50-50" ? " (50-50)" : " (Local pays)"}
                                  {!r.itemArrived && <span className="text-amber-500"> [No deduction - didn&apos;t arrive]</span>}
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
                                // Only deduct if item arrived AND supplier/50-50 pays
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
                      // Generate CSV with refund lines
                      const headers = ["Supplier", "Product", "Ordered", "Arrived", "Unit Price", "Arrived Value", "Refund Amount", "Refund Paid By", "Refund Reason", "Supplier Deduction", "Final Payout"];
                    const rows: string[][] = [];
                    
                    for (const supplier of payouts) {
                      // Add product rows
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
                      // Add refund rows
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
                      // Add supplier total row
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
                      rows.push(["", "", "", "", "", "", "", "", "", "", ""]); // Empty row between suppliers
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
