"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { LOCALITY_OPTIONS } from "@/lib/data";
import type { Locality } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [locality, setLocality] = useState<"All" | Locality>("All");
  const { addItem, items, products } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const localityOptions: ("All" | Locality)[] = ["All", ...LOCALITY_OPTIONS];

  const localityOrder: Record<string, number> = { "Own Produce": 0, "Local": 1, "Regional": 2, "UK": 3, "International": 4 };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || p.category === category;
    const matchesLocality = locality === "All" || p.locality === locality;
    return matchesSearch && matchesCategory && matchesLocality;
  }).sort((a, b) => (localityOrder[a.locality] ?? 9) - (localityOrder[b.locality] ?? 9));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Products</h1>
        <p className="mt-1 text-muted">Browse fresh produce from our local suppliers</p>
      </div>

      {/* Search & Filters */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search products or suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-primary/20 bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary-light focus:ring-2 focus:ring-primary-light/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  category === cat
                    ? "bg-primary text-background"
                    : "bg-secondary/20 text-primary hover:bg-secondary/30"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Locality Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Locality:</span>
          {localityOptions.map((loc) => {
            const isActive = locality === loc;
            const colors = loc !== "All" ? LOCALITY_COLORS[loc] : null;
            return (
              <button
                key={loc}
                onClick={() => setLocality(loc)}
                className="rounded-full px-3 py-1 text-xs font-semibold transition"
                style={
                  loc === "All"
                    ? {
                        background: isActive ? "#1f5d3b" : "#e5e7eb",
                        color: isActive ? "#f7f5ef" : "#1f5d3b",
                      }
                    : {
                        background: isActive ? colors!.dot : colors!.bg,
                        color: isActive ? "#fff" : colors!.text,
                        border: `1px solid ${isActive ? colors!.dot : colors!.border}`,
                      }
                }
              >
                {loc}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-primary">No products found</p>
          <p className="mt-1 text-sm text-muted">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
            return (
              <div
                key={product.id}
                className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
              >
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
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-primary-light">{product.supplierName}</p>
                    {!product.inStock && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Out of Stock
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 font-semibold text-primary">{product.name}</h3>
                  <p className="mt-0.5 text-sm text-muted">{product.description}</p>
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    {product.locality}
                  </span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">£{product.price.toFixed(2)}</span>
                    <span className="text-xs text-muted">{product.unit}</span>
                  </div>
                  <button
                    disabled={!product.inStock}
                    onClick={() => {
                      addItem(product.id);
                      setJustAdded(product.id);
                      setTimeout(() => setJustAdded(null), 1200);
                    }}
                    className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      justAdded === product.id
                        ? "bg-primary-light"
                        : "bg-primary hover:bg-primary-light"
                    }`}
                  >
                    {!product.inStock ? "Unavailable" : justAdded === product.id ? (
                      <span className="inline-flex items-center gap-1"><Check size={14} /> Added!</span>
                    ) : (
                      `Add to Cart${items.find(i => i.productId === product.id) ? ` (${items.find(i => i.productId === product.id)!.quantity})` : ""}`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
