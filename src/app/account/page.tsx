"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  type Order,
  type CustomerProfile,
  getOrders,
  getRatingsByOrder,
  submitRating,
  getCustomerProfile,
  saveCustomerAddress,
  clearCustomerAddress,
} from "@/lib/data";
import { lookupPostcode } from "@/lib/postcode";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  MapPin,
  Trash2,
  Loader2,
  User,
  Mail,
  Pencil,
  Save,
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

  // Profile state
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});

  // Load data
  useEffect(() => {
    if (!user) return;

    getCustomerProfile(user.id).then(setProfile).catch(console.error);

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

  const startEditAddress = () => {
    setAddressForm({
      addressLine1: profile?.addressLine1 ?? "",
      addressLine2: profile?.addressLine2 ?? "",
      city: profile?.city ?? "",
      postcode: profile?.postcode ?? "",
    });
    setEditingAddress(true);
    setSaveError("");
  };

  const handleSaveAddress = async () => {
    if (!user || !addressForm.postcode.trim()) return;
    setSaving(true);
    setSaveError("");

    const result = await lookupPostcode(addressForm.postcode);
    if (!result) {
      setSaveError("Postcode not found. Please check and try again.");
      setSaving(false);
      return;
    }

    try {
      await saveCustomerAddress(user.id, {
        addressLine1: addressForm.addressLine1.trim(),
        addressLine2: addressForm.addressLine2.trim() || undefined,
        city: addressForm.city.trim(),
        postcode: result.postcode,
      }, result.lat, result.lng);
      
      setProfile({
        id: profile?.id ?? "",
        clerkUserId: user.id,
        addressLine1: addressForm.addressLine1.trim(),
        addressLine2: addressForm.addressLine2.trim() || null,
        city: addressForm.city.trim(),
        postcode: result.postcode,
        lat: result.lat,
        lng: result.lng,
      });
      setEditingAddress(false);
    } catch {
      setSaveError("Failed to save address. Please try again.");
    }
    setSaving(false);
  };

  const handleClearAddress = async () => {
    if (!user) return;
    try {
      await clearCustomerAddress(user.id);
      setProfile((prev) => prev ? { ...prev, addressLine1: null, addressLine2: null, city: null, postcode: null, lat: null, lng: null } : null);
    } catch {
      console.error("Failed to clear address");
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <User size={28} className="text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-primary">My Account</h1>
          <p className="mt-1 text-secondary">Manage your details and view orders</p>
        </div>
      </div>

      {/* ─── Account Details Section ─── */}
      <section className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <User size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">Account Details</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Name</label>
            <p className="text-sm font-medium text-primary">{user?.fullName || "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email</label>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-muted" />
              <p className="text-sm font-medium text-primary">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Delivery Address Section ─── */}
      <section className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-secondary" />
            <h2 className="text-lg font-semibold text-primary">Delivery Address</h2>
          </div>
          {profile?.postcode && !editingAddress && (
            <button
              onClick={startEditAddress}
              className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary/80 transition"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>

        {editingAddress ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Address Line 1 *</label>
              <input
                type="text"
                placeholder="House number and street"
                value={addressForm.addressLine1}
                onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Address Line 2</label>
              <input
                type="text"
                placeholder="Apartment, suite, etc. (optional)"
                value={addressForm.addressLine2}
                onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">City / Town *</label>
                <input
                  type="text"
                  placeholder="e.g. Ashbourne"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Postcode *</label>
                <input
                  type="text"
                  placeholder="e.g. DE6 1GH"
                  value={addressForm.postcode}
                  onChange={(e) => setAddressForm({ ...addressForm, postcode: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
            </div>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSaveAddress}
                disabled={saving || !addressForm.addressLine1.trim() || !addressForm.city.trim() || !addressForm.postcode.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Address
              </button>
              <button
                onClick={() => setEditingAddress(false)}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted hover:text-primary transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : profile?.postcode ? (
          <div>
            <div className="text-sm text-primary space-y-0.5">
              {profile.addressLine1 && <p className="font-medium">{profile.addressLine1}</p>}
              {profile.addressLine2 && <p>{profile.addressLine2}</p>}
              {profile.city && <p>{profile.city}</p>}
              <p className="font-semibold">{profile.postcode}</p>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Link href="/map" className="text-xs font-medium text-secondary hover:underline">
                Check delivery coverage on Map
              </Link>
              <button
                onClick={handleClearAddress}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-4">Add your delivery address to place orders.</p>
            <button
              onClick={startEditAddress}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              <MapPin size={16} />
              Add Address
            </button>
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
