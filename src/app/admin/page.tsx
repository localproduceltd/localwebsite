import { Calendar, ShoppingCart, TrendingUp, Package, Users } from "lucide-react";
import { getOrders, getActiveDeliveryDays } from "@/lib/data";

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default async function AdminDashboard() {
  const [orders, upcomingDeliveryDays] = await Promise.all([
    getOrders(),
    getActiveDeliveryDays(),
  ]);

  // Calculate totals
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;

  // Group orders by delivery day for upcoming days
  const upcomingDeliveryStats = upcomingDeliveryDays.map((day) => {
    const dayOrders = orders.filter((o) => o.deliveryDay === day.deliveryDate);
    return {
      date: day.deliveryDate,
      orderCount: dayOrders.length,
      revenue: dayOrders.reduce((sum, o) => sum + o.total, 0),
    };
  });

  // Calculate most popular products (by quantity ordered)
  const productCounts = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = productCounts.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * item.price;
      productCounts.set(item.productId, existing);
    }
  }
  const topProducts = Array.from(productCounts.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Calculate most popular suppliers (by revenue)
  const supplierStats = new Map<string, { name: string; orderCount: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.supplierId || !item.supplierName) continue;
      const existing = supplierStats.get(item.supplierId) || { name: item.supplierName, orderCount: 0, revenue: 0 };
      existing.orderCount += 1;
      existing.revenue += item.quantity * item.price;
      supplierStats.set(item.supplierId, existing);
    }
  }
  const topSuppliers = Array.from(supplierStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      <p className="mt-1 text-muted">Overview of your marketplace</p>

      {/* Top Stats */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Total Revenue</p>
              <p className="text-3xl font-bold text-primary">£{totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Total Orders</p>
              <p className="text-3xl font-bold text-primary">{totalOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Delivery Days */}
      <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Upcoming Delivery Days</h2>
        </div>
        {upcomingDeliveryStats.length === 0 ? (
          <p className="text-sm text-muted">No upcoming delivery days</p>
        ) : (
          <div className="space-y-3">
            {upcomingDeliveryStats.map((day) => (
              <div key={day.date} className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-primary">{formatDeliveryDate(day.date)}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted">
                    <span className="font-semibold text-primary">{day.orderCount}</span> order{day.orderCount !== 1 ? "s" : ""}
                  </span>
                  <span className="font-semibold text-green-600">£{day.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Most Popular Products & Suppliers */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Most Popular Products */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Package size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Most Popular Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted">No product data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="font-medium text-primary">{product.name}</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="text-muted">{product.quantity} sold</span>
                    <span className="ml-3 font-semibold text-green-600">£{product.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Popular Suppliers */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Most Popular Suppliers</h2>
          </div>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-muted">No supplier data yet</p>
          ) : (
            <div className="space-y-3">
              {topSuppliers.map((supplier, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="font-medium text-primary">{supplier.name}</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="text-muted">{supplier.orderCount} items</span>
                    <span className="ml-3 font-semibold text-green-600">£{supplier.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
