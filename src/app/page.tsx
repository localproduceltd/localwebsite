import Link from "next/link";
import { getApprovedProducts, getActiveSuppliers, getAverageRatings } from "@/lib/data";
import { ArrowRight, Star } from "lucide-react";

export default async function Home() {
  const products = await getApprovedProducts();
  const suppliers = await getActiveSuppliers();
  const avgRatings = await getAverageRatings();
  const localLocalities = ["Own Produce", "Local", "Regional"];
  const featured = products.filter((p) => p.inStock && localLocalities.includes(p.locality)).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 text-center text-white sm:py-20">
        <img src="/background.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#5a6b3f]/50" />
        <div className="relative mx-auto max-w-5xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Derbyshire's Produce, <span className="text-[1.3em] font-extrabold text-accent">Delivered</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl rounded-xl px-6 py-3 text-xl font-semibold text-white backdrop-blur-md bg-white/10">
            Shop Ashbourne &amp; Belper&apos;s best farmers, producers and independents.<br />Quality local food, delivered straight to your door!
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-secondary transition hover:bg-white/90"
            >
              Meet Our Suppliers
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90"
            >
              Browse Products <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-primary/5 bg-surface px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/Pin.png" alt="Pin" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-primary">Know Its Origin</h3>
            <p className="mt-1 text-sm text-muted">Every item is traceable to the farm, producer or maker</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-secondary">
              <img src="/images/Josie.png" alt="Josie" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-primary">Managed Locally</h3>
            <p className="mt-1 text-sm text-muted">Run by me - Josie! I work directly with every supplier</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/clock.png" alt="Effortless" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-primary">Effortless Yet Responsible</h3>
            <p className="mt-1 text-sm text-muted">All your local produce in one sustainable weekly drop</p>
          </div>
        </div>
      </section>

      {/* Suppliers preview */}
      <section className="bg-surface px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary sm:text-3xl">Local Suppliers</h2>
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

      {/* Featured Products */}
      <section className="px-4 py-16">
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
                  <p className="text-xs font-medium text-primary-light">{product.supplierName}</p>
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
                          <Star key={s} size={12} className={avgRatings[product.id].avg >= s ? "fill-[#FFC559] text-[#FFC559]" : avgRatings[product.id].avg >= s - 0.5 ? "fill-[#FFC559]/50 text-[#FFC559]" : "text-[#829461]/15"} />
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
