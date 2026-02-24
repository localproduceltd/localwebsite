"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingCart, Home, Store, Package, MapPinned, ClipboardList } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import UserAvatar from "@/components/UserAvatar";
import CarrieFeedback from "@/components/CarrieFeedback";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/suppliers", label: "Suppliers", icon: Store },
  { href: "/products", label: "Products", icon: Package },
  { href: "/map", label: "Map", icon: MapPinned },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems } = useCart();
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier-portal") || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return null;

  return (
    <header className="sticky top-0 z-50 bg-primary text-white shadow-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-0.5 text-3xl font-bold tracking-tight">
          <CarrieFeedback />
          <span className="text-4xl font-bold tracking-wide rounded-lg bg-[#5a6b3f] px-3 py-1">Local</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-base font-medium transition-colors hover:text-white/70"
              >
                <Icon size={16} /> {link.label}
              </Link>
            );
          })}
          <SignedIn>
            <Link href="/orders" className="flex items-center gap-1.5 text-base font-medium transition-colors hover:text-white/70">
              <ClipboardList size={16} /> My Orders
            </Link>
          </SignedIn>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Link href="/cart" className="relative rounded-full bg-white/15 p-2.5 transition hover:bg-white/25">
            <ShoppingCart size={20} />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </Link>

          <SignedIn>
            <UserAvatar />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="hidden rounded-lg bg-primary-light px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-light/90 md:inline-flex"
            >
              Sign In
            </Link>
          </SignedOut>

          {/* Mobile menu button */}
          <button
            className="rounded-full bg-white/15 p-2 transition hover:bg-white/25 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-white/20 bg-primary px-4 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/15 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} /> {link.label}
              </Link>
            );
          })}
          <SignedIn>
            <Link
              href="/orders"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/15 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <ClipboardList size={16} /> My Orders
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="mt-2 block rounded-md bg-accent px-3 py-2 text-center text-sm font-semibold text-primary"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
          </SignedOut>
        </nav>
      )}
    </header>
  );
}
