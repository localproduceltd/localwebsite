"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Order, type OrderItem, type SupplierOrderStatus, getOrders, updateOrderStatus, toggleBoxReturned } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, ChefHat, Warehouse, Truck, Home, MapPin } from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

const statusOptions: Order["status"][] = ["pending", "confirmed", "delivered", "cancelled"];

const supplierStatusConfig: Record<SupplierOrderStatus, { label: string; color: string }> = {
  order_placed: { label: "Placed", color: "text-amber-600 bg-amber-50" },
  prepping: { label: "Prepping", color: "text-blue-600 bg-blue-50" },
  dropped_at_depot: { label: "At Depot", color: "text-purple-600 bg-purple-50" },
  delivered: { label: "Delivered", color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50" },
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

// Helper to group items by supplier
function groupItemsBySupplier(items: OrderItem[]): Array<{ supplierId: string; supplierName: string; items: OrderItem[]; status: SupplierOrderStatus }> {
  const groups = new Map<string, { supplierName: string; items: OrderItem[]; status: SupplierOrderStatus }>();
  for (const item of items) {
    const supplierId = item.supplierId || "unknown";
    if (!groups.has(supplierId)) {
      const supplierName = item.supplierName || (supplierId === "unknown" ? "Unknown Supplier" : "Supplier");
      groups.set(supplierId, { supplierName, items: [], status: item.supplierStatus || "order_placed" });
    }
    groups.get(supplierId)!.items.push(item);
  }
  // Sort by supplier name
  return Array.from(groups.entries())
    .map(([supplierId, data]) => ({ supplierId, ...data }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export default function AdminOrdersPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [boxReturned, setBoxReturned] = useState<Set<string>>(new Set());

  const toggleSupplierExpand = useCallback((key: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    getOrders().then(setOrderList).catch(console.error);
  }, []);

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    const order = orderList.find((o) => o.id === orderId);
    await updateOrderStatus(orderId, newStatus);
    // Re-fetch orders to get updated supplier statuses from the cascade trigger
    const updated = await getOrders();
    setOrderList(updated);

    // Send email notification to customer for status changes
    if (order && order.customerEmail && ["confirmed", "delivered", "cancelled"].includes(newStatus)) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order_status_update",
          data: {
            customerEmail: order.customerEmail,
            customerName: order.customerEmail.split("@")[0], // Fallback name from email
            orderNumber: order.orderNumber,
            status: newStatus,
            deliveryDay: order.deliveryDay
              ? new Date(order.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
              : "Not set",
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
    // Sort: upcoming dates first (nearest first), then past dates (most recent first), unassigned last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "unassigned") return 1;
      if (b === "unassigned") return -1;
      const aUp = isUpcoming(a);
      const bUp = isUpcoming(b);
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      if (aUp && bUp) return a.localeCompare(b); // nearest upcoming first
      return b.localeCompare(a); // most recent past first
    });
  }, [orderList]);

  // Auto-collapse past dates on load
  useEffect(() => {
    if (orderList.length > 0) {
      const past = new Set<string>();
      for (const [key] of grouped) {
        if (!isUpcoming(key) && key !== "unassigned") past.add(key);
      }
      setCollapsed(past);
    }
  }, [orderList.length]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Orders</h1>
      <p className="mt-1 text-muted">{orderList.length} total orders</p>

      {grouped.map(([deliveryDay, orders]) => {
        const upcoming = isUpcoming(deliveryDay);
        const isOpen = !collapsed.has(deliveryDay);
        const total = orders.reduce((sum, o) => sum + o.total, 0);

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
              <div className="space-y-4">
                {orders.map((order) => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;
                  return (
                    <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-primary">Order #{order.orderNumber}</p>
                          <p className="text-xs text-muted">{order.customerEmail || `User: ${order.userId.slice(0, 12)}...`} &middot; {order.createdAt}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            {order.deliveryWindow && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted">
                                <Clock size={12} />
                                {order.deliveryWindow === "morning" ? "9am–1pm" : "1pm–5pm"}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <Home size={12} />
                              {order.willBeIn ? "Customer in" : "Leave safe"}
                            </span>
                            {!order.willBeIn && order.safePlace && (
                              <span className="inline-flex items-center gap-1 text-xs text-secondary" title={order.safePlace}>
                                <MapPin size={12} />
                                {order.safePlace.length > 30 ? order.safePlace.slice(0, 30) + "..." : order.safePlace}
                              </span>
                            )}
                            {order.boxDepositPaid && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                <Package size={10} />
                                Box deposit
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </div>

                      <div className="px-6 py-4 space-y-2">
                        {groupItemsBySupplier(order.items).map((supplierGroup) => {
                          const supplierKey = `${order.id}-${supplierGroup.supplierId}`;
                          const isExpanded = expandedSuppliers.has(supplierKey);
                          const supplierTotal = supplierGroup.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
                          const statusCfg = supplierStatusConfig[supplierGroup.status] || supplierStatusConfig.order_placed;
                          
                          return (
                            <div key={supplierGroup.supplierId} className="rounded-lg border border-primary/10 overflow-hidden">
                              {/* Supplier header */}
                              <button
                                onClick={() => toggleSupplierExpand(supplierKey)}
                                className="flex w-full items-center justify-between bg-primary/5 px-4 py-2.5 text-left hover:bg-primary/10 transition"
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown size={16} className="text-muted" />
                                  ) : (
                                    <ChevronRight size={16} className="text-muted" />
                                  )}
                                  <span className="font-medium text-primary">{supplierGroup.supplierName}</span>
                                  <span className="text-xs text-muted">
                                    {supplierGroup.items.length} item{supplierGroup.items.length !== 1 ? "s" : ""} · £{supplierTotal.toFixed(2)}
                                  </span>
                                </div>
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusCfg.color}`}>
                                  {statusCfg.label}
                                </span>
                              </button>

                              {/* Items table - shown when expanded */}
                              {isExpanded && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs text-muted border-t border-primary/5">
                                      <th className="px-4 py-2 font-medium">Item</th>
                                      <th className="px-4 py-2 font-medium text-center">Qty</th>
                                      <th className="px-4 py-2 font-medium text-right">Price</th>
                                      <th className="px-4 py-2 font-medium text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {supplierGroup.items.map((item, i) => (
                                      <tr key={i} className="border-t border-primary/5">
                                        <td className="px-4 py-2 text-primary">{item.productName}</td>
                                        <td className="px-4 py-2 text-center text-muted">{item.quantity}</td>
                                        <td className="px-4 py-2 text-right text-muted">£{item.price.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-medium text-primary">
                                          £{(item.quantity * item.price).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-primary/5 bg-secondary/5 px-6 py-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-muted">Update status:</label>
                            <select
                              value={order.status}
                              onChange={(e) => updateStatus(order.id, e.target.value as Order["status"])}
                              className="rounded-lg border border-primary/20 bg-surface px-2 py-1 text-sm outline-none focus:border-secondary"
                            >
                              {statusOptions.map((s) => (
                                <option key={s} value={s}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {order.boxDepositPaid && order.status === "delivered" && (
                            <button
                              onClick={async () => {
                                const isReturned = boxReturned.has(order.id);
                                await toggleBoxReturned(order.id, !isReturned);
                                setBoxReturned((prev) => {
                                  const next = new Set(prev);
                                  if (isReturned) next.delete(order.id);
                                  else next.add(order.id);
                                  return next;
                                });
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                boxReturned.has(order.id)
                                  ? "bg-green-600 text-white hover:bg-green-700"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {boxReturned.has(order.id) ? (
                                <>
                                  <CheckCircle size={12} />
                                  Box Returned ✓
                                </>
                              ) : (
                                <>
                                  <Package size={12} />
                                  Mark Box Returned
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-sm font-bold text-primary">
                          Total: £{order.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
