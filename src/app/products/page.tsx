"use client";

import { useState, useEffect } from "react";
import FadeInImage from "@/components/FadeInImage";
import Link from "next/link";
import { Search, Check, Plus, Minus, Star, HelpCircle, X, Heart, ChevronDown } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-context";
import { LOCALITY_OPTIONS, getUserOrderedProductIds } from "@/lib/data";
import type { Locality, Product } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { PRODUCT_CATEGORIES, PRODUCT_TAGS } from "@/lib/categories";
import { sortShopProducts } from "@/lib/shop-sort";
import ProductDetailModal from "@/components/ProductDetailModal";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedLocalities, setSelectedLocalities] = useState<Set<Locality>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const { addItem, updateQuantity, items, products, remainingStock } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showLocalityInfo, setShowLocalityInfo] = useState(false);
  const [showDietaryDropdown, setShowDietaryDropdown] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [favouriteProductIds, setFavouriteProductIds] = useState<Set<string>>(new Set());
  const { user, isLoaded } = useUser();

  // Fetch user's ordered products for favourites
  useEffect(() => {
    if (isLoaded && user) {
      getUserOrderedProductIds(user.id).then(setFavouriteProductIds).catch(console.error);
    }
  }, [isLoaded, user]);

  const categories = ["All", ...PRODUCT_CATEGORIES];

  const localityOptions: ("All" | Locality)[] = ["All", ...LOCALITY_OPTIONS];

  // Locality priority: Own Produce/Local/Regional = 0, UK = 1, International/Mixed = 2
  const localityPriority: Record<string, number> = { "Own Produce": 0, "Local": 0, "Regional": 0, "UK": 1, "International": 2, "Mixed": 2 };

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
    
    // First filter products. Out-of-stock items are hidden from the shop
    // entirely (Aug 2026) rather than shown greyed out - suppliers use the
    // stock toggle to park items they haven't finished pricing, so a listing
    // customers can't buy is just noise. Note this is the supplier's own
    // in_stock toggle; something that has only sold out its weekly cap still
    // shows, with its "sold out this week" badge.
    const matchingProducts = products.filter((p) => {
      const matchesSearch = !searchTerm || getSearchScore(p, searchTerm) > 0;
      const matchesCategory = category === "All" || p.category === category;
      const matchesLocality = selectedLocalities.size === 0 || selectedLocalities.has(p.locality);
      const matchesTags = selectedTags.size === 0 || Array.from(selectedTags).every((tag) => p.tags?.includes(tag));
      const matchesFavourites = !showFavourites || favouriteProductIds.has(p.id);
      return p.inStock && matchesSearch && matchesCategory && matchesLocality && matchesTags && matchesFavourites;
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

    // No search: recent activity (last 14 days) + featured products on top,
    // round-robined across suppliers; everything else category-interleaved.
    return sortShopProducts(matchingProducts);
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Sticky Search Bar - top-[72px] to sit below navbar (h-18 = 72px) */}
      <div className="sticky top-[72px] z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-background pt-4 pb-3 shadow-sm">
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
      </div>

      {/* Filters (not sticky) */}
      <div className="flex flex-col gap-3 mt-2">
        {/* Row 1: Category + Favourites */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="category-select" className="text-sm font-semibold text-muted">
              Category:
            </label>
            <select
              id="category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-1.5 text-sm font-medium text-primary outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          
          {/* Favourites Button */}
          {isLoaded && user ? (
            <button
              onClick={() => setShowFavourites(!showFavourites)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                showFavourites
                  ? "bg-accent text-white"
                  : "bg-accent/10 text-accent hover:bg-accent/20"
              }`}
            >
              <Heart size={14} className={showFavourites ? "fill-white" : ""} />
              My Favourites
              {showFavourites && favouriteProductIds.size > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-xs">{favouriteProductIds.size}</span>
              )}
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 transition"
            >
              <Heart size={14} />
              <span className="hidden sm:inline">Log in for favourites</span>
              <span className="sm:hidden">Log in</span>
            </Link>
          )}
        </div>

        {/* Row 2: Locality Filter */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowLocalityInfo(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wide mr-0.5 hover:text-secondary transition cursor-pointer"
          >
            Locality:
            <HelpCircle size={12} className="text-secondary" />
          </button>
          <button
            onClick={() => setSelectedLocalities(new Set())}
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold transition"
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
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold transition"
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

        {/* Row 3: Dietary Filter - Dropdown on mobile, inline on desktop */}
        <div className="relative">
          {/* Mobile: Dropdown trigger */}
          <button
            onClick={() => setShowDietaryDropdown(!showDietaryDropdown)}
            className="sm:hidden inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-surface px-3 py-1.5 text-sm font-medium text-primary"
          >
            Dietary
            {selectedTags.size > 0 && (
              <span className="rounded-full bg-secondary px-1.5 text-xs text-white">{selectedTags.size}</span>
            )}
            <ChevronDown size={14} className={`transition ${showDietaryDropdown ? "rotate-180" : ""}`} />
          </button>
          
          {/* Mobile: Dropdown content */}
          {showDietaryDropdown && (
            <div className="sm:hidden absolute left-0 top-full mt-1 z-20 rounded-lg border border-primary/10 bg-surface p-2 shadow-lg">
              <div className="flex flex-wrap gap-1.5 max-w-[280px]">
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
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        isActive ? tag.color : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Desktop: Inline tags */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
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
      </div>

      {products.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-muted">Loading products...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 text-center">
          {showFavourites && favouriteProductIds.size === 0 ? (
            <>
              <Heart size={48} className="mx-auto text-accent/30 mb-4" />
              <p className="text-lg font-medium text-primary">No favourites yet</p>
              <p className="mt-1 text-sm text-muted">Products you order will appear here for easy reordering</p>
              <button
                onClick={() => setShowFavourites(false)}
                className="mt-4 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90 transition"
              >
                Browse all products
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-primary">No products found</p>
              <p className="mt-1 text-sm text-muted">Try adjusting your search or filters</p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => {
            const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
            // Weekly stock: 0 left = sold out until next delivery day (distinct
            // from the supplier's manual Out of Stock toggle)
            const remaining = remainingStock(product.id);
            const soldOutWeekly = product.inStock && remaining === 0;
            const unavailable = !product.inStock || soldOutWeekly;
            const lowStock = product.inStock && remaining != null && remaining > 0 && remaining <= 5;
            return (
              <div
                key={product.id}
                className={`group flex flex-col overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md ${
                  unavailable ? "opacity-60 grayscale" : ""
                }`}
              >
                <div 
                  className="relative aspect-square overflow-hidden bg-secondary/10 cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.image ? (
                    <FadeInImage
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover group-hover:scale-105"
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
                    {(product.ratingCount ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 backdrop-blur-[2px] ml-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={9} className={(product.avgRating ?? 0) >= s ? "fill-accent text-accent" : (product.avgRating ?? 0) >= s - 0.5 ? "fill-accent/50 text-accent" : "text-white/40"} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                          ))}
                        </div>
                        <span className="text-[9px] font-semibold text-white ml-0.5">({product.ratingCount})</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-secondary">{product.supplierName}</p>
                    {unavailable ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        {soldOutWeekly ? "Sold Out This Week" : "Out of Stock"}
                      </span>
                    ) : lowStock ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Only {remaining} left
                      </span>
                    ) : null}
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
                    if (unavailable) {
                      return (
                        <div className="mt-2 flex w-full items-center justify-center rounded-lg border-2 border-muted/30 bg-muted/10 py-1.5 text-xs font-semibold text-muted sm:mt-3 sm:py-2 sm:text-sm">
                          {soldOutWeekly ? "Sold Out This Week" : "Out of Stock"}
                        </div>
                      );
                    }
                    if (cartItem && justAdded !== product.id) {
                      const atLimit = remaining != null && cartItem.quantity >= remaining;
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
                            disabled={atLimit}
                            title={atLimit ? `Only ${remaining} available${product.supplierStockMode === "overall" ? "" : " this week"}` : undefined}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40 disabled:opacity-40 disabled:cursor-not-allowed"
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
