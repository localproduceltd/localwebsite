"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Star, Calendar, Mail, CheckCircle2, MapPinned } from "lucide-react";
import { getApprovedProducts, getActiveSuppliers, getAverageRatings, getActiveDeliveryDays } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Product, Supplier, DeliveryDay } from "@/lib/data";
import AboutJosie from "@/components/AboutJosie";
import SupplierDistance from "@/components/SupplierDistance";
import { PRE_LAUNCH, LAUNCH_DATE } from "@/lib/pre-launch";
import { useAuth } from "@clerk/nextjs";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDay[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const { isSignedIn, isLoaded } = useAuth();
  // Show pre-launch to signed-out users only; signed-in users see launch version
  // Wait for auth to load before deciding
  const showPreLaunch = PRE_LAUNCH && isLoaded && !isSignedIn;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError("");
    try {
      const { error } = await supabase
        .from("email_signups")
        .insert([{ email, created_at: new Date().toISOString() }]);
      if (error) throw error;
      setEmailSubmitted(true);
      setEmail("");
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      getApprovedProducts(),
      getActiveSuppliers(),
      getAverageRatings(),
      getActiveDeliveryDays(),
    ]).then(([p, s, r, d]) => {
      setProducts(p);
      setSuppliers(s);
      setAvgRatings(r);
      setDeliveryDays(d);
    }).catch(console.error);
  }, []);

  const nextDelivery = deliveryDays[0] ?? null;
  const localLocalities = ["Own Produce", "Local", "Regional"];
  const featured = products.filter((p) => p.inStock && localLocalities.includes(p.locality)).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 text-center text-white sm:py-10">
        <img src="/Header Image.jpg" alt="" className="absolute inset-0 h-full w-full object-cover brightness-50" />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex justify-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-surface drop-shadow-sm sm:text-6xl lg:text-7xl sm:whitespace-nowrap">
              Derbyshire's Produce: <span className="font-extrabold uppercase tracking-wider text-surface">Delivered</span>
            </h1>
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
            {showPreLaunch ? (
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90"
                  onClick={() => setShowTooltip(!showTooltip)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  Start Shopping <ArrowRight size={18} />
                </button>
                {showTooltip && (
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    Coming {LAUNCH_DATE}!
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-8 border-transparent border-b-primary" />
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90"
              >
                Start Shopping <ArrowRight size={18} />
              </Link>
            )}
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-2 rounded-lg bg-surface px-6 py-3 font-semibold text-primary transition hover:bg-surface/90"
            >
              Meet Our Suppliers
            </Link>
          </div>
        </div>
      </section>

      {/* Email Signup - Pre-launch only */}
      {showPreLaunch && (
        <section className="bg-secondary/10 px-4 py-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-primary sm:text-3xl">
              Register Your Interest
            </h2>
            <p className="mt-2 text-muted">
              Add your email address to stay tuned for launch and receive exclusive offers!
            </p>

            {!emailSubmitted ? (
              <form onSubmit={handleEmailSubmit} className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      required
                      className="w-full rounded-lg border border-primary/20 bg-white px-4 py-3 text-base outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50"
                  >
                    <Mail size={20} />
                    {emailLoading ? "Signing up..." : "Keep Me Posted"}
                  </button>
                </div>
                {emailError && (
                  <p className="mt-3 text-sm text-red-600">{emailError}</p>
                )}
              </form>
            ) : (
              <div className="mt-6 rounded-xl bg-green-50 border-2 border-green-200 px-6 py-6">
                <div className="flex items-center justify-center gap-3 text-green-800">
                  <CheckCircle2 size={28} />
                  <div className="text-left">
                    <p className="text-lg font-bold">You're on the list!</p>
                    <p className="text-sm text-green-700">
                      We'll send you updates and exclusive offers soon.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Value props */}
      <section className="border-b border-primary/5 bg-white px-4 py-12">
        <p className="mx-auto mb-10 max-w-7xl text-center text-xl font-semibold text-primary sm:text-2xl">
          Ashbourne &amp; Belper&apos;s best farmers, producers and independents.<br />Quality local food, delivered directly to your door!
        </p>
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/Pin.png" alt="Pin" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-secondary">Know The Origin</h3>
            <p className="mt-1 text-sm text-muted">Every item traceable to the farm, producer or maker</p>
          </div>
          <AboutJosie />
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/clock.png" alt="Next Delivery" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-secondary">Next Delivery Day</h3>
            {nextDelivery ? (
              <p className="mt-1 text-sm font-bold text-secondary">
                {new Date(nextDelivery.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Coming soon</p>
            )}
            <Link 
              href="/map" 
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90"
            >
              <MapPinned size={16} />
              Check if we deliver to you
            </Link>
          </div>
        </div>
      </section>

      {/* Suppliers preview - hide for pre-launch */}
      {!showPreLaunch && (
        <section className="border-t border-primary/5 bg-surface px-4 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-primary sm:text-3xl">Local Suppliers</h2>
                <p className="mt-1 text-muted">Meet the farmers, producers and suppliers behind your produce</p>
              </div>
              <Link href="/suppliers" className="hidden text-sm font-semibold text-secondary hover:underline sm:inline-flex items-center gap-1">
                View all <ArrowRight size={14} />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {suppliers.slice(0, 4).map((supplier) => (
                <Link
                  key={supplier.id}
                  href={`/suppliers/${supplier.id}`}
                  className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
                >
                  <div className="aspect-[3/2] overflow-hidden">
                    <img
                      src={supplier.image}
                      alt={supplier.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <span className="inline-block rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {supplier.category}
                    </span>
                    <h3 className="mt-2 font-semibold text-primary">{supplier.name}</h3>
                    <p className="mt-1 text-sm text-muted line-clamp-2">{supplier.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-secondary font-medium">{supplier.location}</p>
                      <SupplierDistance supplierLat={supplier.lat} supplierLng={supplier.lng} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Link href="/suppliers" className="text-sm font-semibold text-secondary hover:underline">
                View all suppliers &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="bg-surface px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary sm:text-3xl">Josie's Top Picks</h2>
              <p className="mt-1 text-muted">Hand-picked favourites from our suppliers</p>
            </div>
            {!showPreLaunch && (
              <Link href="/products" className="hidden text-sm font-semibold text-secondary hover:underline sm:inline-flex items-center gap-1">
                View all <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {showPreLaunch ? (
            <div className="mt-8 relative">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 blur-sm opacity-50 pointer-events-none">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="overflow-hidden rounded-xl bg-white shadow-sm">
                    <div className="aspect-[4/3] bg-secondary/20" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 w-16 bg-secondary/20 rounded" />
                      <div className="h-4 w-24 bg-primary/20 rounded" />
                      <div className="h-3 w-32 bg-muted/20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-xl bg-white/95 px-8 py-6 text-center shadow-lg">
                  <Calendar className="mx-auto h-10 w-10 text-secondary" />
                  <p className="mt-3 text-xl font-bold text-primary">Coming {LAUNCH_DATE}</p>
                  <p className="mt-1 text-sm text-muted">Browse our suppliers in the meantime!</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((product) => (
                  <div key={product.id} className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md">
                    <div className="aspect-[4/3] overflow-hidden bg-secondary/10">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted text-sm">No image</div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-medium text-secondary">{product.supplierName}</p>
                      <h3 className="mt-1 font-semibold text-primary">{product.name}</h3>
                      <p className="mt-0.5 text-sm text-muted">{product.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">£{product.price.toFixed(2)}</span>
                        <span className="text-xs text-muted">{product.unit}</span>
                      </div>
                      {avgRatings[product.id] && (
                        <div className="mt-1 flex items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} size={12} className={avgRatings[product.id].avg >= s ? "fill-accent text-accent" : avgRatings[product.id].avg >= s - 0.5 ? "fill-accent/50 text-accent" : "text-primary/15"} />
                            ))}
                          </div>
                          <span className="text-xs text-muted">({avgRatings[product.id].count})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center sm:hidden">
                <Link href="/products" className="text-sm font-semibold text-secondary hover:underline">
                  View all products &rarr;
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary px-4 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl">
          {showPreLaunch ? (
            <>
              <h2 className="text-2xl font-bold sm:text-3xl">Launching {LAUNCH_DATE}</h2>
              <p className="mt-2 text-white/90">Fresh local produce from Derbyshire&apos;s best, delivered straight to your door.</p>
              <Link
                href="/suppliers"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary/90"
              >
                Meet Our Suppliers <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold sm:text-3xl">Ready to taste the difference?</h2>
              <p className="mt-2 text-white/90">Sign in and get fresh local produce from Derbyshire&apos;s best, delivered straight to your door.</p>
              <Link
                href="/products"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary/90"
              >
                Start Shopping <ArrowRight size={18} />
              </Link>
            </>
          )}
        </div>
      </section>
    </>
  );
}
