"use client";

import { useState, useEffect, useMemo } from "react";
import { getFeedback, getAllProductReviewsForAdmin, setReviewFeatured, type AdminProductReview } from "@/lib/data";
import { Loader2, MessageCircleHeart, Star, Package, MapPin, Search, Pin } from "lucide-react";

interface FeedbackItem {
  id: string;
  name: string | null;
  message: string;
  created_at: string;
  source: string;
  orderNumber: number | null;
  postcode: string | null;
  pageUrl: string | null;
  email: string | null;
  featured: boolean;
}

type UnifiedItem = 
  | { kind: "carrie" | "order_review" | "expansion"; data: FeedbackItem }
  | { kind: "product_review"; data: AdminProductReview };

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [productReviews, setProductReviews] = useState<AdminProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "carrie" | "order_review" | "expansion" | "product_review" | "pinned">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      const [feedbackData, reviewsData] = await Promise.all([
        getFeedback(),
        getAllProductReviewsForAdmin(),
      ]);
      setFeedback(feedbackData);
      setProductReviews(reviewsData);
      setLoading(false);
    })();
  }, []);

  const carrieFeedback = feedback.filter((f) => f.source === "carrie");
  const orderReviews = feedback.filter((f) => f.source === "order_review");
  const expansionRequests = feedback.filter((f) => f.source === "expansion");

  // Merge into unified list
  const allItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [
      ...feedback.map((f) => ({ kind: f.source as "carrie" | "order_review" | "expansion", data: f })),
      ...productReviews.map((r) => ({ kind: "product_review" as const, data: r })),
    ];
    // Sort by date descending
    return items.sort((a, b) => {
      const dateA = a.kind === "product_review" ? a.data.createdAt : a.data.created_at;
      const dateB = b.kind === "product_review" ? b.data.createdAt : b.data.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [feedback, productReviews]);

  // Count pinned items
  const pinnedCount = useMemo(() => {
    return allItems.filter((item) => {
      if (item.kind === "product_review") return item.data.featured;
      if (item.kind === "order_review") return item.data.featured;
      return false;
    }).length;
  }, [allItems]);

  // Filter by type
  const filteredByType = useMemo(() => {
    if (filter === "all") return allItems;
    if (filter === "pinned") {
      return allItems.filter((item) => {
        if (item.kind === "product_review") return item.data.featured;
        if (item.kind === "order_review") return item.data.featured;
        return false;
      });
    }
    return allItems.filter((item) => item.kind === filter);
  }, [allItems, filter]);

  const handleTogglePin = async (kind: "product_review" | "order_review", id: string, currentFeatured: boolean) => {
    const newFeatured = !currentFeatured;
    // Optimistic update
    if (kind === "product_review") {
      setProductReviews((prev) => prev.map((r) => r.id === id ? { ...r, featured: newFeatured } : r));
    } else {
      setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, featured: newFeatured } : f));
    }
    try {
      await setReviewFeatured(kind, id, newFeatured);
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      // Revert on error
      if (kind === "product_review") {
        setProductReviews((prev) => prev.map((r) => r.id === id ? { ...r, featured: currentFeatured } : r));
      } else {
        setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, featured: currentFeatured } : f));
      }
    }
  };

  // Filter by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return filteredByType;
    const q = searchQuery.toLowerCase();
    return filteredByType.filter((item) => {
      if (item.kind === "product_review") {
        return (
          item.data.productName.toLowerCase().includes(q) ||
          item.data.supplierName.toLowerCase().includes(q) ||
          (item.data.comment?.toLowerCase().includes(q) ?? false)
        );
      } else {
        return (
          item.data.message.toLowerCase().includes(q) ||
          (item.data.name?.toLowerCase().includes(q) ?? false) ||
          (item.data.email?.toLowerCase().includes(q) ?? false)
        );
      }
    });
  }, [filteredByType, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MessageCircleHeart size={24} className="text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-primary">Feedback & Reviews</h1>
          <p className="text-sm text-muted">
            {carrieFeedback.length} from Carrie 🥕 · {orderReviews.length} order review{orderReviews.length !== 1 ? "s" : ""} · {productReviews.length} product review{productReviews.length !== 1 ? "s" : ""} · {expansionRequests.length} expansion{expansionRequests.length !== 1 ? "s" : ""} · {pinnedCount} pinned to homepage
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search feedback, reviews, products, suppliers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-secondary"
        />
      </div>

      {/* Filter tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "all" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          All ({allItems.length})
        </button>
        <button
          onClick={() => setFilter("pinned")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "pinned" ? "bg-pink-500 text-white" : "bg-pink-100 text-pink-700 hover:bg-pink-200"
          }`}
        >
          📌 Pinned ({pinnedCount})
        </button>
        <button
          onClick={() => setFilter("carrie")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "carrie" ? "bg-accent text-white" : "bg-accent/10 text-accent hover:bg-accent/20"
          }`}
        >
          🥕 Carrie ({carrieFeedback.length})
        </button>
        <button
          onClick={() => setFilter("order_review")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "order_review" ? "bg-secondary text-white" : "bg-secondary/10 text-secondary hover:bg-secondary/20"
          }`}
        >
          Order Reviews ({orderReviews.length})
        </button>
        <button
          onClick={() => setFilter("product_review")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "product_review" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
        >
          ⭐ Product Reviews ({productReviews.length})
        </button>
        <button
          onClick={() => setFilter("expansion")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "expansion" ? "bg-green-600 text-white" : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          📍 Expansions ({expansionRequests.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-primary">No feedback yet</p>
          <p className="mt-1 text-sm text-muted">
            {filter === "pinned" ? "No reviews pinned to homepage yet. Pin product reviews or order reviews to feature them." :
             filter === "carrie" ? "Feedback submitted via Carrie the Carrot will appear here" :
             filter === "order_review" ? "Customer order reviews will appear here" :
             filter === "product_review" ? "Product ratings and reviews will appear here" :
             filter === "expansion" ? "Expansion requests from customers outside your delivery zones will appear here" :
             "Feedback and reviews will appear here"}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((item) => {
            if (item.kind === "product_review") {
              const review = item.data;
              return (
                <div key={review.id} className="rounded-xl bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <Package size={12} />
                        Product Review
                      </span>
                      <span className="text-xs text-muted">{review.supplierName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePin("product_review", review.id, review.featured)}
                        title={review.featured ? "Pinned to homepage" : "Pin to homepage"}
                        className={`rounded p-2 transition ${review.featured ? "text-accent" : "text-muted hover:text-accent"}`}
                      >
                        <Pin size={14} className={review.featured ? "fill-accent" : ""} />
                      </button>
                      <p className="text-xs text-muted">
                        {new Date(review.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 font-semibold text-primary">{review.productName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {review.stars !== null ? (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={14} className={(review.stars ?? 0) >= s ? "fill-accent text-accent" : "text-primary/15"} />
                        ))}
                      </div>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Comment only</span>
                    )}
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm text-primary/80 leading-relaxed italic">"{review.comment}"</p>
                  )}
                </div>
              );
            } else {
              const fb = item.data;
              return (
                <div key={fb.id} className="rounded-xl bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {item.kind === "order_review" ? (
                        <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
                          <Star size={12} />
                          Order Review
                          {fb.orderNumber && <span className="text-muted">#{fb.orderNumber}</span>}
                        </span>
                      ) : item.kind === "expansion" ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <MapPin size={12} />
                          Expansion Request
                          {fb.postcode && <span className="font-bold ml-1">{fb.postcode}</span>}
                        </span>
                      ) : (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          🥕 Carrie
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.kind === "order_review" && (
                        <button
                          onClick={() => handleTogglePin("order_review", fb.id, fb.featured)}
                          title={fb.featured ? "Pinned to homepage" : "Pin to homepage"}
                          className={`rounded p-2 transition ${fb.featured ? "text-accent" : "text-muted hover:text-accent"}`}
                        >
                          <Pin size={14} className={fb.featured ? "fill-accent" : ""} />
                        </button>
                      )}
                      <p className="text-xs text-muted">
                        {new Date(fb.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 font-semibold text-primary">
                    {fb.name || "Anonymous"}
                    {fb.email && (
                      <a href={`mailto:${fb.email}`} className="ml-2 text-xs font-normal text-secondary hover:underline">{fb.email}</a>
                    )}
                  </p>
                  <p className="mt-2 text-sm text-primary/80 leading-relaxed">{fb.message}</p>
                  {item.kind === "carrie" && fb.pageUrl && (
                    <p className="mt-2 text-xs">
                      <span className="rounded bg-primary/5 px-1.5 py-0.5 font-mono text-muted">from: {fb.pageUrl}</span>
                    </p>
                  )}
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
