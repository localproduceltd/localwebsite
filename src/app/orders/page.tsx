"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { type Order, getOrders } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle } from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

export default function OrdersPage() {
  const { user } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return;
    getOrders(user.id).then(setOrders).catch(console.error);
  }, [user]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">My Orders</h1>
      <p className="mt-1 text-muted">View your order history and track current orders</p>

      {orders.length === 0 ? (
        <div className="mt-16 text-center">
          <Package size={48} className="mx-auto text-muted" />
          <p className="mt-4 text-lg font-medium text-primary">No orders yet</p>
          <p className="mt-1 text-sm text-muted">Start shopping to place your first order!</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {orders.map((order) => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            return (
              <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                {/* Order header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted">Placed on {order.createdAt}</p>
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

                {/* Order items */}
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

                {/* Order total */}
                <div className="flex justify-end border-t border-primary/5 bg-secondary/5 px-6 py-3">
                  <p className="text-sm font-bold text-primary">
                    Total: &euro;{order.total.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
