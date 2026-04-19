"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ShoppingCart, CheckCircle, Calendar } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-context";
import { type DeliveryDay, type OrderItem, getActiveDeliveryDays, createOrder, getSupplier } from "@/lib/data";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice, getProduct, clearCart } = useCart();
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDay[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    getActiveDeliveryDays().then(setDeliveryDays).catch(console.error);
  }, []);

  const handlePlaceOrder = async () => {
    if (!isSignedIn || !user) {
      router.push("/sign-in");
      return;
    }
    if (!selectedDay) return;

    setPlacing(true);

    const orderItems: OrderItem[] = items
      .map((item) => {
        const product = getProduct(item.productId);
        if (!product) return null;
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          price: product.price,
          supplierId: product.supplierId,
        };
      })
      .filter(Boolean) as OrderItem[];

    try {
      const customerEmail = user.primaryEmailAddress?.emailAddress ?? "";
      const customerName = user.fullName || user.firstName || "Customer";
      const order = await createOrder(user.id, customerEmail, totalPrice, selectedDay, orderItems);
      clearCart();
      setOrderPlaced(true);

      // Send order confirmation email to customer
      if (customerEmail) {
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "order_confirmation",
            data: {
              customerEmail,
              customerName,
              orderNumber: order.orderNumber,
              deliveryDay: new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
              items: orderItems.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
              })),
              total: totalPrice,
            },
          }),
        }).catch(console.error);
      }

      // Send new order emails to suppliers
      const supplierItems = new Map<string, typeof orderItems>();
      for (const item of orderItems) {
        if (item.supplierId) {
          const existing = supplierItems.get(item.supplierId) || [];
          existing.push(item);
          supplierItems.set(item.supplierId, existing);
        }
      }

      for (const [supplierId, items] of supplierItems) {
        getSupplier(supplierId).then((supplier) => {
          if (supplier?.email) {
            const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
            fetch("/api/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "supplier_new_order",
                data: {
                  supplierEmail: supplier.email,
                  supplierName: supplier.name,
                  orderNumber: order.orderNumber,
                  deliveryDay: new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
                  items: items.map((item) => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                  })),
                  subtotal,
                },
              }),
            }).catch(console.error);
          }
        }).catch(console.error);
      }
    } catch {
      alert("Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <CheckCircle size={48} className="mx-auto text-secondary" />
        <h1 className="mt-4 text-2xl font-bold text-primary">Order Placed!</h1>
        <p className="mt-2 text-muted">
          Your order has been placed for <span className="font-semibold text-primary">{new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span> delivery.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/account"
            className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-background transition hover:bg-secondary"
          >
            View My Orders
          </Link>
          <Link
            href="/products"
            className="inline-block rounded-lg border-2 border-primary/20 px-6 py-3 font-semibold text-primary transition hover:bg-secondary/10"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <ShoppingCart size={48} className="mx-auto text-muted" />
        <h1 className="mt-4 text-2xl font-bold text-primary">Your cart is empty</h1>
        <p className="mt-2 text-muted">Browse our products and add items to get started.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-background transition hover:bg-secondary"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Shopping Cart</h1>
      <p className="mt-1 text-secondary">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>

      <div className="mt-8 space-y-6">
        {(() => {
          const grouped = new Map<string, typeof items>();
          for (const item of items) {
            const product = getProduct(item.productId);
            const supplier = product?.supplierName ?? "Other";
            if (!grouped.has(supplier)) grouped.set(supplier, []);
            grouped.get(supplier)!.push(item);
          }
          return Array.from(grouped.entries()).map(([supplier, supplierItems]) => (
            <div key={supplier}>
              <h3 className="mb-3 text-sm font-bold text-secondary uppercase tracking-wide">{supplier}</h3>
              <div className="space-y-3">
                {supplierItems.map((item) => {
                  const product = getProduct(item.productId);
                  if (!product) return null;
                  return (
                    <div
                      key={item.productId}
                      className="rounded-xl bg-surface p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-secondary/10 sm:h-20 sm:w-20">
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-primary">{product.name}</h3>
                          <p className="text-sm text-muted">£{product.price.toFixed(2)} / {product.unit}</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-primary/5 pt-3">
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
                        <p className="font-bold text-primary">
                          £{(product.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Delivery Day Picker */}
      <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Choose Delivery Date</h2>
        </div>
        {deliveryDays.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No delivery dates available at the moment.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {deliveryDays.map((day) => {
              const d = new Date(day.deliveryDate + "T00:00:00");
              const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
              const cutoffD = new Date(day.cutoffDate + "T00:00:00");
              const cutoffLabel = cutoffD.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day.deliveryDate)}
                  className={`rounded-lg border-2 px-5 py-3 text-sm font-semibold transition ${
                    selectedDay === day.deliveryDate
                      ? "border-primary bg-primary text-background"
                      : "border-primary/20 bg-surface text-primary hover:border-secondary"
                  }`}
                >
                  <span className="block">{label}</span>
                  <span className="block text-xs font-normal opacity-70">
                    Order by {cutoffLabel}, {day.cutoffTime}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-primary/5 pb-4">
          <span className="text-muted">Subtotal</span>
          <span className="font-semibold text-primary">£{totalPrice.toFixed(2)}</span>
        </div>
        {selectedDay && (
          <div className="flex items-center justify-between border-b border-primary/5 py-4">
            <span className="text-muted">Delivery</span>
            <span className="font-semibold text-primary">{selectedDay}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-4">
          <span className="text-lg font-bold text-primary">Total</span>
          <span className="text-lg font-bold text-primary">£{totalPrice.toFixed(2)}</span>
        </div>
        <button
          disabled={!selectedDay || placing}
          onClick={handlePlaceOrder}
          className="mt-6 w-full rounded-lg bg-accent py-3 text-center font-semibold text-primary transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? "Placing Order..." : !isSignedIn ? "Sign In to Place Order" : !selectedDay ? "Select a Delivery Day" : "Place Order"}
        </button>
        {!isSignedIn && (
          <p className="mt-2 text-center text-xs text-muted">
            You&apos;ll need to <Link href="/sign-in" className="text-secondary hover:underline">sign in</Link> to complete your order
          </p>
        )}
      </div>
    </div>
  );
}
