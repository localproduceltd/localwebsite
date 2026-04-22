"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, Check, Plus, Minus, Star, Mail, CheckCircle2, MapPinned } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { LOCALITY_OPTIONS, getAverageRatings } from "@/lib/data";
import type { Locality, Product } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { PRODUCT_CATEGORIES, PRODUCT_TAGS } from "@/lib/categories";
import { PRE_LAUNCH } from "@/lib/pre-launch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@clerk/nextjs";
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
    getAverageRatings().then(setAvgRatings).catch(console.error);
  }, []);

  const categories = ["All", ...PRODUCT_CATEGORIES];

  const localityOptions: ("All" | Locality)[] = ["All", ...LOCALITY_OPTIONS];

  const localityOrder: Record<string, number> = { "Own Produce": 0, "Local": 1, "Regional": 2, "UK": 3, "International": 4 };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || p.category === category;
    const matchesLocality = selectedLocalities.size === 0 || selectedLocalities.has(p.locality);
    const matchesTags = selectedTags.size === 0 || Array.from(selectedTags).every((tag) => p.tags?.includes(tag));
    return matchesSearch && matchesCategory && matchesLocality && matchesTags;
  }).sort((a, b) => (localityOrder[a.locality] ?? 9) - (localityOrder[b.locality] ?? 9));

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Pre-launch overlay */}
      {showPreLaunch && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-start pt-8 bg-white/80 backdrop-blur-sm">
          {/* Coming Soon Badge */}
          <div className="mb-8 rounded-2xl bg-primary px-8 py-4 shadow-xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Coming Soon!</h2>
          </div>

          {/* Email Signup */}
          <div className="w-full max-w-md px-4">
            <div className="rounded-xl bg-surface p-6 shadow-lg">
              <h3 className="text-lg font-bold text-primary text-center">Register Your Interest</h3>
              <p className="mt-1 text-sm text-muted text-center">
                Sign up for discounts and updates on when to order
              </p>

              {!emailSubmitted ? (
                <form onSubmit={handleEmailSubmit} className="mt-4">
                  <div className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      required
                      className="w-full rounded-lg border border-primary/20 bg-white px-4 py-3 text-base outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                    />
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
                    <p className="mt-3 text-sm text-red-600 text-center">{emailError}</p>
                  )}
                </form>
              ) : (
                <div className="mt-4 rounded-xl bg-green-50 border-2 border-green-200 px-4 py-4">
                  <div className="flex items-center justify-center gap-3 text-green-800">
                    <CheckCircle2 size={24} />
                    <div className="text-left">
                      <p className="font-bold">You're on the list!</p>
                      <p className="text-sm text-green-700">We'll send you updates soon.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Check Delivery */}
            <div className="mt-4 rounded-xl bg-surface p-6 shadow-lg text-center">
              <p className="text-sm text-muted mb-3">Want to know if we deliver to your area?</p>
              <Link 
                href="/map" 
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition hover:bg-primary/90"
              >
                <MapPinned size={18} />
                Check if we deliver to you
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className={showPreLaunch ? "pointer-events-none select-none filter grayscale opacity-40" : ""}>
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
          <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Locality:</span>
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
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
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

      </div>

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        avgRatings={avgRatings}
      />
    </div>
  );
}
