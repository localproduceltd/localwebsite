"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier-portal") || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return null;

  return (
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
              <li><Link href="/orders" className="text-white/60 transition hover:text-white">My Orders</Link></li>
              <li><Link href="/sign-in" className="text-white/60 transition hover:text-white">Sign In</Link></li>
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
          <p className="text-xs text-white/40">
            Fresh, local food delivered to your door.
          </p>
        </div>
      </div>
    </footer>
  );
}
