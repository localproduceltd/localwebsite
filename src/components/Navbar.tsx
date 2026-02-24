"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingCart, Search } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/products", label: "Products" },
  { href: "/map", label: "Map" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems } = useCart();
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname === "/supplier" || pathname.startsWith("/supplier/")) return null;

  return (
    <header className="sticky top-0 z-50 bg-primary text-white shadow-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <img src="/logo-carrot.png" alt="Logo" className="h-14 w-14 object-contain" />
          Local Produce
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-base font-medium transition-colors hover:text-white/70"
            >
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <Link href="/orders" className="text-base font-medium transition-colors hover:text-white/70">
              My Orders
            </Link>
          </SignedIn>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Link href="/products" className="hidden rounded-full bg-white/15 p-2.5 transition hover:bg-white/25 md:inline-flex">
            <Search size={20} />
          </Link>
          <Link href="/cart" className="relative rounded-full bg-white/15 p-2.5 transition hover:bg-white/25">
            <ShoppingCart size={20} />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </Link>

          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="hidden rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-primary transition hover:bg-accent/90 md:inline-flex"
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
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/15 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <Link
              href="/orders"
              className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/15 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              My Orders
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
