"use client";

import { useState, useEffect } from "react";
import { getFeedback } from "@/lib/data";
import { Loader2, MessageCircleHeart, Star, Package } from "lucide-react";

interface FeedbackItem {
  id: string;
  name: string | null;
  message: string;
  created_at: string;
  source: string;
  orderNumber: number | null;
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "carrie" | "order_review">("all");

  useEffect(() => {
    (async () => {
      const data = await getFeedback();
      setFeedback(data);
      setLoading(false);
    })();
  }, []);

  const carrieFeedback = feedback.filter((f) => f.source === "carrie");
  const orderReviews = feedback.filter((f) => f.source === "order_review");
  const filtered = filter === "all" ? feedback : filter === "carrie" ? carrieFeedback : orderReviews;

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
            {carrieFeedback.length} from Carrie 🥕 · {orderReviews.length} order review{orderReviews.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            filter === "all" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          All ({feedback.length})
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
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-primary">No feedback yet</p>
          <p className="mt-1 text-sm text-muted">
            {filter === "carrie" ? "Feedback submitted via Carrie the Carrot will appear here" :
             filter === "order_review" ? "Customer order reviews will appear here" :
             "Feedback and reviews will appear here"}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {item.source === "order_review" ? (
                    <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
                      <Star size={12} />
                      Order Review
                      {item.orderNumber && <span className="text-muted">#{item.orderNumber}</span>}
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      🥕 Carrie
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {new Date(item.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="mt-2 font-semibold text-primary">{item.name || "Anonymous"}</p>
              <p className="mt-2 text-sm text-primary/80 leading-relaxed">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
