"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Star, MapPinned, Loader2, CheckCircle } from "lucide-react";
import { getApprovedProducts, getActiveSuppliers, getAverageRatings, getActiveDeliveryDays, submitEmailSignup, getAllReviews } from "@/lib/data";
import type { Product, Supplier, DeliveryDay } from "@/lib/data";
import AboutJosie from "@/components/AboutJosie";
import SupplierDistance from "@/components/SupplierDistance";
import ProductCard from "@/components/ProductCard";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDay[]>([]);
  const [reviews, setReviews] = useState<Array<{ productName: string | null; stars: number | null; comment: string; createdAt: string; customerName: string | null; isOverall: boolean }>>([]);

  // Email signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleEmailSignup = async () => {
    if (!signupEmail.trim() || !signupEmail.includes("@")) return;
    setSignupSubmitting(true);
    try {
      await submitEmailSignup(signupEmail);
      setSignupDone(true);
    } catch (error) {
      console.error("Failed to submit email:", error);
    }
    setSignupSubmitting(false);
  };

  useEffect(() => {
    Promise.all([
      getApprovedProducts(),
      getActiveSuppliers(),
      getAverageRatings(),
      getActiveDeliveryDays(),
      getAllReviews(),
    ]).then(([p, s, r, d, rev]) => {
      setProducts(p);
      setSuppliers(s);
      setAvgRatings(r);
      setDeliveryDays(d);
      setReviews(rev);
    }).catch(console.error);
  }, []);

  const nextDelivery = deliveryDays[0] ?? null;
  // Josie's Top Picks - products tagged with "josies-pick"
  const featured = products.filter((p) => p.inStock && p.tags?.includes("josies-pick")).slice(0, 4);

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
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90"
            >
              Start Shopping <ArrowRight size={18} />
            </Link>
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-2 rounded-lg bg-surface px-6 py-3 font-semibold text-primary transition hover:bg-surface/90"
            >
              Meet Our Suppliers
            </Link>
          </div>
        </div>
      </section>

      {/* Week 1 Banner */}
      <section className="bg-primary px-4 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">🎉 Week 1 Orders Open</h2>
          <p className="mt-3 text-lg text-white/90">
            We&apos;re open to a small group of waitlist customers. Enter your email below to join the waitlist and hear when we open to more.
          </p>
          {signupDone ? (
            <div className="mt-6 inline-flex items-center gap-2 text-white">
              <CheckCircle size={20} />
              <p className="font-semibold">Thanks! We&apos;ll keep you updated.</p>
            </div>
          ) : (
            <form 
              onSubmit={(e) => { e.preventDefault(); handleEmailSignup(); }}
              className="mt-6 mx-auto max-w-md"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="flex-1 rounded-lg bg-white px-4 py-3 text-primary outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={signupSubmitting}
                  className="rounded-lg bg-white px-6 py-3 font-semibold text-primary transition hover:bg-white/90 disabled:opacity-50"
                >
                  {signupSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Register"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-primary/5 bg-white px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
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
          <AboutJosie />
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/Pin.png" alt="Pin" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-secondary">Know The Origin</h3>
            <p className="mt-1 text-sm text-muted">Where possible, items are traceable to the farm, producer, or maker</p>
            <Link 
              href="/map?view=suppliers" 
              className="mt-3 text-sm font-semibold text-secondary hover:underline"
            >
              See the Produce Map →
            </Link>
          </div>
        </div>
      </section>

      {/* Suppliers preview */}
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
                <div className="relative aspect-[3/2] overflow-hidden">
                  <Image
                    src={supplier.image}
                    alt={supplier.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform group-hover:scale-105"
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

      {/* Featured Products */}
      <section className="bg-surface px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary sm:text-3xl">Josie's Top Picks</h2>
              <p className="mt-1 text-muted">Hand-picked favourites from our suppliers</p>
            </div>
            <Link href="/products" className="hidden text-sm font-semibold text-secondary hover:underline sm:inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link href="/products" className="text-sm font-semibold text-secondary hover:underline">
              View all products &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Customer Reviews */}
      {reviews.length > 0 && (
        <section className="bg-secondary/5 px-4 py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-primary sm:text-3xl">What Our Customers Say</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {reviews.slice(0, 4).map((review, i) => (
                <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
                  {review.stars !== null && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={16} className={review.stars! >= s ? "fill-accent text-accent" : "text-gray-200"} />
                      ))}
                    </div>
                  )}
                  <p className={`${review.stars !== null ? "mt-3" : ""} text-sm text-primary italic`}>&ldquo;{review.comment}&rdquo;</p>
                  <p className="mt-3 text-xs text-muted">
                    {review.isOverall ? (
                      <span className="font-semibold text-secondary">{review.customerName?.split(" ")[0] || "Customer"}</span>
                    ) : (
                      <>About <span className="font-semibold text-secondary">{review.productName}</span></>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-secondary px-4 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to taste the difference?</h2>
          <p className="mt-2 text-white/90">Sign in and get fresh local produce from Derbyshire&apos;s best, delivered straight to your door.</p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary/90"
          >
            Start Shopping <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
