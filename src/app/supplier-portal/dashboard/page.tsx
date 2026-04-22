"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type SupplierOrderItem,
  type SupplierUser,
  type Supplier,
  getSupplierUser,
  getSupplier,
  getSupplierOrders,
  getProductsBySupplier,
  getAverageRatings,
  getSupplierReviews,
} from "@/lib/data";
import { Loader2, TrendingUp, Package, Truck, PoundSterling, ShoppingCart, BarChart3, Star, MessageSquare } from "lucide-react";

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function SupplierDashboardPage() {
  const { user, isLoaded } = useUser();
  const [supplierUser, setSupplierUser] = useState<SupplierUser | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orderItems, setOrderItems] = useState<SupplierOrderItem[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overallRating, setOverallRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; avgRating: number; ratingCount: number }[]>([]);
  const [topProductsSort, setTopProductsSort] = useState<"quantity" | "rating">("quantity");
  const [reviews, setReviews] = useState<{ productId: string; productName: string; stars: number; comment: string; createdAt: string }[]>([]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    (async () => {
      const su = await getSupplierUser(user.id);
      setSupplierUser(su);
      if (su) {
        const s = await getSupplier(su.supplierId);
        setSupplier(s);
        const items = await getSupplierOrders(su.supplierId);
        setOrderItems(items);
        
        if (s) {
          const prods = await getProductsBySupplier(s.id);
          setProductCount(prods.length);
          const allRatings = await getAverageRatings();
          
          // Calculate quantities per product
          const productQuantities = new Map<string, number>();
          for (const item of items) {
            const current = productQuantities.get(item.productName) || 0;
            productQuantities.set(item.productName, current + item.quantity);
          }
          
          // Combine products with quantities and ratings
          const combinedProducts = prods.map((p) => ({
            name: p.name,
            quantity: productQuantities.get(p.name) || 0,
            avgRating: allRatings[p.id]?.avg || 0,
            ratingCount: allRatings[p.id]?.count || 0,
          }));
          setTopProducts(combinedProducts);
          
          // Calculate overall rating
          const prodRatings = combinedProducts.filter((p) => p.ratingCount > 0);
          if (prodRatings.length > 0) {
            const totalStars = prodRatings.reduce((acc, r) => acc + r.avgRating * r.ratingCount, 0);
            const totalCount = prodRatings.reduce((acc, r) => acc + r.ratingCount, 0);
            setOverallRating({ avg: totalStars / totalCount, count: totalCount });
          }
          
          // Fetch customer reviews with comments
          const supplierReviews = await getSupplierReviews(s.id);
          setReviews(supplierReviews);
        }
      }
      setLoading(false);
    })();
  }, [isLoaded, user]);

  const metrics = useMemo(() => {
    // Group by delivery day
    const dayMap = new Map<string, { revenue: number; orderIds: Set<string>; items: number }>();
    for (const item of orderItems) {
      const day = item.deliveryDay || "unassigned";
      if (!dayMap.has(day)) {
        dayMap.set(day, { revenue: 0, orderIds: new Set(), items: 0 });
      }
      const d = dayMap.get(day)!;
      d.revenue += item.quantity * item.price;
      d.orderIds.add(item.orderId);
      d.items += item.quantity;
    }

    const today = new Date().toISOString().split("T")[0];
    const deliveryDays = Array.from(dayMap.entries())
      .filter(([k]) => k !== "unassigned")
      .sort(([a], [b]) => a.localeCompare(b));

    const pastDays = deliveryDays.filter(([k]) => k < today);
    const futureDays = deliveryDays.filter(([k]) => k >= today);

    const totalRevenue = deliveryDays.reduce((acc, [, v]) => acc + v.revenue, 0);
    const totalDeliveries = deliveryDays.length;
    const totalOrders = new Set(orderItems.map((i) => i.orderId)).size;
    const avgPerDelivery = totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0;
    const totalItems = orderItems.reduce((acc, i) => acc + i.quantity, 0);

    // Per-delivery breakdown for the chart
    const deliveryBreakdown = deliveryDays.map(([day, data]) => ({
      day,
      revenue: data.revenue,
      orders: data.orderIds.size,
      items: data.items,
      isPast: day < today,
    }));

    // Trend: compare last 2 past deliveries
    let trend: "up" | "down" | "flat" = "flat";
    if (pastDays.length >= 2) {
      const prev = pastDays[pastDays.length - 2][1].revenue;
      const last = pastDays[pastDays.length - 1][1].revenue;
      if (last > prev) trend = "up";
      else if (last < prev) trend = "down";
    }

    // Upcoming revenue
    const upcomingRevenue = futureDays.reduce((acc, [, v]) => acc + v.revenue, 0);
    const upcomingOrders = futureDays.reduce((acc, [, v]) => acc + v.orderIds.size, 0);

    return {
      totalRevenue,
      totalDeliveries,
      totalOrders,
      avgPerDelivery,
      totalItems,
      deliveryBreakdown,
      trend,
      upcomingRevenue,
      upcomingOrders,
    };
  }, [orderItems]);

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!supplierUser || !supplier) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary">No Supplier Account</h1>
        <p className="mt-2 text-muted">Your account is not linked to a supplier.</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...metrics.deliveryBreakdown.map((d) => d.revenue), 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Key metrics for {supplier.name}</p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <PoundSterling size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Total Revenue</p>
              <p className="text-xl font-bold text-primary">£{metrics.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Delivery Days</p>
              <p className="text-xl font-bold text-primary">{metrics.totalDeliveries}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Avg £ / Delivery</p>
              <p className="text-xl font-bold text-primary">
                £{metrics.avgPerDelivery.toFixed(2)}
                {metrics.trend === "up" && <span className="ml-1 text-xs text-green-600">↑</span>}
                {metrics.trend === "down" && <span className="ml-1 text-xs text-red-500">↓</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Total Orders</p>
              <p className="text-xl font-bold text-primary">{metrics.totalOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming summary + ratings */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-secondary/10 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-primary">Upcoming Revenue</h3>
          <p className="mt-1 text-2xl font-bold text-secondary">£{metrics.upcomingRevenue.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-muted">{metrics.upcomingOrders} order{metrics.upcomingOrders !== 1 ? "s" : ""} pending delivery</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-primary">Products Listed</h3>
          <p className="mt-1 text-2xl font-bold text-primary">{productCount}</p>
          <p className="mt-0.5 text-xs text-muted">{metrics.totalItems} total items sold</p>
        </div>
        <div className="rounded-xl bg-accent/10 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-primary">Customer Rating</h3>
          {overallRating.count > 0 ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-2xl font-bold text-primary">{overallRating.avg.toFixed(1)}</p>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={16} className={overallRating.avg >= s ? "fill-accent text-accent" : "text-primary/15"} />
                  ))}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-muted">{overallRating.count} total rating{overallRating.count !== 1 ? "s" : ""}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">No ratings yet</p>
          )}
        </div>
      </div>

      {/* Revenue per delivery day chart */}
      {metrics.deliveryBreakdown.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-secondary" />
            <h2 className="text-sm font-bold text-primary">Revenue by Delivery Day</h2>
          </div>
          <div className="space-y-3">
            {metrics.deliveryBreakdown.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className={`w-28 text-xs font-medium shrink-0 ${d.isPast ? "text-muted" : "text-primary"}`}>
                  {formatDeliveryDate(d.day)}
                  {!d.isPast && <span className="ml-1 text-[10px] text-secondary font-bold">upcoming</span>}
                </span>
                <div className="flex-1 h-7 rounded-lg bg-surface overflow-hidden">
                  <div
                    className={`h-full rounded-lg flex items-center px-2 text-[11px] font-bold text-white transition-all ${d.isPast ? "bg-primary/60" : "bg-secondary"}`}
                    style={{ width: `${Math.max((d.revenue / maxRevenue) * 100, 8)}%` }}
                  >
                    £{d.revenue.toFixed(2)}
                  </div>
                </div>
                <span className="text-xs text-muted w-20 text-right shrink-0">
                  {d.orders} order{d.orders !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top products table */}
      {topProducts.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-secondary" />
              <h2 className="text-sm font-bold text-primary">Top Products</h2>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted mr-2">Sort by:</span>
              <button
                onClick={() => setTopProductsSort("quantity")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  topProductsSort === "quantity" ? "bg-secondary text-white" : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                }`}
              >
                Most Ordered
              </button>
              <button
                onClick={() => setTopProductsSort("rating")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  topProductsSort === "rating" ? "bg-accent text-white" : "bg-accent/10 text-accent hover:bg-accent/20"
                }`}
              >
                Highest Rated
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-left">
                <th className="pb-2 font-semibold text-primary">Product</th>
                <th className="pb-2 font-semibold text-primary text-center">Ordered</th>
                <th className="pb-2 font-semibold text-primary text-center">Rating</th>
              </tr>
            </thead>
            <tbody>
              {[...topProducts]
                .sort((a, b) => topProductsSort === "quantity" 
                  ? b.quantity - a.quantity 
                  : b.avgRating - a.avgRating || b.ratingCount - a.ratingCount
                )
                .slice(0, 10)
                .map((p) => (
                  <tr key={p.name} className="border-b border-primary/5 last:border-0">
                    <td className="py-2 font-medium text-primary">{p.name}</td>
                    <td className="py-2 text-center">
                      <span className="font-bold text-secondary">{p.quantity}</span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-center gap-1">
                        {p.ratingCount > 0 ? (
                          <>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={12} className={p.avgRating >= s ? "fill-accent text-accent" : "text-primary/15"} />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-primary">{p.avgRating.toFixed(1)}</span>
                            <span className="text-[10px] text-muted">({p.ratingCount})</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Reviews */}
      {reviews.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-secondary" />
            <h2 className="text-sm font-bold text-primary">Customer Reviews</h2>
            <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">{reviews.length}</span>
          </div>
          <div className="space-y-4">
            {reviews.slice(0, 10).map((review, i) => (
              <div key={i} className="border-b border-primary/5 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">{review.productName}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={12} className={review.stars >= s ? "fill-accent text-accent" : "text-primary/15"} />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted">
                      {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted italic">"{review.comment}"</p>
              </div>
            ))}
          </div>
          {reviews.length > 10 && (
            <p className="mt-4 text-xs text-muted text-center">Showing 10 of {reviews.length} reviews</p>
          )}
        </div>
      )}
    </div>
  );
}
