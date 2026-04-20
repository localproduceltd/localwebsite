"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ShoppingCart, CheckCircle, Calendar, Clock, Home, Package, MapPin } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-context";
import { type DeliveryDay, type DeliveryWindow, type OrderItem, getActiveDeliveryDays, createOrder, getSupplier, getCustomerProfile, setCustomerOutstandingBox } from "@/lib/data";

const BOX_DEPOSIT = 10;

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice, getProduct, clearCart } = useCart();
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDay[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Delivery options state
  const [deliveryWindow, setDeliveryWindow] = useState<DeliveryWindow | null>(null);
  const [willBeIn, setWillBeIn] = useState<boolean | null>(null);
  const [safePlace, setSafePlace] = useState("");
  const [hasOutstandingBox, setHasOutstandingBox] = useState(false);

  useEffect(() => {
    getActiveDeliveryDays().then(setDeliveryDays).catch(console.error);
  }, []);

  useEffect(() => {
    if (user) {
      getCustomerProfile(user.id).then((profile) => {
        if (profile) {
          setHasOutstandingBox(profile.hasOutstandingBox);
        }
      }).catch(console.error);
    }
  }, [user]);

  // Calculate if box deposit is needed
  const needsBoxDeposit = willBeIn === false && !hasOutstandingBox;
  const boxDeposit = needsBoxDeposit ? BOX_DEPOSIT : 0;
  const finalTotal = totalPrice + boxDeposit;

  const handlePlaceOrder = async () => {
    if (!isSignedIn || !user) {
      router.push("/sign-in");
      return;
    }
    if (!selectedDay || !deliveryWindow || willBeIn === null) return;
    if (willBeIn === false && !safePlace.trim()) return;

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
      const order = await createOrder({
        userId: user.id,
        customerEmail,
        total: finalTotal,
        deliveryDay: selectedDay,
        items: orderItems,
        deliveryWindow,
        willBeIn,
        safePlace: willBeIn ? undefined : safePlace,
        boxDepositPaid: needsBoxDeposit,
      });

      // If box deposit was paid, update customer profile
      if (needsBoxDeposit) {
        await setCustomerOutstandingBox(user.id, true);
      }
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
              total: finalTotal,
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

      {/* Delivery Window */}
      <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Delivery Window</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Choose your preferred delivery time</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => setDeliveryWindow("morning")}
            className={`flex-1 min-w-[140px] rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
              deliveryWindow === "morning"
                ? "border-primary bg-primary text-background"
                : "border-primary/20 bg-surface text-primary hover:border-secondary"
            }`}
          >
            <span className="block">Morning</span>
            <span className="block text-xs font-normal opacity-70">9am – 1pm</span>
          </button>
          <button
            onClick={() => setDeliveryWindow("afternoon")}
            className={`flex-1 min-w-[140px] rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
              deliveryWindow === "afternoon"
                ? "border-primary bg-primary text-background"
                : "border-primary/20 bg-surface text-primary hover:border-secondary"
            }`}
          >
            <span className="block">Afternoon</span>
            <span className="block text-xs font-normal opacity-70">1pm – 5pm</span>
          </button>
        </div>
      </div>

      {/* Attendance Choice */}
      <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Home size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Will you be in?</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Let us know if you&apos;ll be available to receive your order</p>
        <div className="mt-4 space-y-3">
          <button
            onClick={() => setWillBeIn(true)}
            className={`w-full rounded-lg border-2 px-4 py-4 text-left transition ${
              willBeIn === true
                ? "border-primary bg-primary/5"
                : "border-primary/20 bg-surface hover:border-secondary"
            }`}
          >
            <span className="block font-semibold text-primary">Yes, I&apos;ll be in</span>
            <span className="block text-sm text-muted mt-1">I&apos;ll be available during my selected delivery window</span>
          </button>
          <button
            onClick={() => setWillBeIn(false)}
            className={`w-full rounded-lg border-2 px-4 py-4 text-left transition ${
              willBeIn === false
                ? "border-primary bg-primary/5"
                : "border-primary/20 bg-surface hover:border-secondary"
            }`}
          >
            <span className="block font-semibold text-primary">No, I won&apos;t be in</span>
            <span className="block text-sm text-muted mt-1">Please leave my order in my chosen safe place</span>
          </button>
        </div>
      </div>

      {/* Safe Place (only if not in) */}
      {willBeIn === false && (
        <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Safe Place</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Where should we leave your order? Please give clear instructions.</p>
          <textarea
            value={safePlace}
            onChange={(e) => setSafePlace(e.target.value)}
            placeholder="e.g. Behind side gate, In porch, By back door, In garage..."
            className="mt-4 w-full rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm outline-none focus:border-secondary"
            rows={3}
          />

          {/* Box Deposit Info */}
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <Package size={20} className="text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Reusable Box Deposit</p>
                {hasOutstandingBox ? (
                  <p className="text-sm text-amber-700 mt-1">
                    You already have a box from a previous order. We&apos;ll swap it on delivery – no extra deposit needed.
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 mt-1">
                    A refundable £{BOX_DEPOSIT} deposit will be added for the delivery crate and cool bag. 
                    On your next delivery, we&apos;ll collect the box and either refund your deposit or swap it for your new order.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-primary/5 pb-4">
          <span className="text-muted">Subtotal</span>
          <span className="font-semibold text-primary">£{totalPrice.toFixed(2)}</span>
        </div>
        {needsBoxDeposit && (
          <div className="flex items-center justify-between border-b border-primary/5 py-4">
            <span className="text-muted">Box Deposit (refundable)</span>
            <span className="font-semibold text-primary">£{BOX_DEPOSIT.toFixed(2)}</span>
          </div>
        )}
        {selectedDay && (
          <div className="flex items-center justify-between border-b border-primary/5 py-4">
            <span className="text-muted">Delivery</span>
            <span className="font-semibold text-primary">
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              {deliveryWindow && ` (${deliveryWindow === "morning" ? "9am–1pm" : "1pm–5pm"})`}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between pt-4">
          <span className="text-lg font-bold text-primary">Total</span>
          <span className="text-lg font-bold text-primary">£{finalTotal.toFixed(2)}</span>
        </div>
        <button
          disabled={!selectedDay || !deliveryWindow || willBeIn === null || (willBeIn === false && !safePlace.trim()) || placing}
          onClick={handlePlaceOrder}
          className="mt-6 w-full rounded-lg bg-accent py-3 text-center font-semibold text-primary transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? "Placing Order..." : !isSignedIn ? "Sign In to Place Order" : !selectedDay ? "Select a Delivery Day" : !deliveryWindow ? "Select Delivery Window" : willBeIn === null ? "Select Attendance" : (willBeIn === false && !safePlace.trim()) ? "Enter Safe Place" : "Place Order"}
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
