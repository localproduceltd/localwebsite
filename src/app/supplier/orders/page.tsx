"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type SupplierOrderItem,
  type SupplierOrderStatus,
  type SupplierUser,
  getSupplierUser,
  getSupplierOrders,
  updateSupplierOrderItemStatus,
} from "@/lib/data";
import { Loader2, Calendar, Package, ChefHat, Warehouse, Truck, XCircle, ChevronDown, ChevronRight } from "lucide-react";

const supplierStatusConfig: Record<
  SupplierOrderStatus,
  { label: string; icon: typeof Package; color: string }
> = {
  order_placed: { label: "Order Placed", icon: Package, color: "text-amber-600 bg-amber-50" },
  prepping: { label: "Prepping", icon: ChefHat, color: "text-blue-600 bg-blue-50" },
  dropped_at_depot: { label: "Dropped at Depot", icon: Warehouse, color: "text-purple-600 bg-purple-50" },
  delivered: { label: "Delivered", icon: Truck, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

const supplierStatusFlow: SupplierOrderStatus[] = [
  "order_placed",
  "prepping",
  "dropped_at_depot",
];

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

interface SupplierSubOrder {
  orderId: string;
  items: SupplierOrderItem[];
  total: number;
  supplierStatus: SupplierOrderStatus;
  orderStatus: string;
  orderCreatedAt: string;
}

export default function SupplierOrdersPage() {
  const { user, isLoaded } = useUser();
  const [supplierUser, setSupplierUser] = useState<SupplierUser | null>(null);
  const [orderItems, setOrderItems] = useState<SupplierOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];
  const [collapsedPastDays, setCollapsedPastDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded || !user) return;
    (async () => {
      const su = await getSupplierUser(user.id);
      setSupplierUser(su);
      if (su) {
        const items = await getSupplierOrders(su.supplierId);
        setOrderItems(items);
      }
      setLoading(false);
    })();
  }, [isLoaded, user]);

  const togglePastDay = (day: string) => {
    setCollapsedPastDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  // Group items: first by delivery day, then by orderId within each day
  const grouped = useMemo(() => {
    // Group by orderId first
    const orderMap = new Map<string, SupplierSubOrder>();
    for (const item of orderItems) {
      if (!orderMap.has(item.orderId)) {
        orderMap.set(item.orderId, {
          orderId: item.orderId,
          items: [],
          total: 0,
          supplierStatus: item.supplierStatus,
          orderStatus: item.orderStatus,
          orderCreatedAt: item.orderCreatedAt,
        });
      }
      const sub = orderMap.get(item.orderId)!;
      sub.items.push(item);
      sub.total += item.quantity * item.price;
    }

    // Group sub-orders by delivery day
    const dayMap = new Map<string, { deliveryDay: string; subOrders: SupplierSubOrder[]; total: number }>();
    for (const item of orderItems) {
      const key = item.deliveryDay || "unassigned";
      if (!dayMap.has(key)) {
        dayMap.set(key, { deliveryDay: key, subOrders: [], total: 0 });
      }
    }
    for (const sub of orderMap.values()) {
      const day = sub.items[0]?.deliveryDay || "unassigned";
      const group = dayMap.get(day)!;
      // Avoid duplicates
      if (!group.subOrders.find((s) => s.orderId === sub.orderId)) {
        group.subOrders.push(sub);
        group.total += sub.total;
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => {
      if (a.deliveryDay === "unassigned") return 1;
      if (b.deliveryDay === "unassigned") return -1;
      return b.deliveryDay.localeCompare(a.deliveryDay);
    });
  }, [orderItems]);

  // Default collapse all past days on first load
  useEffect(() => {
    if (grouped.length === 0) return;
    const pastDays = grouped
      .filter((g) => g.deliveryDay !== "unassigned" && g.deliveryDay < today)
      .map((g) => g.deliveryDay);
    setCollapsedPastDays(new Set(pastDays));
  }, [grouped.length]);

  // Aggregate quantity per product per delivery day (non-delivered only)
  const demandGrid = useMemo(() => {
    const daySet = new Set<string>();
    // productId → { name, days: { dayKey → qty } }
    const map = new Map<string, { name: string; days: Map<string, number>; total: number }>();
    for (const item of orderItems) {
      if (item.supplierStatus === "delivered" || item.supplierStatus === "cancelled") continue;
      const day = item.deliveryDay || "unassigned";
      daySet.add(day);
      const existing = map.get(item.productId);
      if (existing) {
        existing.days.set(day, (existing.days.get(day) ?? 0) + item.quantity);
        existing.total += item.quantity;
      } else {
        const days = new Map<string, number>();
        days.set(day, item.quantity);
        map.set(item.productId, { name: item.productName, days, total: item.quantity });
      }
    }
    const deliveryDays = Array.from(daySet).sort((a, b) => {
      if (a === "unassigned") return 1;
      if (b === "unassigned") return -1;
      return a.localeCompare(b);
    });
    const products = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return { deliveryDays, products };
  }, [orderItems]);

  const handleStatusUpdate = async (orderId: string, newStatus: SupplierOrderStatus) => {
    if (!supplierUser) return;
    await updateSupplierOrderItemStatus(orderId, supplierUser.supplierId, newStatus);
    setOrderItems((prev) =>
      prev.map((item) =>
        item.orderId === orderId ? { ...item, supplierStatus: newStatus } : item
      )
    );
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!supplierUser) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary">No Supplier Account</h1>
        <p className="mt-2 text-muted">Your account is not linked to a supplier.</p>
      </div>
    );
  }

  const totalOrders = grouped.reduce((acc, g) => acc + g.subOrders.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-primary">Your Orders</h1>
      <p className="mt-1 text-sm text-muted">{totalOrders} sub-order{totalOrders !== 1 ? "s" : ""} across {grouped.length} delivery day{grouped.length !== 1 ? "s" : ""}</p>

      {demandGrid.products.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl bg-surface shadow-sm">
          <div className="border-b border-primary/5 bg-accent/10 px-6 py-3">
            <h2 className="text-sm font-bold text-primary">Outstanding Product Demand</h2>
            <p className="text-xs text-muted">Quantities needed per delivery day</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/5 text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  {demandGrid.deliveryDays.map((day) => (
                    <th key={day} className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                      {day === "unassigned" ? "No Date" : formatDeliveryDate(day)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {demandGrid.products.map((p) => (
                  <tr key={p.name} className="border-b border-primary/5 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-primary">{p.name}</td>
                    {demandGrid.deliveryDays.map((day) => {
                      const qty = p.days.get(day) ?? 0;
                      return (
                        <td key={day} className="px-3 py-2.5 text-center">
                          {qty > 0 ? (
                            <span className="inline-block rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-bold text-secondary">
                              {qty}
                            </span>
                          ) : (
                            <span className="text-muted/30">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-bold text-primary">{p.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-primary/10 bg-primary/5">
                  <td className="px-4 py-2.5 text-sm font-bold text-primary">Total</td>
                  {demandGrid.deliveryDays.map((day) => {
                    const dayTotal = demandGrid.products.reduce((acc, p) => acc + (p.days.get(day) ?? 0), 0);
                    return (
                      <td key={day} className="px-3 py-2.5 text-center text-sm font-bold text-primary">
                        {dayTotal}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center text-sm font-bold text-primary">
                    {demandGrid.products.reduce((acc, p) => acc + p.total, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {totalOrders === 0 && (
        <div className="mt-16 text-center">
          <Package size={48} className="mx-auto text-muted/40" />
          <p className="mt-4 text-lg font-medium text-primary">No orders yet</p>
          <p className="mt-1 text-sm text-muted">Orders containing your products will appear here.</p>
        </div>
      )}

      {grouped.map((group) => {
        const isPast = group.deliveryDay !== "unassigned" && group.deliveryDay < today;
        const isCollapsed = collapsedPastDays.has(group.deliveryDay);

        return (
        <div key={group.deliveryDay} className="mt-8">
          <div
            className={`flex items-center justify-between gap-2 mb-4 ${isPast ? "cursor-pointer select-none" : ""}`}
            onClick={isPast ? () => togglePastDay(group.deliveryDay) : undefined}
          >
            <div className="flex items-center gap-2">
              {isPast ? (
                isCollapsed ? <ChevronRight size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />
              ) : (
                <Calendar size={18} className="text-primary-light" />
              )}
              <h2 className={`text-lg font-bold ${isPast ? "text-muted" : "text-primary"}`}>
                {group.deliveryDay === "unassigned" ? "No Delivery Date" : formatDeliveryDate(group.deliveryDay)}
              </h2>
              {isPast && (
                <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-semibold text-muted">Past</span>
              )}
              <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {group.subOrders.length} order{group.subOrders.length !== 1 ? "s" : ""}
              </span>
            </div>
            <span className="text-sm font-bold text-primary">
              Total: £{group.total.toFixed(2)}
            </span>
          </div>

          {!isCollapsed && (
          <div className="space-y-4">
            {group.subOrders.map((sub) => {
              const cfg = supplierStatusConfig[sub.supplierStatus];
              const StatusIcon = cfg.icon;
              const isReadOnly = sub.supplierStatus === "delivered" || sub.supplierStatus === "cancelled";

              return (
                <div key={sub.orderId} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        Order {sub.orderId.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted">Placed: {sub.orderCreatedAt}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.color}`}>
                      <StatusIcon size={12} />
                      {cfg.label}
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
                        </tr>
                      </thead>
                      <tbody>
                        {sub.items.map((item) => (
                          <tr key={item.id} className="border-t border-primary/5">
                            <td className="py-2 text-primary">{item.productName}</td>
                            <td className="py-2 text-center text-muted">{item.quantity}</td>
                            <td className="py-2 text-right text-muted">£{item.price.toFixed(2)}</td>
                            <td className="py-2 text-right font-medium text-primary">
                              £{(item.quantity * item.price).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-primary/5 bg-secondary/5 px-6 py-3">
                    {isReadOnly ? (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
                        <StatusIcon size={14} />
                        {cfg.label} by admin
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted">Update status:</label>
                        <div className="flex gap-1">
                          {supplierStatusFlow.map((s) => {
                            const sc = supplierStatusConfig[s];
                            const Icon = sc.icon;
                            const isActive = s === sub.supplierStatus;
                            return (
                              <button
                                key={s}
                                onClick={() => handleStatusUpdate(sub.orderId, s)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                                  isActive
                                    ? sc.color + " ring-1 ring-current"
                                    : "bg-background text-muted hover:bg-primary/5"
                                }`}
                              >
                                <Icon size={12} />
                                {sc.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-bold text-primary">
                      £{sub.total.toFixed(2)}
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
