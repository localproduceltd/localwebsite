import Link from "next/link";
import { Package, Users, Calendar, ShoppingCart } from "lucide-react";
import { getProducts, getSuppliers, getOrders, getDeliveryDays } from "@/lib/data";

export default async function AdminDashboard() {
  const [products, suppliers, orders, deliveryDays] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getOrders(),
    getDeliveryDays(),
  ]);

  const stats = [
    { label: "Products", value: products.length, icon: Package, href: "/admin/products", color: "bg-primary" },
    { label: "Suppliers", value: suppliers.length, icon: Users, href: "/admin/suppliers", color: "bg-primary-light" },
    { label: "Orders", value: orders.length, icon: ShoppingCart, href: "/admin/orders", color: "bg-accent" },
    { label: "Delivery Days", value: deliveryDays.filter((d) => d.active).length, icon: Calendar, href: "/admin/delivery-days", color: "bg-secondary" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      <p className="mt-1 text-muted">Manage your marketplace</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-xl bg-surface p-6 shadow-sm transition hover:shadow-md"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${stat.color} text-white`}>
                <Icon size={20} />
              </div>
              <p className="mt-4 text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-muted group-hover:text-primary-light">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">Recent Orders</h2>
          <div className="mt-4 space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg bg-background p-3">
                <div>
                  <p className="text-sm font-medium text-primary">{order.id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted">{order.createdAt}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">&euro;{order.total.toFixed(2)}</p>
                  <p className="text-xs capitalize text-muted">{order.status}</p>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-muted">No orders yet</p>
            )}
          </div>
          <Link href="/admin/orders" className="mt-4 block text-center text-sm font-medium text-primary-light hover:underline">
            View all orders &rarr;
          </Link>
        </div>

        {/* Quick Links */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            <Link href="/admin/products" className="flex items-center gap-3 rounded-lg bg-background p-4 transition hover:bg-secondary/10">
              <Package size={20} className="text-primary" />
              <div>
                <p className="font-medium text-primary">Manage Products</p>
                <p className="text-xs text-muted">Add, edit or remove products</p>
              </div>
            </Link>
            <Link href="/admin/suppliers" className="flex items-center gap-3 rounded-lg bg-background p-4 transition hover:bg-secondary/10">
              <Users size={20} className="text-primary" />
              <div>
                <p className="font-medium text-primary">Manage Suppliers</p>
                <p className="text-xs text-muted">Add, edit or remove suppliers</p>
              </div>
            </Link>
            <Link href="/admin/delivery-days" className="flex items-center gap-3 rounded-lg bg-background p-4 transition hover:bg-secondary/10">
              <Calendar size={20} className="text-primary" />
              <div>
                <p className="font-medium text-primary">Delivery Days</p>
                <p className="text-xs text-muted">Set delivery schedules and cutoff times</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
