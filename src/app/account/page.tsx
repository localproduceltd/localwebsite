"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  type Order,
  type CustomerProfile,
  type DeliveryZone,
  getOrders,
  getRatingsByOrder,
  submitRating,
  getCustomerProfile,
  saveCustomerPostcode,
  clearCustomerPostcode,
  getDeliveryZones,
  getActiveSuppliers,
  type Supplier,
} from "@/lib/data";
import { lookupPostcode, distanceMiles } from "@/lib/postcode";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  MapPin,
  Search,
  Trash2,
  CheckCircle2,
  XOctagon,
  Loader2,
  User,
} from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

function StarRating({ value, onChange }: { value: number; onChange?: (stars: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} transition`}
        >
          <Star
            size={18}
            className={
              (hover || value) >= star
                ? "fill-accent text-accent"
                : "text-primary/20"
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function AccountPage() {
  const { user } = useUser();

  // Postcode state
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [postcodeInput, setPostcodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [deliveryResult, setDeliveryResult] = useState<{ inArea: boolean; nearestZone: string; distance: number; maxRadius: number } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});

  // Load data
  useEffect(() => {
    if (!user) return;

    getCustomerProfile(user.id).then(setProfile).catch(console.error);
    getDeliveryZones().then(setZones).catch(console.error);
    getActiveSuppliers().then(setSuppliers).catch(console.error);

    getOrders(user.id).then(async (orders) => {
      setOrders(orders);
      const delivered = orders.filter((o) => o.status === "delivered");
      const ratingMap: Record<string, Record<string, number>> = {};
      for (const order of delivered) {
        ratingMap[order.id] = await getRatingsByOrder(user.id, order.id);
      }
      setRatings(ratingMap);
    }).catch(console.error);
  }, [user]);

  // Calculate delivery check against all zones
  useEffect(() => {
    if (profile?.lat && profile?.lng && zones.length > 0) {
      let inArea = false;
      let nearestZone = "";
      let nearestDist = Infinity;

      for (const zone of zones) {
        const dist = distanceMiles(profile.lat, profile.lng, zone.centreLat, zone.centreLng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestZone = zone.name;
        }
        if (dist <= zone.radiusMiles) {
          inArea = true;
        }
      }

      const maxRadius = Math.max(...zones.map((z) => z.radiusMiles));
      setDeliveryResult({ inArea, nearestZone, distance: nearestDist, maxRadius });
    } else {
      setDeliveryResult(null);
    }
  }, [profile, zones]);

  const handleLookup = async () => {
    if (!user || !postcodeInput.trim()) return;
    setLookupLoading(true);
    setLookupError("");

    const result = await lookupPostcode(postcodeInput);
    if (!result) {
      setLookupError("Postcode not found. Please check and try again.");
      setLookupLoading(false);
      return;
    }

    try {
      await saveCustomerPostcode(user.id, result.postcode, result.lat, result.lng);
      setProfile({
        id: profile?.id ?? "",
        clerkUserId: user.id,
        postcode: result.postcode,
        lat: result.lat,
        lng: result.lng,
      });
      setPostcodeInput("");
    } catch {
      setLookupError("Failed to save postcode. Please try again.");
    }
    setLookupLoading(false);
  };

  const handleClear = async () => {
    if (!user) return;
    try {
      await clearCustomerPostcode(user.id);
      setProfile((prev) => prev ? { ...prev, postcode: null, lat: null, lng: null } : null);
    } catch {
      console.error("Failed to clear postcode");
    }
  };

  const handleRate = async (orderId: string, productId: string, stars: number) => {
    if (!user) return;
    await submitRating(user.id, productId, orderId, stars);
    setRatings((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [productId]: stars },
    }));
  };

  // Supplier distances
  const supplierDistances = profile?.lat && profile?.lng
    ? suppliers
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          ...s,
          distance: distanceMiles(profile.lat!, profile.lng!, s.lat!, s.lng!),
        }))
        .sort((a, b) => a.distance - b.distance)
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <User size={28} className="text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-primary">My Account</h1>
          <p className="mt-1 text-secondary">Manage your delivery address and view orders</p>
        </div>
      </div>

      {/* ─── Postcode / Delivery Section ─── */}
      <section className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Delivery Address</h2>
        </div>

        {profile?.postcode ? (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-secondary/10 px-4 py-2 text-sm font-bold text-primary">
                {profile.postcode}
              </span>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>

            {/* Delivery area result */}
            {deliveryResult && (
              <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                deliveryResult.inArea
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {deliveryResult.inArea ? (
                  <>
                    <CheckCircle2 size={18} />
                    Great news! We deliver to your area ({deliveryResult.distance.toFixed(1)} miles from {deliveryResult.nearestZone})
                  </>
                ) : (
                  <>
                    <XOctagon size={18} />
                    Sorry, you&apos;re {deliveryResult.distance.toFixed(1)} miles from the nearest zone ({deliveryResult.nearestZone})
                  </>
                )}
              </div>
            )}

            {/* Nearby suppliers */}
            {supplierDistances.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-primary">Distance to suppliers</h3>
                <div className="mt-2 space-y-2">
                  {supplierDistances.map((s) => (
                    <Link
                      key={s.id}
                      href={`/suppliers/${s.id}`}
                      className="flex items-center justify-between rounded-lg bg-surface px-4 py-2.5 transition hover:bg-secondary/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full">
                          <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary">{s.name}</p>
                          <p className="text-xs text-muted">{s.location}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-secondary">
                        {s.distance.toFixed(1)} mi
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted">Enter your postcode to check if we deliver to your area and see how far each supplier is from you.</p>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="e.g. DE6 1GH"
                  value={postcodeInput}
                  onChange={(e) => { setPostcodeInput(e.target.value.toUpperCase()); setLookupError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="w-full rounded-lg border border-primary/20 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={lookupLoading || !postcodeInput.trim()}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : "Check"}
              </button>
            </div>
            {lookupError && (
              <p className="mt-2 text-sm text-red-600">{lookupError}</p>
            )}
          </div>
        )}
      </section>

      {/* ─── Orders Section ─── */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold text-primary">My Orders</h2>
        <p className="mt-1 text-secondary">View your order history and track current orders</p>

        {orders.length === 0 ? (
          <div className="mt-10 text-center">
            <Package size={48} className="mx-auto text-muted" />
            <p className="mt-4 text-lg font-medium text-primary">No orders yet</p>
            <p className="mt-1 text-sm text-muted">Start shopping to place your first order!</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {orders.map((order) => {
              const status = statusConfig[order.status];
              const StatusIcon = status.icon;
              const isDelivered = order.status === "delivered";
              const orderRatings = ratings[order.id] ?? {};
              return (
                <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-primary">Order #{order.orderNumber}</p>
                      <p className="text-xs text-muted">Placed on {order.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted">
                        Delivery: <span className="font-medium text-secondary">{order.deliveryDay}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="px-6 py-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="pb-2 font-medium">Item</th>
                          <th className="pb-2 font-medium text-center">Qty</th>
                          <th className="pb-2 font-medium text-right">Price</th>
                          <th className="pb-2 font-medium text-right">Subtotal</th>
                          {isDelivered && <th className="pb-2 font-medium text-right">Rate</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, i) => (
                          <tr key={i} className="border-t border-primary/5">
                            <td className="py-2 text-primary">{item.productName}</td>
                            <td className="py-2 text-center text-muted">{item.quantity}</td>
                            <td className="py-2 text-right text-muted">£{item.price.toFixed(2)}</td>
                            <td className="py-2 text-right font-medium text-primary">
                              £{(item.quantity * item.price).toFixed(2)}
                            </td>
                            {isDelivered && (
                              <td className="py-2">
                                <div className="flex justify-end">
                                  <StarRating
                                    value={orderRatings[item.productId] ?? 0}
                                    onChange={(stars) => handleRate(order.id, item.productId, stars)}
                                  />
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Order total */}
                  <div className="flex items-center justify-between border-t border-primary/5 bg-secondary/5 px-6 py-3">
                    {isDelivered && (
                      <p className="text-xs text-muted">
                        {Object.keys(orderRatings).length === order.items.length
                          ? "Thanks for rating! ⭐"
                          : "Tap the stars to rate your products"}
                      </p>
                    )}
                    <p className="text-sm font-bold text-primary ml-auto">
                      Total: £{order.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
