"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  type Order,
  type OrderItem,
  type CustomerProfile,
  getOrders,
  getRatingsByOrder,
  submitOrderRatings,
  getCustomerProfile,
  saveCustomerAddress,
  clearCustomerAddress,
  canModifyOrder,
  cancelOrder,
  updateOrderItems,
  submitFeedback,
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
  MessageSquare,
  RefreshCw,
  X,
  Plus,
  Minus,
  AlertTriangle,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600 bg-red-50" },
};

function StarRating({ value, onChange, size = 18 }: { value: number; onChange?: (stars: number) => void; size?: number }) {
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
            size={size}
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

interface DraftRating {
  stars: number;
  comment: string;
}

export default function AccountPage() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const { addItems, products } = useCart();

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
  // Submitted ratings from DB
  const [submittedRatings, setSubmittedRatings] = useState<Record<string, Record<string, { stars: number; comment?: string }>>>({});
  // Draft ratings being edited (not yet submitted)
  const [draftRatings, setDraftRatings] = useState<Record<string, Record<string, DraftRating>>>({});
  // Track which orders are in "review mode"
  const [reviewingOrder, setReviewingOrder] = useState<string | null>(null);
  // Track expanded comment fields
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  // Submitting state
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Overall review for Local
  const [overallReview, setOverallReview] = useState<Record<string, string>>({});
  const [submittedOverallReview, setSubmittedOverallReview] = useState<Set<string>>(new Set());

  // Order modification state
  const [modifiableOrders, setModifiableOrders] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [modifyingOrder, setModifyingOrder] = useState(false);

  // Load data
  useEffect(() => {
    if (!user) return;

    getCustomerProfile(user.id).then(setProfile).catch(console.error);

    getOrders(user.id).then(async (orders) => {
      setOrders(orders);
      const delivered = orders.filter((o) => o.status === "delivered");
      const ratingMap: Record<string, Record<string, { stars: number; comment?: string }>> = {};
      for (const order of delivered) {
        ratingMap[order.id] = await getRatingsByOrder(user.id, order.id);
      }
      setSubmittedRatings(ratingMap);

      // Check which orders can be modified
      const modifiable = new Set<string>();
      for (const order of orders) {
        if (order.status !== "delivered" && order.status !== "cancelled") {
          const canModify = await canModifyOrder(order.id);
          if (canModify) modifiable.add(order.id);
        }
      }
      setModifiableOrders(modifiable);
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
        hasOutstandingBox: profile?.hasOutstandingBox ?? false,
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

  const startReview = (orderId: string, items: Array<{ productId: string }>) => {
    const existing = submittedRatings[orderId] ?? {};
    const draft: Record<string, DraftRating> = {};
    for (const item of items) {
      draft[item.productId] = {
        stars: existing[item.productId]?.stars ?? 0,
        comment: existing[item.productId]?.comment ?? "",
      };
    }
    setDraftRatings((prev) => ({ ...prev, [orderId]: draft }));
    setReviewingOrder(orderId);
  };

  const updateDraftRating = (orderId: string, productId: string, field: "stars" | "comment", value: number | string) => {
    setDraftRatings((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [productId]: {
          ...prev[orderId]?.[productId],
          [field]: value,
        },
      },
    }));
  };

  const toggleComment = (key: string) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const submitReview = async (orderId: string) => {
    if (!user) return;
    const draft = draftRatings[orderId];
    if (!draft) return;

    const ratings = Object.entries(draft)
      .filter(([_, r]) => r.stars > 0)
      .map(([productId, r]) => ({
        productId,
        stars: r.stars,
        comment: r.comment.trim() || undefined,
      }));

    if (ratings.length === 0) return;

    setSubmittingReview(true);
    try {
      await submitOrderRatings(user.id, orderId, ratings);
      const newSubmitted: Record<string, { stars: number; comment?: string }> = {};
      for (const r of ratings) {
        newSubmitted[r.productId] = { stars: r.stars, comment: r.comment };
      }
      setSubmittedRatings((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], ...newSubmitted },
      }));
      
      // Submit overall review if provided
      const overall = overallReview[orderId]?.trim();
      if (overall) {
        const order = orders.find((o) => o.id === orderId);
        const customerName = user.fullName || user.firstName || "Customer";
        await submitFeedback(customerName, overall, "order_review", order?.orderNumber);
        setSubmittedOverallReview((prev) => new Set(prev).add(orderId));
      }
      
      setReviewingOrder(null);
      setExpandedComments(new Set());
    } catch (error) {
      console.error("Failed to submit review:", error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const cancelReview = () => {
    setReviewingOrder(null);
    setExpandedComments(new Set());
  };

  const [reorderedId, setReorderedId] = useState<string | null>(null);

  // Order modification handlers
  const handleCancelOrder = async (orderId: string) => {
    setModifyingOrder(true);
    try {
      const order = orders.find((o) => o.id === orderId);
      await cancelOrder(orderId);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "cancelled" as const } : o));
      setModifiableOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      setCancellingOrder(null);

      // Send cancellation email
      if (order?.customerEmail) {
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "order_status_update",
            data: {
              customerEmail: order.customerEmail,
              customerName: user?.fullName || user?.firstName || "Customer",
              orderNumber: order.orderNumber,
              status: "cancelled",
              deliveryDay: new Date(order.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
            },
          }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to cancel order:", error);
      alert("Failed to cancel order. The cutoff time may have passed.");
    } finally {
      setModifyingOrder(false);
    }
  };

  const startEditOrder = (order: Order) => {
    setEditingOrder(order.id);
    setEditingItems([...order.items]);
  };

  const updateEditingItemQuantity = (productId: string, delta: number) => {
    setEditingItems((prev) => {
      const updated = prev.map((item) => {
        if (item.productId === productId) {
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter((item) => item.quantity > 0);
      return updated;
    });
  };

  const removeEditingItem = (productId: string) => {
    setEditingItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSaveOrderChanges = async () => {
    if (!editingOrder || editingItems.length === 0) return;
    setModifyingOrder(true);
    try {
      await updateOrderItems(editingOrder, editingItems);
      // Update local state
      const newTotal = editingItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      setOrders((prev) => prev.map((o) => 
        o.id === editingOrder ? { ...o, items: editingItems, total: newTotal } : o
      ));
      setEditingOrder(null);
      setEditingItems([]);
    } catch (error) {
      console.error("Failed to update order:", error);
      alert("Failed to update order. The cutoff time may have passed.");
    } finally {
      setModifyingOrder(false);
    }
  };

  const cancelEditOrder = () => {
    setEditingOrder(null);
    setEditingItems([]);
  };

  const handleReorder = (order: Order) => {
    // Only add items that are still available (in stock and in products list)
    const itemsToAdd = order.items
      .filter((item) => {
        const product = products.find((p) => p.id === item.productId);
        return product && product.inStock;
      })
      .map((item) => ({ productId: item.productId, quantity: item.quantity }));
    
    if (itemsToAdd.length > 0) {
      addItems(itemsToAdd);
      setReorderedId(order.id);
      setTimeout(() => setReorderedId(null), 2000);
    }
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
              <button
                onClick={() => openUserProfile()}
                className="ml-2 text-xs text-secondary hover:text-secondary/80 transition flex items-center gap-1"
              >
                <Pencil size={12} />
                Change
              </button>
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
              const orderSubmittedRatings = submittedRatings[order.id] ?? {};
              const isReviewing = reviewingOrder === order.id;
              const draft = draftRatings[order.id] ?? {};
              const hasAllRatings = order.items.every((item) => orderSubmittedRatings[item.productId]?.stars > 0);
              const draftHasAnyStars = Object.values(draft).some((r) => r.stars > 0);
              const canModify = modifiableOrders.has(order.id);
              const isEditing = editingOrder === order.id;
              const isCancelling = cancellingOrder === order.id;

              return (
                <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-primary">Order #{order.orderNumber}</p>
                      <p className="text-xs text-muted">Placed on {order.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canModify && !isEditing && (
                        <>
                          <button
                            onClick={() => startEditOrder(order)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            <Pencil size={12} />
                            Amend
                          </button>
                          <button
                            onClick={() => setCancellingOrder(order.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            <X size={12} />
                            Cancel
                          </button>
                        </>
                      )}
                      {!canModify && order.status !== "delivered" && order.status !== "cancelled" && (
                        <span className="text-xs text-muted italic">Cutoff passed</span>
                      )}
                      <button
                        onClick={() => handleReorder(order)}
                        disabled={reorderedId === order.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          reorderedId === order.id
                            ? "bg-green-100 text-green-700"
                            : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                        }`}
                      >
                        <RefreshCw size={12} className={reorderedId === order.id ? "" : ""} />
                        {reorderedId === order.id ? "Added to Cart!" : "Reorder"}
                      </button>
                      <span className="text-xs text-muted">
                        Delivery: <span className="font-medium text-secondary">{order.deliveryDay}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Cancel confirmation dialog */}
                  {isCancelling && (
                    <div className="bg-red-50 border-b border-red-100 px-6 py-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-800">Cancel this order?</p>
                          <p className="text-xs text-red-600 mt-1">This action cannot be undone.</p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={modifyingOrder}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              {modifyingOrder ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              Yes, Cancel Order
                            </button>
                            <button
                              onClick={() => setCancellingOrder(null)}
                              disabled={modifyingOrder}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 border border-gray-200"
                            >
                              Keep Order
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edit mode UI */}
                  {isEditing && (
                    <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-blue-800">Editing Order</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveOrderChanges}
                            disabled={modifyingOrder || editingItems.length === 0}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {modifyingOrder ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save Changes
                          </button>
                          <button
                            onClick={cancelEditOrder}
                            disabled={modifyingOrder}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 border border-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {editingItems.map((item) => (
                          <div key={item.productId} className="flex items-center justify-between bg-white rounded-lg px-4 py-2">
                            <span className="text-sm text-primary">{item.productName}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted">£{item.price.toFixed(2)} each</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateEditingItemQuantity(item.productId, -1)}
                                  className="p-1 rounded bg-gray-100 hover:bg-gray-200 transition"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                <button
                                  onClick={() => updateEditingItemQuantity(item.productId, 1)}
                                  className="p-1 rounded bg-gray-100 hover:bg-gray-200 transition"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <span className="text-sm font-medium text-primary w-16 text-right">
                                £{(item.quantity * item.price).toFixed(2)}
                              </span>
                              <button
                                onClick={() => removeEditingItem(item.productId)}
                                className="p-1 rounded text-red-500 hover:bg-red-50 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {editingItems.length === 0 && (
                          <p className="text-xs text-red-600 text-center py-2">No items remaining. Add items or cancel to keep the order.</p>
                        )}
                        <div className="flex justify-end pt-2 border-t border-blue-100">
                          <span className="text-sm font-semibold text-blue-800">
                            New Total: £{editingItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order items grouped by supplier */}
                  <div className={`px-6 py-4 ${isEditing ? "opacity-50 pointer-events-none" : ""}`}>
                    {(() => {
                      // Group items by supplier
                      const supplierGroups = order.items.reduce((acc, item) => {
                        const key = item.supplierName || "Unknown Supplier";
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                      }, {} as Record<string, typeof order.items>);

                      return Object.entries(supplierGroups).map(([supplierName, items]) => (
                        <div key={supplierName} className="mb-4 last:mb-0">
                          <p className="text-xs font-semibold text-secondary mb-2 pb-1 border-b border-secondary/20">
                            {supplierName}
                          </p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-muted">
                                <th className="pb-1 font-medium">Item</th>
                                <th className="pb-1 font-medium text-center">Qty</th>
                                <th className="pb-1 font-medium text-right">Price</th>
                                <th className="pb-1 font-medium text-right">Subtotal</th>
                                {isDelivered && <th className="pb-1 font-medium text-right">Rating</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, i) => {
                                const submitted = orderSubmittedRatings[item.productId];
                                const draftRating = draft[item.productId];
                                const commentKey = `${order.id}-${item.productId}`;
                                const showComment = expandedComments.has(commentKey);

                                return (
                                  <tr key={i} className="border-t border-primary/5">
                                    <td className="py-2 text-primary">{item.productName}</td>
                                    <td className="py-2 text-center text-muted">{item.quantity}</td>
                                    <td className="py-2 text-right text-muted">£{item.price.toFixed(2)}</td>
                                    <td className="py-2 text-right font-medium text-primary">
                                      £{(item.quantity * item.price).toFixed(2)}
                                    </td>
                                    {isDelivered && (
                                      <td className="py-2">
                                        <div className="flex flex-col items-end gap-1">
                                          {isReviewing ? (
                                            <>
                                              <div className="flex items-center gap-2">
                                                <StarRating
                                                  value={draftRating?.stars ?? 0}
                                                  onChange={(stars) => updateDraftRating(order.id, item.productId, "stars", stars)}
                                                  size={20}
                                                />
                                                <button
                                                  onClick={() => toggleComment(commentKey)}
                                                  className={`p-1 rounded transition ${showComment ? "text-secondary" : "text-muted hover:text-primary"}`}
                                                  title="Add written review"
                                                >
                                                  <MessageSquare size={16} />
                                                </button>
                                              </div>
                                              {showComment && (
                                                <textarea
                                                  value={draftRating?.comment ?? ""}
                                                  onChange={(e) => updateDraftRating(order.id, item.productId, "comment", e.target.value)}
                                                  placeholder="Write a review (optional)..."
                                                  className="mt-1 w-full max-w-xs rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs outline-none focus:border-secondary"
                                                  rows={2}
                                                />
                                              )}
                                            </>
                                          ) : submitted?.stars ? (
                                            <div className="flex flex-col items-end gap-1">
                                              <StarRating value={submitted.stars} size={16} />
                                              {submitted.comment && (
                                                <p className="text-[10px] text-muted max-w-[150px] truncate" title={submitted.comment}>
                                                  "{submitted.comment}"
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-muted">—</span>
                                          )}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Overall review for Local */}
                  {isDelivered && isReviewing && (
                    <div className="mx-6 mb-4 rounded-lg bg-secondary/10 p-4">
                      <label className="block text-sm font-semibold text-primary mb-2">
                        Overall feedback for Local
                      </label>
                      <textarea
                        value={overallReview[order.id] ?? ""}
                        onChange={(e) => setOverallReview((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="How was your overall experience with Local? Any suggestions or comments? (optional)"
                        className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none focus:border-secondary"
                        rows={3}
                      />
                      <p className="mt-1 text-xs text-muted">This feedback will be shared with the Local team</p>
                    </div>
                  )}
                  
                  {/* Show submitted overall review */}
                  {isDelivered && !isReviewing && submittedOverallReview.has(order.id) && (
                    <div className="mx-6 mb-4 rounded-lg bg-green-50 border border-green-200 p-3">
                      <p className="text-xs font-medium text-green-700">✓ Overall feedback submitted</p>
                    </div>
                  )}

                  {/* Order footer */}
                  <div className="flex items-center justify-between border-t border-primary/5 bg-secondary/5 px-6 py-3">
                    {isDelivered && (
                      <div className="flex items-center gap-3">
                        {isReviewing ? (
                          <>
                            <button
                              onClick={cancelReview}
                              className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-medium text-muted hover:bg-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => submitReview(order.id)}
                              disabled={!draftHasAnyStars || submittingReview}
                              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-secondary disabled:opacity-50"
                            >
                              {submittingReview ? "Submitting..." : "Submit Review"}
                            </button>
                          </>
                        ) : hasAllRatings ? (
                          <p className="text-xs text-green-600 font-medium">✓ Review submitted</p>
                        ) : (
                          <button
                            onClick={() => startReview(order.id, order.items)}
                            className="rounded-lg bg-secondary/20 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-secondary/30"
                          >
                            {Object.keys(orderSubmittedRatings).length > 0 ? "Edit Review" : "Leave a Review"}
                          </button>
                        )}
                      </div>
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
