"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Users, Calendar, MessageCircleHeart, MapPin, UserCircle, Menu, X, Truck, Navigation, ShoppingCart } from "lucide-react";
import { SignedIn, useUser } from "@clerk/nextjs";
import UserAvatar from "@/components/UserAvatar";

// Tabs the "driver" role can see; middleware blocks the rest of /admin for drivers
const driverLinkHrefs = ["/admin/driver", "/admin/customers"];

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/stock", label: "Stock", icon: Package },
  { href: "/admin/deliveries", label: "Deliveries", icon: Truck },
  { href: "/admin/driver", label: "Driver Run", icon: Navigation },
  { href: "/admin/customers", label: "Customers", icon: UserCircle },
  { href: "/admin/saved-baskets", label: "Saved Baskets", icon: ShoppingCart },
  { href: "/admin/delivery", label: "Delivery Zones", icon: MapPin },
  { href: "/admin/delivery-days", label: "Delivery Days", icon: Calendar },
  { href: "/admin/suppliers", label: "Suppliers", icon: Users },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/feedback", label: "Feedback", icon: MessageCircleHeart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useUser();

  const role = user?.publicMetadata?.role as string | undefined;
  const links = role === "driver"
    ? adminLinks.filter((link) => driverLinkHrefs.includes(link.href))
    : adminLinks;

  const currentPage = links.find(link => link.href === pathname) || links[0];
  const CurrentIcon = currentPage.icon;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Admin header */}
      <header className="sticky top-0 z-50 bg-secondary text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Desktop: show title */}
          <div className="hidden lg:flex items-center gap-6">
            <span className="text-lg font-bold">Admin Panel</span>
          </div>
          
          {/* Mobile: show current page with dropdown trigger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex lg:hidden items-center gap-2 text-white"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            <CurrentIcon size={18} />
            <span className="font-semibold">{currentPage.label}</span>
          </button>
          
          <SignedIn>
            <UserAvatar size="h-8 w-8" bg="bg-primary" />
          </SignedIn>
        </div>
        
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-secondary border-t border-white/10">
            <nav className="px-4 py-2 space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <div className="flex flex-1">
      {/* Sidebar - desktop only */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-primary/10 bg-surface p-6 lg:block">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-primary">Admin Panel</h2>
          <p className="text-xs text-muted">Manage your marketplace</p>
        </div>
        <nav className="space-y-1">
          {links.map((link) => {
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
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
