"use client";

import Link from "next/link";
import { getSupplier, getProductsBySupplier, getAverageRatings } from "@/lib/data";
import { MapPin, ArrowLeft, Check, Plus, Minus, Star } from "lucide-react";
import { notFound } from "next/navigation";
import SupplierDistance from "@/components/SupplierDistance";
import { LOCALITY_COLORS } from "@/lib/locality";
import { useCart } from "@/lib/cart-context";
import { useState, useEffect } from "react";
import type { Product } from "@/lib/data";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const { addItem, updateQuantity, items } = useCart();

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
                <div className="relative aspect-square overflow-hidden bg-secondary/10">
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
                  <h3 className="mt-1 text-sm font-semibold text-primary sm:text-base">
                    {product.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted line-clamp-2 sm:text-sm">
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
    </div>
  );
}
