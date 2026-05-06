"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Search, Check, Plus, Minus, Star, HelpCircle, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { LOCALITY_OPTIONS, getAverageRatings } from "@/lib/data";
import type { Locality, Product } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { PRODUCT_CATEGORIES, PRODUCT_TAGS } from "@/lib/categories";
import ProductDetailModal from "@/components/ProductDetailModal";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedLocalities, setSelectedLocalities] = useState<Set<Locality>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const { addItem, updateQuantity, items, products } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showLocalityInfo, setShowLocalityInfo] = useState(false);

  useEffect(() => {
    getAverageRatings().then(setAvgRatings).catch(console.error);
  }, []);

  const categories = ["All", ...PRODUCT_CATEGORIES];

  const localityOptions: ("All" | Locality)[] = ["All", ...LOCALITY_OPTIONS];

  // Locality priority: Own Produce/Local/Regional = 0, UK = 1, International = 2, TBC = 3
  const localityPriority: Record<string, number> = { "Own Produce": 0, "Local": 0, "Regional": 0, "UK": 1, "International": 2, "TBC": 3 };

  // Calculate search relevance score for a product
  const getSearchScore = (p: Product, searchTerm: string): number => {
    if (!searchTerm) return 0;
    const term = searchTerm.toLowerCase();
    const name = p.name.toLowerCase();
    const supplier = p.supplierName.toLowerCase();
    const desc = p.description.toLowerCase();
    const cat = p.category.toLowerCase();
    
    // Name starts with search term - highest priority
    if (name.startsWith(term)) return 100;
    // Name contains a word starting with search term
    if (name.split(/\s+/).some(word => word.startsWith(term))) return 80;
    // Name contains search term anywhere
    if (name.includes(term)) return 60;
    // Category matches (e.g. "meat" shows all Meat products)
    if (cat.startsWith(term) || cat.includes(term)) return 50;
    // Supplier name matches
    if (supplier.startsWith(term) || supplier.split(/\s+/).some(word => word.startsWith(term))) return 40;
    if (supplier.includes(term)) return 30;
    // Description matches
    if (desc.includes(term)) return 20;
    return 0;
  };

  const filtered = (() => {
    const searchTerm = search.trim().toLowerCase();
    
    // First filter products
    const matchingProducts = products.filter((p) => {
      const matchesSearch = !searchTerm || getSearchScore(p, searchTerm) > 0;
      const matchesCategory = category === "All" || p.category === category;
      const matchesLocality = selectedLocalities.size === 0 || selectedLocalities.has(p.locality);
      const matchesTags = selectedTags.size === 0 || Array.from(selectedTags).every((tag) => p.tags?.includes(tag));
      return matchesSearch && matchesCategory && matchesLocality && matchesTags;
    });

    // If searching, sort by relevance score then locality
    if (searchTerm) {
      return matchingProducts.sort((a, b) => {
        const scoreDiff = getSearchScore(b, searchTerm) - getSearchScore(a, searchTerm);
        if (scoreDiff !== 0) return scoreDiff;
        const localityDiff = (localityPriority[a.locality] ?? 9) - (localityPriority[b.locality] ?? 9);
        if (localityDiff !== 0) return localityDiff;
        return a.name.localeCompare(b.name);
      });
    }

    // No search: group by category, sorted by locality priority within each category
    const byCategory = new Map<string, typeof matchingProducts>();
    for (const p of matchingProducts) {
      if (!byCategory.has(p.category)) byCategory.set(p.category, []);
      byCategory.get(p.category)!.push(p);
    }
    // Sort each category by locality priority, then by name
    for (const [, prods] of byCategory) {
      prods.sort((a, b) => {
        const localityDiff = (localityPriority[a.locality] ?? 9) - (localityPriority[b.locality] ?? 9);
        if (localityDiff !== 0) return localityDiff;
        return a.name.localeCompare(b.name);
      });
    }

    // Round-robin interleave categories
    const categoryArrays = Array.from(byCategory.values());
    const result: typeof matchingProducts = [];
    let maxLen = Math.max(...categoryArrays.map((arr) => arr.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const arr of categoryArrays) {
        if (i < arr.length) result.push(arr[i]);
      }
    }
    return result;
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Products</h1>
        <p className="mt-1 text-secondary">Browse fresh produce from our local suppliers</p>
      </div>

      {/* Search & Filters */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search products or suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-primary/20 bg-surface py-3.5 pl-10 pr-4 text-base outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
          />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="category-select" className="text-sm font-semibold text-muted">
            Category:
          </label>
          <select
            id="category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-primary/20 bg-surface px-4 py-2 text-sm font-medium text-primary outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Locality Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowLocalityInfo(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wide mr-1 hover:text-secondary transition cursor-pointer"
          >
            Locality:
            <HelpCircle size={14} className="text-secondary" />
          </button>
          <button
            onClick={() => setSelectedLocalities(new Set())}
            className="rounded-full px-3 py-1 text-xs font-semibold transition"
            style={{
              background: selectedLocalities.size === 0 ? "#A30E4E" : "#e5e7eb",
              color: selectedLocalities.size === 0 ? "#fff" : "#A30E4E",
            }}
          >
            All
          </button>
          {LOCALITY_OPTIONS.map((loc) => {
            const isActive = selectedLocalities.has(loc);
            const colors = LOCALITY_COLORS[loc];
            return (
              <button
                key={loc}
                onClick={() => {
                  const newSet = new Set(selectedLocalities);
                  if (isActive) {
                    newSet.delete(loc);
                  } else {
                    newSet.add(loc);
                  }
                  setSelectedLocalities(newSet);
                }}
                className="rounded-full px-3 py-1 text-xs font-semibold transition"
                style={{
                  background: isActive ? colors.dot : colors.bg,
                  color: isActive ? "#fff" : colors.text,
                  border: `1px solid ${isActive ? colors.dot : colors.border}`,
                }}
              >
                {loc}
              </button>
            );
          })}
        </div>

        {/* Tags Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Dietary:</span>
          {PRODUCT_TAGS.map((tag) => {
            const isActive = selectedTags.has(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => {
                  const newSet = new Set(selectedTags);
                  if (isActive) {
                    newSet.delete(tag.id);
                  } else {
                    newSet.add(tag.id);
                  }
                  setSelectedTags(newSet);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isActive ? tag.color : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {tag.label}
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
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => {
            const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
            return (
              <div
                key={product.id}
                className={`group flex flex-col overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md ${
                  !product.inStock ? "opacity-60 grayscale" : ""
                }`}
              >
                <div 
                  className="relative aspect-square overflow-hidden bg-secondary/10 cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted text-sm">No image</div>
                  )}
                  {/* Locality badge and stars overlay */}
                  <div className="absolute left-2.5 top-2 flex flex-col gap-1 items-start">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm text-center min-w-[60px]"
                      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      {product.locality}
                    </span>
                    {/* Stars overlay */}
                    {avgRatings[product.id] && (
                      <div className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 backdrop-blur-[2px] ml-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={9} className={avgRatings[product.id].avg >= s ? "fill-accent text-accent" : avgRatings[product.id].avg >= s - 0.5 ? "fill-accent/50 text-accent" : "text-white/40"} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                          ))}
                        </div>
                        <span className="text-[9px] font-semibold text-white ml-0.5">({avgRatings[product.id].count})</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-secondary">{product.supplierName}</p>
                    {!product.inStock && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Out of Stock
                      </span>
                    )}
                  </div>
                  <h3 
                    className="mt-1 text-sm font-semibold text-primary sm:text-base cursor-pointer hover:text-secondary transition"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {product.name}
                  </h3>
                  <p 
                    className="mt-0.5 text-xs text-muted line-clamp-2 sm:text-sm cursor-pointer hover:text-primary/70 transition"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {product.description}
                  </p>
                  {/* Tags on card */}
                  {product.tags && product.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {product.tags.slice(0, 3).map((tagId) => {
                        const tag = PRODUCT_TAGS.find((t) => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span key={tagId} className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tag.color}`}>
                            {tag.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between sm:mt-2">
                    <span className="text-sm font-bold text-primary sm:text-lg">£{product.price.toFixed(2)}</span>
                    <span className="text-[10px] text-muted sm:text-xs">{product.unit}</span>
                  </div>
                  <div className="mt-auto pt-1">
                  {(() => {
                    const cartItem = items.find(i => i.productId === product.id);
                    if (!product.inStock) {
                      return (
                        <div className="mt-2 flex w-full items-center justify-center rounded-lg border-2 border-muted/30 bg-muted/10 py-1.5 text-xs font-semibold text-muted sm:mt-3 sm:py-2 sm:text-sm">
                          Out of Stock
                        </div>
                      );
                    }
                    if (cartItem && justAdded !== product.id) {
                      return (
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-2 py-1 sm:mt-3 sm:px-3 sm:py-1.5">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-semibold text-primary sm:text-sm">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        onClick={() => {
                          addItem(product.id);
                          setJustAdded(product.id);
                          setTimeout(() => setJustAdded(null), 1200);
                        }}
                        className={`mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-background transition sm:mt-3 sm:py-2 sm:text-sm ${
                          justAdded === product.id ? "bg-secondary" : "bg-primary hover:bg-secondary"
                        }`}
                      >
                        {justAdded === product.id ? (
                          <span className="inline-flex items-center gap-1"><Check size={14} /> Added!</span>
                        ) : "Add to Cart"}
                      </button>
                    );
                  })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        avgRatings={avgRatings}
      />

      {/* Locality Info Modal */}
      {showLocalityInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowLocalityInfo(false)}
              className="absolute right-4 top-4 text-muted hover:text-primary transition"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-primary mb-4">What does Locality mean?</h3>
            <p className="text-sm text-muted mb-4">
              Locality shows where a product comes from, helping you choose how local you want to go.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: LOCALITY_COLORS["Own Produce"].bg, color: LOCALITY_COLORS["Own Produce"].text, border: `1px solid ${LOCALITY_COLORS["Own Produce"].border}` }}
                >
                  Own Produce
                </span>
                <p className="text-sm text-muted">Grown or made by the supplier themselves</p>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: LOCALITY_COLORS["Local"].bg, color: LOCALITY_COLORS["Local"].text, border: `1px solid ${LOCALITY_COLORS["Local"].border}` }}
                >
                  Local
                </span>
                <p className="text-sm text-muted">From within 20 miles of Ashbourne</p>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: LOCALITY_COLORS["Regional"].bg, color: LOCALITY_COLORS["Regional"].text, border: `1px solid ${LOCALITY_COLORS["Regional"].border}` }}
                >
                  Regional
                </span>
                <p className="text-sm text-muted">From Derbyshire or surrounding counties</p>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: LOCALITY_COLORS["UK"].bg, color: LOCALITY_COLORS["UK"].text, border: `1px solid ${LOCALITY_COLORS["UK"].border}` }}
                >
                  UK
                </span>
                <p className="text-sm text-muted">From elsewhere in the United Kingdom</p>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: LOCALITY_COLORS["International"].bg, color: LOCALITY_COLORS["International"].text, border: `1px solid ${LOCALITY_COLORS["International"].border}` }}
                >
                  International
                </span>
                <p className="text-sm text-muted">Imported from outside the UK, selected by the supplier</p>
              </div>
            </div>
            <button
              onClick={() => setShowLocalityInfo(false)}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
