"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingCart, Search } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/suppliers", label: "Suppliers" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems } = useCart();
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 bg-primary text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="text-accent">&#9670;</span> Local Produce
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <Link href="/orders" className="text-sm font-medium transition-colors hover:text-accent">
              My Orders
            </Link>
          </SignedIn>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link href="/products" className="hidden rounded-full bg-white/10 p-2 transition hover:bg-white/20 md:inline-flex">
            <Search size={18} />
          </Link>
          <Link href="/cart" className="relative rounded-full bg-white/10 p-2 transition hover:bg-white/20">
            <ShoppingCart size={18} />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary">
                {totalItems}
              </span>
            )}
          </Link>

          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="hidden rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-accent/90 md:inline-flex"
            >
              Sign In
            </Link>
          </SignedOut>

          {/* Mobile menu button */}
          <button
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/20 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-white/10 bg-primary px-4 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 hover:text-accent"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <Link
              href="/orders"
              className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 hover:text-accent"
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
