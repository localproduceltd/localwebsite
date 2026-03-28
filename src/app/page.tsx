"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Star, MapPin, Package } from "lucide-react";
import { getApprovedProducts, getActiveSuppliers, getAverageRatings, getActiveDeliveryDays } from "@/lib/data";
import type { Product, Supplier, DeliveryDay } from "@/lib/data";
import AboutJosie from "@/components/AboutJosie";
import SupplierDistance from "@/components/SupplierDistance";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDay[]>([]);

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
            <Link href="/map" className="mt-2 text-xs font-medium text-secondary hover:underline">
              Click to see if we cover your area &rarr;
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
            {suppliers.slice(0, 3).map((supplier) => (
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
        </div>
      </section>

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
