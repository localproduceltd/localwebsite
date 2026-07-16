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
  updateCustomerDeliveryDetails,
  canModifyOrder,
  submitFeedback,
} from "@/lib/data";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Loader2,
  User,
  Mail,
  Pencil,
  MessageSquare,
  RefreshCw,
  Plus,
  Truck,
  MapPin,
} from "lucide-react";
import MapPicker from "@/components/MapPicker";
import MiniMapPreview from "@/components/MiniMapPreview";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";

const statusConfig = {
  ordered: { label: "Ordered", icon: Clock, color: "text-amber-600 bg-amber-50" },
  prepped: { label: "Prepped", icon: Package, color: "text-blue-600 bg-blue-50" },
  next_hour: { label: "Next Hour", icon: Truck, color: "text-purple-600 bg-purple-50" },
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
  const { addItems, products, setTopUpOrder } = useCart();
  const router = useRouter();

  // Profile state
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  // Delivery details - always directly editable, like the checkout form
  const [detailsForm, setDetailsForm] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    phone: "",
    deliveryInstructions: "",
    pinLat: null as number | null,
    pinLng: null as number | null,
  });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);

  // Populate the form when the profile loads (and re-sync after a save)
  useEffect(() => {
    if (!profile) return;
    setDetailsForm({
      addressLine1: profile.addressLine1 ?? "",
      addressLine2: profile.addressLine2 ?? "",
      city: profile.city ?? "",
      postcode: profile.postcode ?? "",
      phone: profile.phone ?? "",
      deliveryInstructions: profile.deliveryInstructions ?? "",
      pinLat: profile.pinLat ?? null,
      pinLng: profile.pinLng ?? null,
    });
  }, [profile]);

  const saveDetails = async () => {
    if (!user) return;
    setSavingDetails(true);
    try {
      await updateCustomerDeliveryDetails(user.id, {
        name: user.fullName ?? undefined,
        addressLine1: detailsForm.addressLine1.trim() || null,
        addressLine2: detailsForm.addressLine2.trim() || null,
        city: detailsForm.city.trim() || null,
        postcode: detailsForm.postcode.trim() || null,
        phone: detailsForm.phone.trim() || null,
        deliveryInstructions: detailsForm.deliveryInstructions.trim() || null,
        pinLat: detailsForm.pinLat,
        pinLng: detailsForm.pinLng,
      });
      const fresh = await getCustomerProfile(user.id);
      setProfile(fresh);
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save delivery details:", error);
      alert("Failed to save your details - please try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  // Submitted ratings from DB
  const [submittedRatings, setSubmittedRatings] = useState<Record<string, Record<string, { stars: number | null; comment?: string }>>>({});
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
    const overall = overallReview[orderId]?.trim();
    
    // Include entries with stars > 0 OR non-empty comment
    const ratings = draft
      ? Object.entries(draft)
          .filter(([_, r]) => r.stars > 0 || r.comment.trim())
          .map(([productId, r]) => ({
            productId,
            stars: r.stars > 0 ? r.stars : null,
            comment: r.comment.trim() || undefined,
          }))
      : [];

    // Nothing to submit if no ratings AND no overall feedback
    if (ratings.length === 0 && !overall) return;

    setSubmittingReview(true);
    try {
      // Submit product ratings if any
      if (ratings.length > 0) {
        await submitOrderRatings(user.id, orderId, ratings);
        const newSubmitted: Record<string, { stars: number | null; comment?: string }> = {};
        for (const r of ratings) {
          newSubmitted[r.productId] = { stars: r.stars, comment: r.comment };
        }
        setSubmittedRatings((prev) => ({
          ...prev,
          [orderId]: { ...prev[orderId], ...newSubmitted },
        }));
      }
      
      // Submit overall review if provided
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

  // Handle add to order - sets up top-up mode and navigates to products
  const handleAddToOrder = (order: Order) => {
    setTopUpOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryDay: order.deliveryDay,
      customerEmail: order.customerEmail || "",
    });
    router.push("/products");
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

      {/* ─── Delivery Details Section ─── */}
      <section className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={20} className="text-secondary" />
          <h2 className="text-lg font-semibold text-primary">My Delivery Details</h2>
        </div>
        <p className="text-xs text-muted mb-4">
          These fill in automatically at checkout. Changes apply from your next order - they don&apos;t affect one you&apos;ve already placed.
        </p>

        {detailsSaved && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            ✓ Delivery details saved
          </div>
        )}

        <div className="space-y-3">
            <input
              type="text"
              placeholder="Address line 1"
              value={detailsForm.addressLine1}
              onChange={(e) => setDetailsForm({ ...detailsForm, addressLine1: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
            />
            <input
              type="text"
              placeholder="Address line 2 (optional)"
              value={detailsForm.addressLine2}
              onChange={(e) => setDetailsForm({ ...detailsForm, addressLine2: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="City / Town"
                value={detailsForm.city}
                onChange={(e) => setDetailsForm({ ...detailsForm, city: e.target.value })}
                className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
              />
              <input
                type="text"
                placeholder="Postcode"
                value={detailsForm.postcode}
                onChange={(e) => setDetailsForm({ ...detailsForm, postcode: e.target.value })}
                className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
              />
            </div>
            <input
              type="tel"
              inputMode="tel"
              placeholder="Mobile number"
              value={detailsForm.phone}
              onChange={(e) => setDetailsForm({ ...detailsForm, phone: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary"
            />
            <textarea
              placeholder='Delivery instructions - e.g. "second gate on the left", "park on the lane"'
              value={detailsForm.deliveryInstructions}
              onChange={(e) => setDetailsForm({ ...detailsForm, deliveryInstructions: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary resize-none"
            />
            {detailsForm.pinLat != null && detailsForm.pinLng != null ? (
              <div className="flex items-center gap-3">
                <MiniMapPreview
                  lat={detailsForm.pinLat}
                  lng={detailsForm.pinLng}
                  onClick={() => setShowMapPicker(true)}
                  size={80}
                />
                <p className="text-xs text-muted">Your door pin - tap the map to move it. If you&apos;ve moved house, drop the pin on the new place too.</p>
              </div>
            ) : (
              <p className="text-xs text-muted">No door pin saved yet - you&apos;ll set it the next time you order.</p>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={saveDetails}
                disabled={savingDetails}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
              >
                {savingDetails && <Loader2 size={14} className="animate-spin" />}
                {savingDetails ? "Saving..." : "Save Details"}
              </button>
            </div>
          </div>

        {showMapPicker && (
          <MapPicker
            lat={detailsForm.pinLat}
            lng={detailsForm.pinLng}
            onLocationSelect={(lat, lng) => {
              setDetailsForm((prev) => ({ ...prev, pinLat: lat, pinLng: lng }));
              setShowMapPicker(false);
            }}
            onClose={() => setShowMapPicker(false)}
          />
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
              const hasAllRatings = order.items.every((item) => (orderSubmittedRatings[item.productId]?.stars ?? 0) > 0);
              const draftHasAnyStars = Object.values(draft).some((r) => r.stars > 0);
              const canModify = modifiableOrders.has(order.id);

              return (
                <div key={order.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/5 px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-primary">Order #{order.orderNumber}</p>
                      <p className="text-xs text-muted">Placed on {order.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canModify && (
                        <button
                          onClick={() => handleAddToOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary/30"
                        >
                          <Plus size={12} />
                          Add to Order
                        </button>
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

                  {/* Order items grouped by supplier */}
                  <div className="px-6 py-4">
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
