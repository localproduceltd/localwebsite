import Link from "next/link";
import { getApprovedProducts, getActiveSuppliers } from "@/lib/data";
import { ArrowRight, Leaf, Truck, ShieldCheck } from "lucide-react";

export default async function Home() {
  const products = await getApprovedProducts();
  const suppliers = await getActiveSuppliers();
  const localLocalities = ["Own Produce", "Local", "Regional"];
  const featured = products.filter((p) => p.inStock && localLocalities.includes(p.locality)).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 text-center text-white sm:py-20">
        <img src="/background.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Derbyshire's Fresh Produce, <span className="text-[1.15em] font-extrabold text-primary-light">Delivered</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-white/90">
            Shop from Ashbourne &amp; Belper's farmers, producers and independant suppliers. Local, quality food delivered straight to your door!
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90"
            >
              Browse Products <ArrowRight size={18} />
            </Link>
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white/40 px-6 py-3 font-semibold text-white transition hover:border-white hover:bg-white/10"
            >
              Meet Our Suppliers
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-primary/5 bg-surface px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
              <Leaf size={24} />
            </div>
            <h3 className="mt-3 font-semibold text-primary">Locally Sourced</h3>
            <p className="mt-1 text-sm text-muted">All produce comes from verified local farms and producers.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
              <Truck size={24} />
            </div>
            <h3 className="mt-3 font-semibold text-primary">Reliable Delivery</h3>
            <p className="mt-1 text-sm text-muted">Regular delivery days so you always know when to expect your order.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
              <ShieldCheck size={24} />
            </div>
            <h3 className="mt-3 font-semibold text-primary">Quality Guaranteed</h3>
            <p className="mt-1 text-sm text-muted">Every supplier is vetted for quality, freshness and sustainability.</p>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary sm:text-3xl">Featured Products</h2>
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
                  <p className="text-xs font-medium text-primary-light">{product.supplierName}</p>
                  <h3 className="mt-1 font-semibold text-primary">{product.name}</h3>
                  <p className="mt-0.5 text-sm text-muted">{product.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">£{product.price.toFixed(2)}</span>
                    <span className="text-xs text-muted">{product.unit}</span>
                  </div>
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

      {/* Suppliers preview */}
      <section className="bg-surface px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary sm:text-3xl">Our Suppliers</h2>
              <p className="mt-1 text-muted">Meet the people behind your food</p>
            </div>
            <Link href="/suppliers" className="hidden text-sm font-semibold text-secondary hover:underline sm:inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.slice(0, 3).map((supplier) => (
              <Link
                key={supplier.id}
                href={`/suppliers/${supplier.id}`}
                className="group overflow-hidden rounded-xl bg-background shadow-sm transition hover:shadow-md"
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
                  <p className="mt-2 text-xs text-secondary font-medium">{supplier.location}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary px-4 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to order?</h2>
          <p className="mt-2 text-white/70">Sign in to place your order and get fresh local produce delivered on our next delivery day.</p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90"
          >
            Start Shopping <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
