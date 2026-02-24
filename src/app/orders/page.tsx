"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { type Order, getOrders, getRatingsByOrder, submitRating } from "@/lib/data";
import { Package, Clock, CheckCircle, XCircle, Star } from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

function StarRating({ value, onChange }: { value: number; onChange?: (stars: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} transition`}
        >
          <Star
            size={18}
            className={
              (hover || value) >= star
                ? "fill-accent text-accent"
                : "text-primary/20"
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const { user } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!user) return;
    getOrders(user.id).then(async (orders) => {
      setOrders(orders);
      const delivered = orders.filter((o) => o.status === "delivered");
      const ratingMap: Record<string, Record<string, number>> = {};
      for (const order of delivered) {
        ratingMap[order.id] = await getRatingsByOrder(user.id, order.id);
      }
      setRatings(ratingMap);
    }).catch(console.error);
  }, [user]);

  const handleRate = async (orderId: string, productId: string, stars: number) => {
    if (!user) return;
    await submitRating(user.id, productId, orderId, stars);
    setRatings((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [productId]: stars },
    }));
  };

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
            const isDelivered = order.status === "delivered";
            const orderRatings = ratings[order.id] ?? {};
            return (
              <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                {/* Order header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">Order #{order.orderNumber}</p>
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
                        {isDelivered && <th className="pb-2 font-medium text-right">Rate</th>}
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
                          {isDelivered && (
                            <td className="py-2">
                              <div className="flex justify-end">
                                <StarRating
                                  value={orderRatings[item.productId] ?? 0}
                                  onChange={(stars) => handleRate(order.id, item.productId, stars)}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Order total */}
                <div className="flex items-center justify-between border-t border-primary/5 bg-secondary/5 px-6 py-3">
                  {isDelivered && (
                    <p className="text-xs text-muted">
                      {Object.keys(orderRatings).length === order.items.length
                        ? "Thanks for rating! ⭐"
                        : "Tap the stars to rate your products"}
                    </p>
                  )}
                  <p className="text-sm font-bold text-primary ml-auto">
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
}
