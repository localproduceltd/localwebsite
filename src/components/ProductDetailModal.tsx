"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Minus, Star, X } from "lucide-react";
import type { Product } from "@/lib/data";
import { getProductRatings } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { PRODUCT_TAGS, ALLERGENS } from "@/lib/categories";
import { useCart } from "@/lib/cart-context";

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  avgRatings?: Record<string, { avg: number; count: number }>;
}

export default function ProductDetailModal({ product, onClose, avgRatings = {} }: ProductDetailModalProps) {
  const { addItem, updateQuantity, items } = useCart();
  const [productReviews, setProductReviews] = useState<Array<{ stars: number; comment?: string; createdAt: string }>>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (product) {
      getProductRatings(product.id).then(setProductReviews).catch(console.error);
      setShowAllReviews(false);
      setJustAdded(false);
    }
  }, [product]);

  if (!product) return null;

  const cartItem = items.find((i) => i.productId === product.id);
  const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
  const avgRating = avgRatings[product.id];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-surface/80 p-2 text-primary transition hover:bg-surface hover:text-secondary"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Product Image */}
        <div className="flex justify-center bg-surface py-4">
          <div className="relative aspect-square overflow-hidden max-h-64 w-64">
            {product.image ? (
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-muted">No image</div>
            )}
            <span
              className="absolute left-2 top-2 rounded-full px-3 py-1 text-xs font-semibold shadow-md"
              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
            >
              {product.locality}
            </span>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-6">
          <p className="text-sm font-medium text-secondary">{product.supplierName}</p>
          <h2 className="mt-1 text-2xl font-bold text-primary">{product.name}</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">{product.description}</p>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tagId) => {
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
          {product.allergens && product.allergens.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1.5">⚠️ Contains allergens:</p>
              <div className="flex flex-wrap gap-1.5">
                {product.allergens.map((allergenId) => {
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
              <span className="text-3xl font-bold text-primary">£{product.price.toFixed(2)}</span>
              <span className="ml-2 text-sm text-muted">/ {product.unit}</span>
            </div>
            {!product.inStock && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">Out of Stock</span>
            )}
          </div>

          {/* Add to Cart */}
          <div className="mt-6">
            {!product.inStock ? (
              <button disabled className="w-full rounded-lg py-3 text-sm font-semibold text-white bg-primary opacity-50 cursor-not-allowed">
                Unavailable
              </button>
            ) : cartItem ? (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
                <button
                  onClick={() => updateQuantity(product.id, -1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                >
                  <Minus size={16} />
                </button>
                <span className="text-lg font-semibold text-primary">{cartItem.quantity}</span>
                <button
                  onClick={() => updateQuantity(product.id, 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                >
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  addItem(product.id);
                  setJustAdded(true);
                  setTimeout(() => setJustAdded(false), 1200);
                }}
                className={`w-full rounded-lg py-3 text-sm font-semibold text-white transition ${
                  justAdded ? "bg-secondary" : "bg-primary hover:bg-secondary"
                }`}
              >
                {justAdded ? (
                  <span className="inline-flex items-center gap-2"><Check size={16} /> Added to Cart!</span>
                ) : "Add to Cart"}
              </button>
            )}
          </div>

          {/* Reviews */}
          {productReviews.length > 0 && (
            <div className="mt-6 border-t border-primary/10 pt-6">
              <h3 className="text-lg font-bold text-primary">Reviews ({productReviews.length})</h3>
              {avgRating && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        className={
                          avgRating.avg >= s
                            ? "fill-accent text-accent"
                            : avgRating.avg >= s - 0.5
                            ? "fill-accent/50 text-accent"
                            : "text-primary/15"
                        }
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-primary">{avgRating.avg.toFixed(1)} average</span>
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
                    {review.comment && <p className="mt-2 text-sm text-primary/80 italic">"{review.comment}"</p>}
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
  );
}
