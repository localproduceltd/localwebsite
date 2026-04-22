"use client";

import Link from "next/link";
import { getSupplier, getProductsBySupplier, getAverageRatings, getProductRatings } from "@/lib/data";
import { MapPin, ArrowLeft, Check, Plus, Minus, Star, X } from "lucide-react";
import { notFound } from "next/navigation";
import SupplierDistance from "@/components/SupplierDistance";
import { LOCALITY_COLORS } from "@/lib/locality";
import { useCart } from "@/lib/cart-context";
import { useState, useEffect } from "react";
import type { Product } from "@/lib/data";
import { PRODUCT_TAGS, ALLERGENS } from "@/lib/categories";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const { addItem, updateQuantity, items } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productReviews, setProductReviews] = useState<Array<{ stars: number; comment?: string; createdAt: string }>>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (selectedProduct) {
      getProductRatings(selectedProduct.id).then(setProductReviews).catch(console.error);
      setShowAllReviews(false);
    } else {
      setShowAllReviews(false);
    }
  }, [selectedProduct]);

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const sup = await getSupplier(id);
      if (!sup) {
        notFound();
        return;
      }
      setSupplier(sup);
      const prods = await getProductsBySupplier(id);
      setProducts(prods.filter((p) => p.status === "approved"));
      const ratings = await getAverageRatings();
      setAvgRatings(ratings);
      setLoading(false);
    })();
  }, [id]);

  if (loading || !supplier) {
    return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/suppliers" className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:underline">
        <ArrowLeft size={16} /> Back to Suppliers
      </Link>

      {/* Supplier header */}
      <div className="mt-6 overflow-hidden rounded-xl bg-surface shadow-sm">
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
          {/* Supplier Image - smaller and centered/left-aligned */}
          <div className="w-48 flex-shrink-0 overflow-hidden rounded-xl">
            <img src={supplier.image || "/images/Holding Image - Supplier.png"} alt={supplier.name} className="aspect-square w-full object-cover" />
          </div>
          
          {/* Supplier Info */}
          <div className="flex-1 text-center sm:text-left">
            <span className="inline-block rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-primary">
              {supplier.category}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">{supplier.name}</h1>
            <p className="mt-2 text-muted">{supplier.description}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-center gap-1 text-sm text-secondary sm:justify-start">
                <MapPin size={14} />
                <span>{supplier.location}</span>
              </div>
              <SupplierDistance supplierLat={supplier.lat} supplierLng={supplier.lng} />
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <h2 className="mt-10 text-xl font-bold text-primary">
        Products from {supplier.name}
      </h2>

      {products.length === 0 ? (
        <p className="mt-4 text-muted">No products listed yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => {
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

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-surface/80 p-2 text-primary transition hover:bg-surface hover:text-secondary"
            >
              <X size={20} />
            </button>

            {/* Product Image */}
            <div className="flex justify-center bg-surface py-4">
              <div className="relative aspect-square overflow-hidden max-h-64 w-64">
                {selectedProduct.image ? (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-muted">No image</div>
                )}
                {/* Locality badge */}
                <span
                  className="absolute left-2 top-2 rounded-full px-3 py-1 text-xs font-semibold shadow-md"
                  style={{ 
                    background: (LOCALITY_COLORS[selectedProduct.locality] ?? LOCALITY_COLORS["Local"]).bg, 
                    color: (LOCALITY_COLORS[selectedProduct.locality] ?? LOCALITY_COLORS["Local"]).text, 
                    border: `1px solid ${(LOCALITY_COLORS[selectedProduct.locality] ?? LOCALITY_COLORS["Local"]).border}` 
                  }}
                >
                  {selectedProduct.locality}
                </span>
              </div>
            </div>

            {/* Product Details */}
            <div className="p-6">
              <p className="text-sm font-medium text-secondary">{selectedProduct.supplierName}</p>
              <h2 className="mt-1 text-2xl font-bold text-primary">{selectedProduct.name}</h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">{selectedProduct.description}</p>

              {/* Tags */}
              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedProduct.tags.map((tagId) => {
                    const tag = PRODUCT_TAGS.find((t) => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <span key={tagId} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tag.color}`}>
                        {tag.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Allergens */}
              {selectedProduct.allergens && selectedProduct.allergens.length > 0 && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">⚠️ Contains allergens:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.allergens.map((allergenId) => {
                      const allergen = ALLERGENS.find((a) => a.id === allergenId);
                      if (!allergen) return null;
                      return (
                        <span key={allergenId} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {allergen.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-between border-t border-primary/10 pt-4">
                <div>
                  <span className="text-3xl font-bold text-primary">£{selectedProduct.price.toFixed(2)}</span>
                  <span className="ml-2 text-sm text-muted">/ {selectedProduct.unit}</span>
                </div>
                {!selectedProduct.inStock && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
                    Out of Stock
                  </span>
                )}
              </div>

              {/* Add to Cart Button */}
              <div className="mt-6">
                {(() => {
                  const cartItem = items.find(i => i.productId === selectedProduct.id);
                  if (!selectedProduct.inStock) {
                    return (
                      <button disabled className="w-full rounded-lg py-3 text-sm font-semibold text-white bg-primary opacity-50 cursor-not-allowed">
                        Unavailable
                      </button>
                    );
                  }
                  if (cartItem) {
                    return (
                      <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
                        <button
                          onClick={() => updateQuantity(selectedProduct.id, -1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-lg font-semibold text-primary">{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQuantity(selectedProduct.id, 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => {
                        addItem(selectedProduct.id);
                        setJustAdded(selectedProduct.id);
                        setTimeout(() => setJustAdded(null), 1200);
                      }}
                      className={`w-full rounded-lg py-3 text-sm font-semibold text-white transition ${
                        justAdded === selectedProduct.id ? "bg-secondary" : "bg-primary hover:bg-secondary"
                      }`}
                    >
                      {justAdded === selectedProduct.id ? (
                        <span className="inline-flex items-center gap-2"><Check size={16} /> Added to Cart!</span>
                      ) : "Add to Cart"}
                    </button>
                  );
                })()}
              </div>

              {/* Reviews Section */}
              {productReviews.length > 0 && (
                <div className="mt-6 border-t border-primary/10 pt-6">
                  <h3 className="text-lg font-bold text-primary">Reviews ({productReviews.length})</h3>
                  {avgRatings[selectedProduct.id] && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            size={16} 
                            className={avgRatings[selectedProduct.id].avg >= s ? "fill-accent text-accent" : avgRatings[selectedProduct.id].avg >= s - 0.5 ? "fill-accent/50 text-accent" : "text-primary/15"} 
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {avgRatings[selectedProduct.id].avg.toFixed(1)} average
                      </span>
                    </div>
                  )}
                  <div className="mt-4 space-y-3">
                    {(showAllReviews ? productReviews : productReviews.slice(0, 2)).map((review, idx) => (
                      <div key={idx} className="rounded-lg bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star 
                                key={s} 
                                size={12} 
                                className={review.stars >= s ? "fill-accent text-accent" : "text-primary/15"} 
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted">
                            {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="mt-2 text-sm text-primary/80 italic">"{review.comment}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {productReviews.length > 2 && (
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="mt-3 text-sm font-semibold text-secondary hover:underline"
                    >
                      {showAllReviews ? "Show less" : `See all ${productReviews.length} reviews`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
