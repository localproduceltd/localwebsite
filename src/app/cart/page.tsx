"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ShoppingCart, CheckCircle, Calendar, Clock, Home, Package, MapPin, HelpCircle, X, Loader2, MessageCircle, Lock, Unlock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-context";
import { type DeliveryDay, type DeliveryWindow, type DeliveryZone, getActiveDeliveryDays, getCustomerProfile, getLiveDeliveryZones, getDeliveryZones, submitExpansionRequest } from "@/lib/data";
import { lookupPostcode, isWithinDeliveryZones } from "@/lib/postcode";
import { BOX_DEPOSIT, BOTTLE_DEPOSIT, MINIMUM_ORDER, DELIVERY_FEE } from "@/lib/constants";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice, getProduct, clearCart, topUpOrder, clearTopUpOrder } = useCart();
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
  const [showBoxInfo, setShowBoxInfo] = useState(false);

  // Bottle deposit state
  const [hasOwnBottles, setHasOwnBottles] = useState<boolean | null>(null);
  const [bottleDepositQty, setBottleDepositQty] = useState(1);
  const [showBottleInfo, setShowBottleInfo] = useState(false);

  // Delivery address state
  const [addressForm, setAddressForm] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
  });
  const [checkingPostcode, setCheckingPostcode] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [allZones, setAllZones] = useState<DeliveryZone[]>([]);
  const [deliveryCheck, setDeliveryCheck] = useState<{ checked: boolean; inZone: boolean; zoneName?: string; isLaunching?: boolean; launchDate?: string | null } | null>(null);
  const [expansionEmail, setExpansionEmail] = useState("");
  const [submittingExpansion, setSubmittingExpansion] = useState(false);
  const [expansionSubmitted, setExpansionSubmitted] = useState(false);

  // Trial access state
  const [trialCode, setTrialCode] = useState("");
  const [trialUnlocked, setTrialUnlocked] = useState(false);
  const [trialError, setTrialError] = useState("");

  const handleTrialUnlock = () => {
    const validCode = process.env.NEXT_PUBLIC_TRIAL_CODE;
    if (trialCode.trim().toUpperCase() === validCode?.toUpperCase()) {
      setTrialUnlocked(true);
      setTrialError("");
      // Store in sessionStorage so it persists during the session
      sessionStorage.setItem("trialUnlocked", "true");
    } else {
      setTrialError("Invalid code. Please check and try again.");
    }
  };

  // Check if already unlocked in this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const unlocked = sessionStorage.getItem("trialUnlocked");
      if (unlocked === "true") {
        setTrialUnlocked(true);
      }
    }
  }, []);

  useEffect(() => {
    getActiveDeliveryDays().then(setDeliveryDays).catch(console.error);
    getLiveDeliveryZones().then(setDeliveryZones).catch(console.error);
    getDeliveryZones().then(setAllZones).catch(console.error);
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

  const handleCheckPostcode = async () => {
    if (!addressForm.postcode.trim()) return;
    setCheckingPostcode(true);
    setPostcodeError("");
    setDeliveryCheck(null);

    const result = await lookupPostcode(addressForm.postcode);
    if (!result) {
      setPostcodeError("Postcode not found. Please check and try again.");
      setCheckingPostcode(false);
      return;
    }

    // Update postcode to formatted version
    setAddressForm(prev => ({ ...prev, postcode: result.postcode }));

    // Check live zones first
    const liveResult = isWithinDeliveryZones(result.lat, result.lng, deliveryZones);
    if (liveResult.inZone) {
      setDeliveryCheck({ checked: true, inZone: true, zoneName: liveResult.zoneName });
    } else {
      // Check if in a "not live" zone (coming soon)
      const notLiveZones = allZones.filter(z => z.zoneStatus === "not_live");
      const comingSoonResult = isWithinDeliveryZones(result.lat, result.lng, notLiveZones);
      if (comingSoonResult.inZone) {
        const zone = notLiveZones.find(z => z.name === comingSoonResult.zoneName);
        setDeliveryCheck({ checked: true, inZone: false, zoneName: comingSoonResult.zoneName, isLaunching: true, launchDate: zone?.launchDate });
      } else {
        setDeliveryCheck({ checked: true, inZone: false });
      }
    }
    setCheckingPostcode(false);
  };

  const handleExpansionRequest = async () => {
    if (!addressForm.postcode) return;
    setSubmittingExpansion(true);
    try {
      const email = expansionEmail.trim() || (user?.primaryEmailAddress?.emailAddress ?? undefined);
      await submitExpansionRequest(addressForm.postcode, email);
      setExpansionSubmitted(true);
    } catch (error) {
      console.error("Failed to submit expansion request:", error);
    }
    setSubmittingExpansion(false);
  };

  // Check if cart contains glass bottles (Alkmonton Dairy)
  const hasGlassBottles = items.some((item) => {
    const product = getProduct(item.productId);
    return product?.name.toLowerCase().includes("glass bottle");
  });

  // Calculate if box deposit is needed
  const needsBoxDeposit = willBeIn === false && !hasOutstandingBox;
  const boxDeposit = needsBoxDeposit && !topUpOrder ? BOX_DEPOSIT : 0;
  const bottleDeposit = hasGlassBottles && hasOwnBottles === false ? BOTTLE_DEPOSIT * bottleDepositQty : 0;
  const deliveryFee = topUpOrder ? 0 : DELIVERY_FEE;
  const finalTotal = totalPrice + boxDeposit + bottleDeposit + deliveryFee;
  
  // Check minimum order (not required for top-up orders)
  const belowMinimum = !topUpOrder && totalPrice < MINIMUM_ORDER;
  const amountToMinimum = MINIMUM_ORDER - totalPrice;

  const handlePlaceOrder = async () => {
    if (!isSignedIn || !user) {
      router.push("/sign-in");
      return;
    }
    
    // For top-up orders, we don't need delivery day/window/etc
    if (!topUpOrder) {
      if (!selectedDay || !deliveryWindow || willBeIn === null) return;
      if (willBeIn === false && !safePlace.trim()) return;
      if (hasGlassBottles && hasOwnBottles === null) return;
    }

    setPlacing(true);

    const orderItems = items
      .map((item) => {
        const product = getProduct(item.productId);
        if (!product) return null;
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          price: product.price,
          unit: product.unit,
          supplierName: product.supplierName,
          supplierId: product.supplierId,
        };
      })
      .filter(Boolean) as Array<{
        productId: string;
        productName: string;
        quantity: number;
        price: number;
        unit: string;
        supplierName: string;
        supplierId: string;
      }>;

    try {
      const customerEmail = user.primaryEmailAddress?.emailAddress ?? "";
      
      if (topUpOrder) {
        // Top-up checkout - different endpoint
        const response = await fetch("/api/checkout/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: topUpOrder.orderId,
            items: orderItems,
            customerEmail,
            total: finalTotal,
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        if (data.url) {
          sessionStorage.setItem("pendingCheckout", "true");
          sessionStorage.setItem("topUpOrderId", topUpOrder.orderId);
          window.location.href = data.url;
        } else {
          throw new Error(data.error || "No checkout URL returned");
        }
      } else {
        // Regular checkout
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: orderItems,
            deliveryDay: selectedDay,
            deliveryWindow,
            willBeIn,
            safePlace: willBeIn ? undefined : safePlace,
            customerEmail,
            boxDepositPaid: needsBoxDeposit,
            bottleDepositPaid: hasGlassBottles && hasOwnBottles === false,
            bottleDepositQty: hasGlassBottles && hasOwnBottles === false ? bottleDepositQty : 0,
            total: finalTotal,
            address: addressForm,
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        if (data.url) {
          sessionStorage.setItem("pendingCheckout", "true");
          window.location.href = data.url;
        } else {
          throw new Error(data.error || "No checkout URL returned");
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert(`Checkout failed: ${error instanceof Error ? error.message : "Please try again."}`);
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
      <h1 className="text-3xl font-bold text-primary">
        {topUpOrder ? `Add to Order #${topUpOrder.orderNumber}` : "Shopping Cart"}
      </h1>
      <p className="mt-1 text-secondary">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>

      {/* Top-up mode banner */}
      {topUpOrder && (
        <div className="mt-4 rounded-xl bg-secondary/20 border border-secondary/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-primary">Adding items to Order #{topUpOrder.orderNumber}</p>
              <p className="text-sm text-muted mt-1">
                Delivery: {new Date(topUpOrder.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="text-sm text-secondary mt-1">No delivery fee for top-up orders</p>
            </div>
            <button
              onClick={clearTopUpOrder}
              className="text-xs text-muted hover:text-primary transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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

      {/* Trial Access Lock - hide in top-up mode */}
      {!topUpOrder && !trialUnlocked && (
        <div className="mt-8 rounded-xl bg-primary/5 border-2 border-primary/20 p-6">
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-primary">Trial Access</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            We&apos;re currently in a limited trial. Enter your access code to continue to checkout.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Enter trial code"
              value={trialCode}
              onChange={(e) => {
                setTrialCode(e.target.value.toUpperCase());
                setTrialError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTrialUnlock()}
              className="flex-1 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm font-mono uppercase outline-none transition focus:border-secondary"
            />
            <button
              onClick={handleTrialUnlock}
              disabled={!trialCode.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Unlock size={16} />
              Unlock
            </button>
          </div>
          {trialError && (
            <p className="mt-2 text-sm text-red-600">{trialError}</p>
          )}
          <p className="mt-3 text-xs text-muted">
            Don&apos;t have a code? We&apos;ll be opening to everyone soon!
          </p>
        </div>
      )}

      {/* Delivery Address - only show if trial unlocked and not top-up mode */}
      {!topUpOrder && trialUnlocked && (
        <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Delivery Address</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Enter your delivery address to check if we deliver to your area</p>
        
        <div className="mt-4 space-y-3">
          <div>
            <input
              type="text"
              placeholder="Address line 1"
              value={addressForm.addressLine1}
              onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Address line 2 (optional)"
              value={addressForm.addressLine2}
              onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="City / Town"
              value={addressForm.city}
              onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Postcode"
                value={addressForm.postcode}
                onChange={(e) => {
                  setAddressForm({ ...addressForm, postcode: e.target.value });
                  setDeliveryCheck(null);
                  setPostcodeError("");
                }}
                className="flex-1 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
              />
              <button
                onClick={handleCheckPostcode}
                disabled={!addressForm.postcode.trim() || checkingPostcode}
                className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50"
              >
                {checkingPostcode ? <Loader2 size={16} className="animate-spin" /> : "Check"}
              </button>
            </div>
          </div>
          
          {postcodeError && (
            <p className="text-sm text-red-600">{postcodeError}</p>
          )}
          
          {/* Delivery zone result */}
          {deliveryCheck?.inZone && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <p className="font-semibold text-green-800">Great news! We deliver to {deliveryCheck.zoneName}!</p>
              </div>
              <p className="text-sm text-green-700 mt-1">Choose your delivery date below to continue.</p>
            </div>
          )}
          
          {deliveryCheck?.checked && !deliveryCheck.inZone && deliveryCheck.isLaunching && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="font-semibold text-amber-800">
                🚀 {deliveryCheck.zoneName} is coming soon!
              </p>
              <p className="text-sm text-amber-700 mt-1">
                {deliveryCheck.launchDate 
                  ? `We're launching in your area on ${new Date(deliveryCheck.launchDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`
                  : "We're expanding to your area soon — date to be confirmed."
                }
              </p>
              {expansionSubmitted ? (
                <div className="mt-3 flex items-center gap-2 text-green-700">
                  <CheckCircle size={16} />
                  <p className="text-sm font-medium">Thanks! We&apos;ll let you know when we launch.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-amber-700 mt-2">Want to be notified when we launch?</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      placeholder="Your email (optional)"
                      value={expansionEmail}
                      onChange={(e) => setExpansionEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleExpansionRequest}
                      disabled={submittingExpansion}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      {submittingExpansion ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                      Notify me!
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          
          {deliveryCheck?.checked && !deliveryCheck.inZone && !deliveryCheck.isLaunching && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="font-semibold text-red-800">Sorry, we don&apos;t deliver to your area yet</p>
              <p className="text-sm text-red-700 mt-1">
                Your postcode ({addressForm.postcode}) is outside our current delivery zones.
              </p>
              {expansionSubmitted ? (
                <div className="mt-3 flex items-center gap-2 text-green-700">
                  <CheckCircle size={16} />
                  <p className="text-sm font-medium">Thanks! We&apos;ve noted your interest in {addressForm.postcode}.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-red-700 mt-2">
                    We&apos;re always looking to expand! Let Carrie know you&apos;re interested.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      placeholder="Your email (optional)"
                      value={expansionEmail}
                      onChange={(e) => setExpansionEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                    />
                    <button
                      onClick={handleExpansionRequest}
                      disabled={submittingExpansion}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      {submittingExpansion ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                      Ask Carrie to expand
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Delivery Day Picker - only show if in zone, trial unlocked, and not top-up mode */}
      {!topUpOrder && trialUnlocked && deliveryCheck?.inZone && (
        <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
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
      )}

      {/* Delivery Window - only show if in zone, trial unlocked, and not top-up mode */}
      {!topUpOrder && trialUnlocked && deliveryCheck?.inZone && (
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
      )}

      {/* Attendance Choice - only show if in zone, trial unlocked, and not top-up mode */}
      {!topUpOrder && trialUnlocked && deliveryCheck?.inZone && (
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
            <div className="flex items-start justify-between">
              <div>
                <span className="block font-semibold text-primary">No, I won&apos;t be in – I need a cool bag &amp; box</span>
                {!hasOutstandingBox && (
                  <span className="block text-sm text-muted mt-1">
                    £{BOX_DEPOSIT} refundable deposit for cool box &amp; bag
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowBoxInfo(true); }}
                className="ml-2 mt-0.5 text-secondary hover:text-primary"
              >
                <HelpCircle size={22} />
              </button>
            </div>
          </button>
        </div>
      </div>
      )}

      {/* Box Info Modal */}
      {showBoxInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package size={24} className="text-secondary" />
                <h2 className="text-lg font-bold text-primary">Cool Box &amp; Bag</h2>
              </div>
              <button onClick={() => setShowBoxInfo(false)} className="rounded p-1 text-muted hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-sm text-muted">
              <p>
                If you won&apos;t be in to receive your delivery, we&apos;ll leave your order in a <strong className="text-primary">reusable cool box with an insulated bag</strong> to keep everything fresh.
              </p>
              <p>
                There&apos;s a <strong className="text-primary">refundable £{BOX_DEPOSIT} deposit</strong> for the box and bag on your first order.
              </p>
              <p>
                <strong className="text-primary">Next time you order:</strong> The system remembers you have a box, so you won&apos;t need to pay the deposit again – we&apos;ll simply swap your old box for a fresh one!
              </p>
              <p>
                <strong className="text-primary">If you don&apos;t order again:</strong> 😢 No worries! We&apos;ll come and collect the box and bag on our next delivery round and refund your £{BOX_DEPOSIT} deposit.
              </p>
            </div>
            <button
              onClick={() => setShowBoxInfo(false)}
              className="mt-6 w-full rounded-lg bg-primary py-2.5 text-center font-semibold text-background transition hover:bg-secondary"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Safe Place (only if not in, in zone, trial unlocked, and not top-up mode) */}
      {!topUpOrder && trialUnlocked && deliveryCheck?.inZone && willBeIn === false && (
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
        <div className="flex items-center justify-between border-b border-primary/5 py-4">
          <span className="text-muted">Delivery Fee</span>
          <span className="font-semibold text-primary">
            {topUpOrder ? <span className="text-secondary">Free (top-up)</span> : `£${DELIVERY_FEE.toFixed(2)}`}
          </span>
        </div>
        {needsBoxDeposit && !topUpOrder && (
          <div className="flex items-center justify-between border-b border-primary/5 py-4">
            <span className="text-muted">Box Deposit (refundable)</span>
            <span className="font-semibold text-primary">£{BOX_DEPOSIT.toFixed(2)}</span>
          </div>
        )}
        {hasGlassBottles && !topUpOrder && (
          <div className="border-b border-primary/5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-muted">Bottle Deposit (refundable)</span>
              <span className="font-semibold text-primary">
                {hasOwnBottles === null ? "—" : hasOwnBottles ? "£0.00" : `£${bottleDeposit.toFixed(2)}`}
              </span>
            </div>
            <p className="text-xs text-muted mt-2 mb-3">Your order includes milk in glass bottles from Alkmonton Dairy</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setHasOwnBottles(true)}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left text-sm transition ${
                  hasOwnBottles === true
                    ? "border-primary bg-primary/5"
                    : "border-primary/20 bg-surface hover:border-secondary"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary">I already have bottles to return</span>
                    <span className="block text-xs text-muted mt-0.5">
                      I&apos;ll leave them outside for collection during delivery
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowBottleInfo(!showBottleInfo); }}
                    className="ml-2 mt-0.5 text-secondary hover:text-primary"
                  >
                    <HelpCircle size={18} />
                  </button>
                </div>
              </button>
              {hasOwnBottles === true && showBottleInfo && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> If you don&apos;t leave your bottles outside, we may not be able to leave your milk.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setHasOwnBottles(false)}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left text-sm transition ${
                  hasOwnBottles === false
                    ? "border-primary bg-primary/5"
                    : "border-primary/20 bg-surface hover:border-secondary"
                }`}
              >
                <span className="font-semibold text-primary">I need to pay a bottle deposit</span>
                <span className="block text-xs text-muted mt-0.5">
                  £{BOTTLE_DEPOSIT} per bottle – refunded when you return them
                </span>
              </button>
              {hasOwnBottles === false && (
                <div className="flex items-center gap-3 mt-2 pl-2">
                  <span className="text-sm text-muted">How many bottles?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBottleDepositQty(Math.max(1, bottleDepositQty - 1))}
                      className="w-8 h-8 rounded-lg border border-primary/20 bg-surface flex items-center justify-center text-primary hover:border-secondary disabled:opacity-50"
                      disabled={bottleDepositQty <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-semibold text-primary">{bottleDepositQty}</span>
                    <button
                      type="button"
                      onClick={() => setBottleDepositQty(bottleDepositQty + 1)}
                      className="w-8 h-8 rounded-lg border border-primary/20 bg-surface flex items-center justify-center text-primary hover:border-secondary"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {topUpOrder && (
          <div className="flex items-center justify-between border-b border-primary/5 py-4">
            <span className="text-muted">Adding to Order</span>
            <span className="font-semibold text-primary">#{topUpOrder.orderNumber}</span>
          </div>
        )}
        {!topUpOrder && selectedDay && (
          <div className="flex items-center justify-between border-b border-primary/5 py-4">
            <span className="text-muted">Delivery Date</span>
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
        
        {/* Minimum order warning */}
        {belowMinimum && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">
              Minimum order is £{MINIMUM_ORDER.toFixed(2)}
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Add £{amountToMinimum.toFixed(2)} more to checkout
            </p>
          </div>
        )}
        
        <button
          disabled={
            topUpOrder 
              ? (belowMinimum || !isSignedIn || placing)
              : (belowMinimum || !trialUnlocked || !deliveryCheck?.inZone || !addressForm.addressLine1.trim() || !selectedDay || !deliveryWindow || willBeIn === null || (willBeIn === false && !safePlace.trim()) || (hasGlassBottles && hasOwnBottles === null) || placing)
          }
          onClick={handlePlaceOrder}
          className="mt-6 w-full rounded-lg bg-accent py-3 text-center font-semibold text-primary transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? "Redirecting to Checkout..." : belowMinimum ? `Minimum order £${MINIMUM_ORDER}` : topUpOrder ? "Add to Order & Pay" : !trialUnlocked ? "Enter Trial Code" : !isSignedIn ? "Sign In to Continue" : !deliveryCheck?.inZone ? "Check Postcode First" : !addressForm.addressLine1.trim() ? "Enter Address" : !selectedDay ? "Select Delivery Day" : !deliveryWindow ? "Select Delivery Window" : willBeIn === null ? "Select Attendance" : (willBeIn === false && !safePlace.trim()) ? "Enter Safe Place" : (hasGlassBottles && hasOwnBottles === null) ? "Select Bottle Deposit Option" : "Continue to Checkout"}
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
