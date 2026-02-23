import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-primary/10 bg-primary text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold">
              <span className="text-accent">&#9670;</span> Local Produce
            </h3>
            <p className="mt-2 text-sm text-white/70">
              Connecting you with the finest local farmers and artisan producers.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold text-accent">Shop</h4>
            <ul className="mt-2 space-y-1 text-sm text-white/70">
              <li><Link href="/products" className="hover:text-white">All Products</Link></li>
              <li><Link href="/suppliers" className="hover:text-white">Our Suppliers</Link></li>
              <li><Link href="/cart" className="hover:text-white">Cart</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold text-accent">Account</h4>
            <ul className="mt-2 space-y-1 text-sm text-white/70">
              <li><Link href="/orders" className="hover:text-white">My Orders</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign In</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-accent">Contact</h4>
            <ul className="mt-2 space-y-1 text-sm text-white/70">
              <li>info@localproduce.ie</li>
              <li>+353 1 234 5678</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          &copy; {new Date().getFullYear()} Local Produce Ltd. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
