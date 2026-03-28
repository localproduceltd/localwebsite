"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignedIn } from "@clerk/nextjs";
import UserAvatar from "@/components/UserAvatar";
import { Store, Package, ClipboardList, ArrowLeft, LayoutDashboard, Menu, X, Eye } from "lucide-react";

const SUPPLIER_NAV = [
  { href: "/supplier-portal", label: "Your Page", icon: Eye },
  { href: "/supplier-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supplier-portal/products", label: "Products", icon: Package },
  { href: "/supplier-portal/orders", label: "Orders", icon: ClipboardList },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Supplier header */}
      <header className="sticky top-0 z-50 bg-secondary text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white">
              <ArrowLeft size={16} /> Back to site
            </Link>
            <span className="text-lg font-bold">Supplier Portal</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {SUPPLIER_NAV.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-white/60 hover:text-white/90"
                  }`}
                >
                  <Icon size={16} /> {link.label}
                </Link>
              );
            })}
            <SignedIn>
              <UserAvatar size="h-8 w-8" bg="bg-primary" />
            </SignedIn>
          </nav>

          {/* Mobile menu button + avatar */}
          <div className="flex items-center gap-3 md:hidden">
            <SignedIn>
              <UserAvatar size="h-8 w-8" bg="bg-primary" />
            </SignedIn>
            <button
              className="rounded-full bg-white/15 p-2 transition hover:bg-white/25"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="border-t border-white/20 bg-secondary px-4 pb-4 pt-2 md:hidden">
            {SUPPLIER_NAV.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={16} /> {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {children}
    </div>
  );
}
