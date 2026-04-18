"use client";

import { useState, useEffect, useMemo } from "react";
import { type Order, type SupplierOrderStatus, getOrders, updateOrderStatus } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Calendar, ChevronDown, ChevronRight, ChefHat, Warehouse, Truck } from "lucide-react";

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

export default function AdminOrdersPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getOrders().then(setOrderList).catch(console.error);
  }, []);

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    await updateOrderStatus(orderId, newStatus);
    // Re-fetch orders to get updated supplier statuses from the cascade trigger
    const updated = await getOrders();
    setOrderList(updated);
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
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </div>

                      <div className="px-6 py-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted">
                              <th className="pb-2 font-medium">Item</th>
                              <th className="pb-2 font-medium text-center">Qty</th>
                              <th className="pb-2 font-medium text-right">Price</th>
                              <th className="pb-2 font-medium text-right">Subtotal</th>
                            <th className="pb-2 font-medium text-center">Supplier Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, i) => (
                              <tr key={i} className="border-t border-primary/5">
                                <td className="py-2 text-primary">{item.productName}</td>
                                <td className="py-2 text-center text-muted">{item.quantity}</td>
                                <td className="py-2 text-right text-muted">£{item.price.toFixed(2)}</td>
                                <td className="py-2 text-right font-medium text-primary">
                                  £{(item.quantity * item.price).toFixed(2)}
                                </td>
                                <td className="py-2 text-center">
                                  {item.supplierStatus && (
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${supplierStatusConfig[item.supplierStatus]?.color || "text-muted bg-muted/10"}`}>
                                      {supplierStatusConfig[item.supplierStatus]?.label || item.supplierStatus}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-primary/5 bg-secondary/5 px-6 py-3">
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
