"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Users, Calendar, ShoppingCart, ArrowLeft } from "lucide-react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/suppliers", label: "Suppliers", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/delivery-days", label: "Delivery Days", icon: Calendar },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-primary/10 bg-surface p-6 lg:block">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-primary">Admin Panel</h2>
          <p className="text-xs text-muted">Manage your marketplace</p>
        </div>
        <nav className="space-y-1">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-background"
                    : "text-muted hover:bg-secondary/10 hover:text-primary"
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-primary/10 pt-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted transition hover:text-primary"
          >
            <ArrowLeft size={16} /> Back to Store
          </Link>
        </div>
      </aside>

      {/* Mobile nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-primary/10 bg-surface lg:hidden">
        {adminLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                isActive ? "text-primary" : "text-muted"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 pb-20 lg:pb-0">{children}</div>
    </div>
  );
}
