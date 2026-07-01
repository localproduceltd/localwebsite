"use client";

import { useState, useEffect } from "react";
import { getSavedBaskets, deleteSavedBasket, type SavedBasketWithProducts } from "@/lib/data";
import { ShoppingCart, Trash2, Mail, Clock, CheckCircle, X, Send, Loader2 } from "lucide-react";

export default function SavedBasketsPage() {
  const [baskets, setBaskets] = useState<SavedBasketWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "converted">("pending");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getSavedBaskets()
      .then(setBaskets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved basket?")) return;
    try {
      await deleteSavedBasket(id);
      setBaskets((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Failed to delete basket:", error);
      alert("Failed to delete basket");
    }
  };

  const pendingWithEmail = baskets.filter((b) => !b.convertedAt && b.customerEmail);

  const handleSendReminders = async () => {
    if (
      !confirm(
        `Send a checkout reminder to all ${pendingWithEmail.length} pending basket${
          pendingWithEmail.length === 1 ? "" : "s"
        }?`
      )
    )
      return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/saved-baskets/remind", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to send");
      alert(data.message);
    } catch (error) {
      console.error("Failed to send reminders:", error);
      alert(error instanceof Error ? error.message : "Failed to send reminders");
    } finally {
      setSending(false);
    }
  };

  const filteredBaskets = baskets.filter((b) => {
    if (filter === "pending") return !b.convertedAt;
    if (filter === "converted") return !!b.convertedAt;
    return true;
  });

  const pendingCount = baskets.filter((b) => !b.convertedAt).length;
  const convertedCount = baskets.filter((b) => !!b.convertedAt).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-muted">Loading saved baskets...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Saved Baskets</h1>
        <p className="text-sm text-muted mt-1">
          Customers who saved their basket but haven&apos;t checked out yet
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === "pending"
              ? "bg-amber-100 text-amber-800"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("converted")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === "converted"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Converted ({convertedCount})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === "all"
              ? "bg-secondary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({baskets.length})
        </button>
      </div>

      {filteredBaskets.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-xl">
          <ShoppingCart size={48} className="mx-auto text-muted/30 mb-4" />
          <p className="text-muted">
            {filter === "pending"
              ? "No pending saved baskets"
              : filter === "converted"
              ? "No converted baskets yet"
              : "No saved baskets"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBaskets.map((basket) => (
            <div
              key={basket.id}
              className={`bg-surface rounded-xl p-4 shadow-sm border ${
                basket.convertedAt ? "border-green-200" : "border-amber-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Customer info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {basket.convertedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        <CheckCircle size={12} />
                        Converted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                    {basket.customerEmail && (
                      <a
                        href={`mailto:${basket.customerEmail}`}
                        className="inline-flex items-center gap-1 text-sm text-secondary hover:underline"
                      >
                        <Mail size={14} />
                        {basket.customerEmail}
                      </a>
                    )}
                  </div>

                  {/* Products */}
                  <div className="mt-3 space-y-1">
                    {basket.products.map((product, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted">{product.quantity}×</span>
                        <span className="text-primary min-w-0 flex-1">{product.productName}</span>
                        <span className="text-muted">({product.supplierName})</span>
                        <span className="text-secondary font-medium">
                          £{(product.price * product.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total and timestamps */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-primary">
                      Total: £{basket.total.toFixed(2)}
                    </span>
                    <span className="text-muted">
                      Updated: {formatDate(basket.updatedAt)}
                    </span>
                    {basket.convertedAt && (
                      <span className="text-green-600">
                        Converted: {formatDate(basket.convertedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(basket.id)}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send reminders + email list for pending baskets */}
      {filter === "pending" && pendingCount > 0 && (
        <div className="mt-8 space-y-4">
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
            <h3 className="font-semibold text-primary mb-1">
              💚 Send checkout reminders
            </h3>
            <p className="text-sm text-muted mb-3">
              Emails everyone with a pending basket a &quot;your basket is waiting&quot; nudge with their
              items and a checkout link. Best sent on cut-off day (the email says &quot;7pm tonight&quot;).
            </p>
            <button
              onClick={handleSendReminders}
              disabled={sending || pendingWithEmail.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-secondary transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send size={16} /> Send reminder to {pendingWithEmail.length} pending
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">
            📧 Or copy the addresses to send manually
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            Copy these to send checkout reminders:
          </p>
          <div className="bg-white rounded-lg p-3 text-sm font-mono break-all">
            {filteredBaskets
              .filter((b) => b.customerEmail)
              .map((b) => b.customerEmail)
              .join(", ")}
          </div>
          <button
            onClick={() => {
              const emails = filteredBaskets
                .filter((b) => b.customerEmail)
                .map((b) => b.customerEmail)
                .join(", ");
              navigator.clipboard.writeText(emails);
              alert("Emails copied to clipboard!");
            }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Copy All Emails
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
