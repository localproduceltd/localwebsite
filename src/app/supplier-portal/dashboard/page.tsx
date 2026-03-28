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
} from "@/lib/data";
import { Loader2, TrendingUp, Package, Truck, PoundSterling, ShoppingCart, BarChart3, Star } from "lucide-react";

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
  const [ratingData, setRatingData] = useState<{ name: string; avg: number; count: number }[]>([]);
  const [overallRating, setOverallRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });

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
          const prodRatings = prods
            .filter((p) => allRatings[p.id])
            .map((p) => ({ name: p.name, avg: allRatings[p.id].avg, count: allRatings[p.id].count }))
            .sort((a, b) => b.avg - a.avg);
          setRatingData(prodRatings);
          if (prodRatings.length > 0) {
            const totalStars = prodRatings.reduce((acc, r) => acc + r.avg * r.count, 0);
            const totalCount = prodRatings.reduce((acc, r) => acc + r.count, 0);
            setOverallRating({ avg: totalStars / totalCount, count: totalCount });
          }
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

      {/* Top rated products */}
      {ratingData.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star size={18} className="text-accent" />
            <h2 className="text-sm font-bold text-primary">Product Ratings</h2>
          </div>
          <div className="space-y-3">
            {ratingData.map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <span className="w-40 text-sm font-medium text-primary truncate shrink-0">{r.name}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={14} className={r.avg >= s ? "fill-accent text-accent" : "text-primary/15"} />
                  ))}
                </div>
                <span className="text-sm font-bold text-primary">{r.avg.toFixed(1)}</span>
                <span className="text-xs text-muted">({r.count} rating{r.count !== 1 ? "s" : ""})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
