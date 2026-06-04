import { Calendar, ShoppingCart, TrendingUp, Package, Users, Star, TrendingDown } from "lucide-react";
import { getOrders, getProductRatingAverages, orderRevenue, orderBasket, type Order } from "@/lib/data";
import AdminCharts from "@/components/AdminCharts";

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default async function AdminDashboard() {
  const [orders, productRatings] = await Promise.all([
    getOrders(),
    getProductRatingAverages(),
  ]);

  // Calculate totals (excluding box deposits)
  const totalRevenue = orders.reduce((sum, o) => sum + orderRevenue(o), 0);
  const totalOrders = orders.length;
  const totalBasket = orders.reduce((sum, o) => sum + orderBasket(o), 0);
  const avgBasketAllTime = totalOrders > 0 ? totalBasket / totalOrders : 0;

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

  // Calculate end of current week (Sunday) for UK Monday-Sunday week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  const endOfWeekStr = endOfWeek.toISOString().split("T")[0];

  // Calculate delivery day chart data (last 12 delivery days up to end of current week, oldest to newest for chart)
  const deliveryDaysForChart = [...new Set(orders.filter(o => o.deliveryDay <= endOfWeekStr).map(o => o.deliveryDay))]
    .sort((a, b) => a.localeCompare(b)) // Oldest first (left side of chart)
    .slice(-12); // Last 12
  
  const deliveryDayChartData = deliveryDaysForChart.map(deliveryDay => {
    const dayOrders = orders.filter(o => o.deliveryDay === deliveryDay);
    const orderCount = dayOrders.length;
    const revenue = dayOrders.reduce((sum, o) => sum + orderRevenue(o), 0);
    const basketSum = dayOrders.reduce((sum, o) => sum + orderBasket(o), 0);
    const avgBasket = orderCount > 0 ? basketSum / orderCount : 0;
    
    return {
      date: formatDeliveryDate(deliveryDay),
      revenue,
      orders: orderCount,
      avgBasket,
    };
  });

  // ─── Delivery Day Performance (last 12 delivery days up to end of current week) ───
  // Build firstOrderDateByUser map once
  const firstOrderDateByUser = new Map<string, string>();
  for (const order of orders) {
    const existing = firstOrderDateByUser.get(order.userId);
    if (!existing || order.createdAt < existing) {
      firstOrderDateByUser.set(order.userId, order.createdAt);
    }
  }
  
  // Get unique delivery days up to end of current week
  const deliveryDays = [...new Set(orders.filter(o => o.deliveryDay <= endOfWeekStr).map(o => o.deliveryDay))]
    .sort((a, b) => b.localeCompare(a)) // Most recent first
    .slice(0, 12);
  
  const deliveryDayPerformance = deliveryDays.map(deliveryDay => {
    const dayOrders = orders.filter(o => o.deliveryDay === deliveryDay);
    const orderCount = dayOrders.length;
    const revenue = dayOrders.reduce((sum, o) => sum + orderRevenue(o), 0);
    const basketSum = dayOrders.reduce((sum, o) => sum + orderBasket(o), 0);
    const avgBasket = orderCount > 0 ? basketSum / orderCount : 0;
    
    // Total items (sum of all item.quantity)
    const totalItems = dayOrders.reduce((sum, o) => 
      sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const avgItemsPerBasket = orderCount > 0 ? totalItems / orderCount : 0;
    
    // Unique customers
    const uniqueCustomers = new Set(dayOrders.map(o => o.userId)).size;
    
    // New vs returning
    let newCount = 0;
    let returningCount = 0;
    const seenUsers = new Set<string>();
    for (const order of dayOrders) {
      if (seenUsers.has(order.userId)) continue;
      seenUsers.add(order.userId);
      const firstOrderDate = firstOrderDateByUser.get(order.userId);
      if (firstOrderDate === order.createdAt) {
        newCount++;
      } else {
        returningCount++;
      }
    }
    
    // Unique suppliers
    const supplierIds = new Set<string>();
    for (const order of dayOrders) {
      for (const item of order.items) {
        if (item.supplierId) supplierIds.add(item.supplierId);
      }
    }
    const supplierCount = supplierIds.size;
    
    // Delivery window split
    const morningCount = dayOrders.filter(o => o.deliveryWindow === "morning").length;
    const afternoonCount = dayOrders.filter(o => o.deliveryWindow === "afternoon").length;
    
    return {
      deliveryDay,
      orderCount,
      revenue,
      avgBasket,
      avgItemsPerBasket,
      uniqueCustomers,
      newCount,
      returningCount,
      supplierCount,
      morningCount,
      afternoonCount,
    };
  });

  // ─── Top & Bottom Rated Products ────────────────────────────────────────────
  const minRatings = 3;
  const qualifiedProducts = productRatings.filter(p => p.ratingCount >= minRatings);
  const topRatedProducts = [...qualifiedProducts]
    .sort((a, b) => b.avgStars - a.avgStars)
    .slice(0, 5);
  const lowestRatedProducts = [...qualifiedProducts]
    .sort((a, b) => a.avgStars - b.avgStars)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      <p className="mt-1 text-muted">Overview of your marketplace</p>

      {/* Delivery Day Charts */}
      <div className="mt-8">
        <AdminCharts deliveryDayData={deliveryDayChartData} />
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs text-muted">Total Revenue</p>
              <p className="text-xl font-bold text-primary">£{totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-xs text-muted">Total Orders</p>
              <p className="text-xl font-bold text-primary">{totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Package size={20} />
            </div>
            <div>
              <p className="text-xs text-muted">Avg Basket</p>
              <p className="text-xl font-bold text-primary">£{avgBasketAllTime.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Day Performance */}
      <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Delivery Day Performance</h2>
        </div>
        {deliveryDayPerformance.length === 0 ? (
          <p className="text-sm text-muted">No past delivery days yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-left">
                  <th className="pb-3 pr-4 font-medium text-muted">Date</th>
                  <th className="pb-3 pr-4 font-medium text-muted text-right">Orders</th>
                  <th className="pb-3 pr-4 font-medium text-muted text-right">Revenue</th>
                  <th className="pb-3 pr-4 font-medium text-muted text-right">Avg Basket</th>
                  <th className="pb-3 pr-4 font-medium text-muted text-right">Avg Items</th>
                  <th className="pb-3 pr-4 font-medium text-muted text-right">Customers</th>
                  <th className="pb-3 pr-4 font-medium text-muted">New / Returning</th>
                  <th className="pb-3 pr-4 font-medium text-muted text-right">Suppliers</th>
                  <th className="pb-3 font-medium text-muted">AM / PM</th>
                </tr>
              </thead>
              <tbody>
                {deliveryDayPerformance.map((day) => (
                  <tr key={day.deliveryDay} className="border-b border-primary/5">
                    <td className="py-3 pr-4 font-medium text-primary">{formatDeliveryDate(day.deliveryDay)}</td>
                    <td className="py-3 pr-4 text-right">{day.orderCount}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-green-600">£{day.revenue.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-right">{day.orderCount > 0 ? `£${day.avgBasket.toFixed(2)}` : "—"}</td>
                    <td className="py-3 pr-4 text-right">{day.orderCount > 0 ? day.avgItemsPerBasket.toFixed(1) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{day.uniqueCustomers}</td>
                    <td className="py-3 pr-4">
                      <span className="text-green-600">{day.newCount} new</span>
                      <span className="text-muted"> / </span>
                      <span className="text-blue-600">{day.returningCount} returning</span>
                    </td>
                    <td className="py-3 pr-4 text-right">{day.supplierCount}</td>
                    <td className="py-3">
                      {day.morningCount === 0 && day.afternoonCount === 0 
                        ? "—" 
                        : `${day.morningCount} AM / ${day.afternoonCount} PM`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Top Rated & Lowest Rated Products */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Top Rated Products */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Top Rated Products</h2>
          </div>
          {topRatedProducts.length === 0 ? (
            <p className="text-sm text-muted">No products with {minRatings}+ ratings yet</p>
          ) : (
            <div className="space-y-3">
              {topRatedProducts.map((product, i) => (
                <div key={product.productId} className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                      {i + 1}
                    </span>
                    <span className="font-medium text-primary">{product.productName}</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-semibold text-amber-500">{product.avgStars.toFixed(1)} ★</span>
                    <span className="ml-2 text-muted">({product.ratingCount})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lowest Rated Products */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Lowest Rated Products</h2>
          </div>
          {lowestRatedProducts.length === 0 ? (
            <p className="text-sm text-muted">No products with {minRatings}+ ratings yet</p>
          ) : (
            <div className="space-y-3">
              {lowestRatedProducts.map((product, i) => (
                <div key={product.productId} className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                      {i + 1}
                    </span>
                    <span className="font-medium text-primary">{product.productName}</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-semibold text-amber-500">{product.avgStars.toFixed(1)} ★</span>
                    <span className="ml-2 text-muted">({product.ratingCount})</span>
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
