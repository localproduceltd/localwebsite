"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/data";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, items } = useCart();
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
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-primary-light">{product.supplierName || product.category}</span>
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
          onClick={handleAdd}
          className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            justAdded ? "bg-primary-light" : "bg-primary hover:bg-primary-light"
          }`}
        >
          {!product.inStock ? "Unavailable" : justAdded ? (
            <span className="inline-flex items-center gap-1"><Check size={14} /> Added!</span>
          ) : (
            `Add to Cart${cartItem ? ` (${cartItem.quantity})` : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
