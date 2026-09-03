"use client";

import { useState } from "react";
import FadeInImage from "./FadeInImage";
import { Check, Plus, Minus } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { PRODUCT_TAGS } from "@/lib/categories";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, items, updateQuantity, remainingStock } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const cartItem = items.find((i) => i.productId === product.id);
  // Tracked stock: 0 left = sold out (weekly: until the next delivery day;
  // overall: until the supplier restocks). Distinct from the supplier's manual
  // Out of Stock toggle.
  const remaining = remainingStock(product.id);
  const soldOutWeekly = product.inStock && remaining === 0;
  const unavailable = !product.inStock || soldOutWeekly;
  const lowStock = product.inStock && remaining != null && remaining > 0 && remaining <= 5;
  const atLimit = remaining != null && (cartItem?.quantity ?? 0) >= remaining;

  const handleAdd = () => {
    addItem(product.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/10">
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
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-primary line-clamp-1">{product.name}</h3>
        <p className="mt-0.5 text-sm text-muted line-clamp-2">{product.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {product.locality && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: (LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"]).bg,
                color: (LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"]).text,
                border: `1px solid ${(LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"]).border}`,
              }}
            >
              {product.locality}
            </span>
          )}
          {product.tags?.map((tagId) => {
            const tag = PRODUCT_TAGS.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <span key={tagId} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.color}`}>
                {tag.label}
              </span>
            );
          })}
        </div>
        {/* Spacer to push price and button to bottom */}
        <div className="flex-1" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">£{product.price.toFixed(2)}</span>
          <span className="text-xs text-muted">{product.unit}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-secondary">{product.supplierName || product.category}</span>
          {unavailable ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              {soldOutWeekly ? (product.supplierStockMode === "overall" ? "Sold Out" : "Sold Out This Week") : "Out of Stock"}
            </span>
          ) : lowStock ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Only {remaining} left
            </span>
          ) : null}
        </div>
        {unavailable ? (
          <div className="mt-3 flex w-full items-center justify-center rounded-lg border-2 border-muted/30 bg-muted/10 py-2 text-sm font-semibold text-muted">
            {soldOutWeekly ? (product.supplierStockMode === "overall" ? "Sold Out" : "Sold Out This Week") : "Out of Stock"}
          </div>
        ) : cartItem && !justAdded ? (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5">
            <button
              onClick={() => updateQuantity(product.id, -1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-semibold text-primary">{cartItem.quantity}</span>
            <button
              onClick={() => updateQuantity(product.id, 1)}
              disabled={atLimit}
              title={atLimit ? `Only ${remaining} available${product.supplierStockMode === "overall" ? "" : " this week"}` : undefined}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold text-background transition ${
              justAdded ? "bg-secondary" : "bg-primary hover:bg-secondary"
            }`}
          >
            {justAdded ? (
              <span className="inline-flex items-center gap-1"><Check size={14} /> Added!</span>
            ) : "Add to Cart"}
          </button>
        )}
      </div>
    </div>
  );
}
