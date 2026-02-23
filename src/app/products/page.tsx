"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { addItem, items, products } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || p.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Products</h1>
      <p className="mt-1 text-muted">Browse fresh produce from our local suppliers</p>

      {/* Search & Filter */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
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
                  ? "bg-primary text-white"
                  : "bg-secondary/20 text-primary hover:bg-secondary/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-primary">No products found</p>
          <p className="mt-1 text-sm text-muted">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-[4/3] overflow-hidden bg-secondary/10">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
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
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">&euro;{product.price.toFixed(2)}</span>
                  <span className="text-xs text-muted">{product.unit}</span>
                </div>
                <button
                  disabled={!product.inStock}
                  onClick={() => {
                    addItem(product.id);
                    setJustAdded(product.id);
                    setTimeout(() => setJustAdded(null), 1200);
                  }}
                  className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
          ))}
        </div>
      )}
    </div>
  );
}
