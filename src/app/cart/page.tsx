"use client";

import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice, getProduct } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <ShoppingCart size={48} className="mx-auto text-muted" />
        <h1 className="mt-4 text-2xl font-bold text-primary">Your cart is empty</h1>
        <p className="mt-2 text-muted">Browse our products and add items to get started.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-light"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Shopping Cart</h1>
      <p className="mt-1 text-muted">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>

      <div className="mt-8 space-y-4">
        {items.map((item) => {
          const product = getProduct(item.productId);
          if (!product) return null;
          return (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-xl bg-surface p-4 shadow-sm"
            >
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary/10">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary-light">{product.supplierName}</p>
                <h3 className="font-semibold text-primary">{product.name}</h3>
                <p className="text-sm text-muted">&euro;{product.price.toFixed(2)} / {product.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.productId, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-semibold text-primary">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-primary transition hover:bg-secondary/40"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="w-20 text-right font-bold text-primary">
                &euro;{(product.price * item.quantity).toFixed(2)}
              </p>
              <button
                onClick={() => removeItem(item.productId)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-primary/5 pb-4">
          <span className="text-muted">Subtotal</span>
          <span className="font-semibold text-primary">&euro;{totalPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between pt-4">
          <span className="text-lg font-bold text-primary">Total</span>
          <span className="text-lg font-bold text-primary">&euro;{totalPrice.toFixed(2)}</span>
        </div>
        <button className="mt-6 w-full rounded-lg bg-accent py-3 text-center font-semibold text-primary transition hover:bg-accent/90">
          Place Order
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          You&apos;ll need to be signed in to complete your order
        </p>
      </div>
    </div>
  );
}
