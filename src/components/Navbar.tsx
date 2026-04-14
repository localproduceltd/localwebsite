"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingCart, Home, Store, Package, MapPinned, User } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import UserAvatar from "@/components/UserAvatar";
import CarrieFeedback from "@/components/CarrieFeedback";
import { PRE_LAUNCH } from "@/lib/pre-launch";

const NAV_LINKS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/suppliers", label: "Suppliers", icon: Store },
  { href: "/products", label: "Products", icon: Package },
  { href: "/map", label: "Map", icon: MapPinned },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const { totalItems } = useCart();
  const pathname = usePathname();
  const isHoldingPage = pathname === "/holding";

  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier-portal") || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return null;

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-secondary text-surface shadow-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-0.5 text-3xl font-bold tracking-tight">
          <CarrieFeedback />
          <span className="text-5xl font-bold tracking-tight text-surface">Local</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <div key={link.href} className="relative group">
                <Link
                  href={link.href}
                  className="flex items-center gap-1.5 text-base font-medium text-surface transition-colors hover:text-surface/80"
                >
                  <Icon size={16} /> {link.label}
                </Link>
                {isHoldingPage && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                    Coming Soon
                  </div>
                )}
              </div>
            );
          })}
          <SignedIn>
            <div className="relative group">
              <Link href="/account" className="flex items-center gap-1.5 text-base font-medium text-surface transition-colors hover:text-surface/80">
                <User size={16} /> My Account
              </Link>
              {isHoldingPage && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                  Coming Soon
                </div>
              )}
            </div>
          </SignedIn>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {!isHoldingPage && (
            <>
              <Link href="/cart" className="relative rounded-full bg-surface p-2.5 transition hover:bg-surface/90">
                <ShoppingCart size={20} className="text-secondary" />
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </Link>

              <SignedOut>
                {PRE_LAUNCH ? (
                  <button
                    onClick={() => setShowSignInModal(true)}
                    className="hidden rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 md:inline-flex"
                  >
                    Sign In
                  </button>
                ) : (
                  <Link
                    href="/sign-in"
                    className="hidden rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 md:inline-flex"
                  >
                    Sign In
                  </Link>
                )}
              </SignedOut>
            </>
          )}

          <SignedIn>
            <UserAvatar bg="bg-primary" />
          </SignedIn>

          {/* Mobile menu button */}
          <button
            className="rounded-full bg-surface/15 p-2 text-surface transition hover:bg-surface/25 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-surface/20 bg-secondary px-4 pb-4 pt-2 text-surface md:hidden">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-surface transition-colors hover:bg-surface/10 hover:text-surface/80"
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} /> {link.label}
              </Link>
            );
          })}
          <SignedIn>
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-surface transition-colors hover:bg-surface/10 hover:text-surface/80"
              onClick={() => setMobileOpen(false)}
            >
              <User size={16} /> My Account
            </Link>
          </SignedIn>
          <SignedOut>
            {PRE_LAUNCH ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setShowSignInModal(true);
                }}
                className="mt-2 block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-white"
              >
                Sign In
              </button>
            ) : (
              <Link
                href="/sign-in"
                className="mt-2 block rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
          </SignedOut>
        </nav>
      )}
    </header>

      {/* Coming Soon Modal (Pre-launch) */}
      {showSignInModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute right-4 top-4 text-muted hover:text-primary transition"
            >
              <X size={20} />
            </button>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20">
                <User size={32} className="text-secondary" />
              </div>
              <h3 className="text-xl font-bold text-primary">Coming Soon!</h3>
              <p className="mt-2 text-sm text-muted">
                Customer accounts will be available once we launch. Check back soon!
              </p>
              <button
                onClick={() => setShowSignInModal(false)}
                className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
