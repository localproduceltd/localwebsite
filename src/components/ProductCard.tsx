"use client";

import { useState } from "react";
import { Check, Plus, Minus } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { PRODUCT_TAGS } from "@/lib/categories";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, items, updateQuantity } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const cartItem = items.find((i) => i.productId === product.id);

  const handleAdd = () => {
    addItem(product.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md">
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
          <span className="text-xs font-medium text-secondary">{product.supplierName || product.category}</span>
          {!product.inStock && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              Out of Stock
            </span>
          )}
        </div>
        <h3 className="mt-1 font-semibold text-primary">{product.name}</h3>
        <p className="mt-0.5 text-sm text-muted">{product.description}</p>
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
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">£{product.price.toFixed(2)}</span>
          <span className="text-xs text-muted">{product.unit}</span>
        </div>
        {!product.inStock ? (
          <div className="mt-3 flex w-full items-center justify-center rounded-lg border-2 border-muted/30 bg-muted/10 py-2 text-sm font-semibold text-muted">
            Out of Stock
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
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
