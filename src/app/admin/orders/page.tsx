"use client";

import { useState, useEffect } from "react";
import { type Order } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Package, Clock, CheckCircle, XCircle } from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

const statusOptions: Order["status"][] = ["pending", "confirmed", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);

  useEffect(() => {
    supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setOrderList(data.map((o) => ({
        id: o.id,
        userId: o.user_id,
        items: (o.order_items as Array<{ product_id: string; product_name: string; quantity: number; price: number }>).map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
        total: Number(o.total),
        status: o.status as Order["status"],
        createdAt: new Date(o.created_at).toISOString().split("T")[0],
        deliveryDay: o.delivery_day,
      })));
    });
  }, []);

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    setOrderList((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Orders</h1>
      <p className="mt-1 text-muted">{orderList.length} total orders</p>

      <div className="mt-8 space-y-6">
        {orderList.map((order) => {
          const status = statusConfig[order.status];
          const StatusIcon = status.icon;
          return (
            <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-primary">Order {order.id}</p>
                  <p className="text-xs text-muted">Customer: {order.userId} &middot; {order.createdAt}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted">
                    Delivery: <span className="font-medium text-primary">{order.deliveryDay}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </span>
                </div>
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
                    {order.items.map((item, i) => (
                      <tr key={i} className="border-t border-primary/5">
                        <td className="py-2 text-primary">{item.productName}</td>
                        <td className="py-2 text-center text-muted">{item.quantity}</td>
                        <td className="py-2 text-right text-muted">&euro;{item.price.toFixed(2)}</td>
                        <td className="py-2 text-right font-medium text-primary">
                          &euro;{(item.quantity * item.price).toFixed(2)}
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
                    className="rounded-lg border border-primary/20 bg-background px-2 py-1 text-sm outline-none focus:border-primary-light"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm font-bold text-primary">
                  Total: &euro;{order.total.toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
