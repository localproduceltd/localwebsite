"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignedIn, UserButton } from "@clerk/nextjs";
import { Store, Package, ClipboardList, ArrowLeft, LayoutDashboard } from "lucide-react";

const SUPPLIER_NAV = [
  { href: "/supplier", label: "Profile", icon: Store },
  { href: "/supplier/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supplier/products", label: "Products", icon: Package },
  { href: "/supplier/orders", label: "Orders", icon: ClipboardList },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-background">
      {/* Supplier header */}
      <header className="sticky top-0 z-50 bg-secondary text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white">
              <ArrowLeft size={16} /> Back to site
            </Link>
            <span className="text-lg font-bold">Supplier Portal</span>
          </div>

          <nav className="flex items-center gap-6">
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
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: "h-8 w-8" } }}
              />
            </SignedIn>
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
