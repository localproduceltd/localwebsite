"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { PRE_LAUNCH } from "@/lib/pre-launch";
import { User, X } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier-portal") || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return null;

  return (
    <>
    <footer className="bg-primary">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
              <img src="/logo-carrot.png" alt="Logo" className="h-8 w-8 object-contain" />
              <span className="tracking-widest">Local</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Connecting Derbyshire with the finest local farmers and artisan producers.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-secondary">Shop</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/suppliers" className="text-white/60 transition hover:text-white">Our Suppliers</Link></li>
              <li><Link href="/products" className="text-white/60 transition hover:text-white">All Products</Link></li>
              <li><Link href="/map" className="text-white/60 transition hover:text-white">Map</Link></li>
              <li><Link href="/cart" className="text-white/60 transition hover:text-white">Cart</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-secondary">Account</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {PRE_LAUNCH ? (
                <>
                  <li><button onClick={() => setShowComingSoonModal(true)} className="text-white/60 transition hover:text-white">My Orders</button></li>
                  <li><button onClick={() => setShowComingSoonModal(true)} className="text-white/60 transition hover:text-white">Sign In</button></li>
                </>
              ) : (
                <>
                  <li><Link href="/orders" className="text-white/60 transition hover:text-white">My Orders</Link></li>
                  <li><Link href="/sign-in" className="text-white/60 transition hover:text-white">Sign In</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-secondary">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>josie@localproduce.ltd</li>
              <li>Ashbourne, Derbyshire</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} Local Produce Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span>Fresh, local food delivered to your door.</span>
            <Link href="/sign-in" className="hover:text-white/60 transition">Admin</Link>
          </div>
        </div>
      </div>
    </footer>

      {/* Coming Soon Modal (Pre-launch) */}
      {showComingSoonModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowComingSoonModal(false)}
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
                onClick={() => setShowComingSoonModal(false)}
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
