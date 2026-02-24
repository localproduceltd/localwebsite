"use client";

import { useState, useEffect } from "react";
import { getFeedback } from "@/lib/data";
import { Loader2, MessageCircleHeart } from "lucide-react";

interface FeedbackItem {
  id: string;
  name: string | null;
  message: string;
  created_at: string;
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getFeedback();
      setFeedback(data);
      setLoading(false);
    })();
  }, []);

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
          <h1 className="text-2xl font-bold text-primary">Feedback</h1>
          <p className="text-sm text-muted">{feedback.length} message{feedback.length !== 1 ? "s" : ""} from Carrie 🥕</p>
        </div>
      </div>

      {feedback.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-primary">No feedback yet</p>
          <p className="mt-1 text-sm text-muted">Feedback submitted via Carrie the Carrot will appear here</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {feedback.map((item) => (
            <div key={item.id} className="rounded-xl bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-primary">{item.name || "Anonymous"}</p>
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
              </div>
              <p className="mt-3 text-sm text-primary/80 leading-relaxed">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
