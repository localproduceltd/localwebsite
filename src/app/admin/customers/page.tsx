"use client";

import { useState, useEffect } from "react";
import { Package, Search, Mail, MapPin, Calendar, CheckCircle, X, Loader2, CreditCard, AlertCircle, Phone, Star, StickyNote, Info } from "lucide-react";
import { type CustomerSummary, type CustomerSegment, getAllCustomers, setCustomerOutstandingBox, updateCustomerAdminNotes } from "@/lib/data";

// Badge styling per segment
const segmentConfig: Record<CustomerSegment, { label: string; classes: string }> = {
  new: { label: "New", classes: "bg-sky-100 text-sky-700" },
  current: { label: "Current", classes: "bg-green-100 text-green-700" },
  lapsing: { label: "Lapsing", classes: "bg-amber-100 text-amber-700" },
  churned: { label: "Churned", classes: "bg-red-100 text-red-700" },
};

type Filter = "all" | CustomerSegment | "top" | "box";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function formatFrequency(avgGapDays: number | null): string {
  if (avgGapDays == null) return "—";
  if (avgGapDays <= 9) return "~weekly";
  if (avgGapDays <= 17) return "~fortnightly";
  return `~every ${Math.round(avgGapDays / 7)} wks`;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Refund modal state
  const [refundModal, setRefundModal] = useState<{ open: boolean; customer: CustomerSummary | null }>({ open: false, customer: null });
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);

  // Admin-notes modal state
  const [notesModal, setNotesModal] = useState<{ open: boolean; customer: CustomerSummary | null }>({ open: false, customer: null });
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    getAllCustomers()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openRefundModal = (customer: CustomerSummary) => {
    setRefundModal({ open: true, customer });
    setRefundError(null);
    setRefundSuccess(false);
  };

  const closeRefundModal = () => {
    setRefundModal({ open: false, customer: null });
    setRefundError(null);
    setRefundSuccess(false);
  };

  const handleMarkReturnedWithRefund = async () => {
    if (!refundModal.customer) return;
    setRefunding(true);
    setRefundError(null);

    try {
      const response = await fetch("/api/refund-box-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId: refundModal.customer.clerkUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process refund");
      }

      setRefundSuccess(true);
      setCustomers((prev) =>
        prev.map((c) =>
          c.clerkUserId === refundModal.customer!.clerkUserId ? { ...c, hasOutstandingBox: false } : c
        )
      );

      setTimeout(() => {
        closeRefundModal();
      }, 1500);
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : "Failed to process refund");
    } finally {
      setRefunding(false);
    }
  };

  const handleMarkReturnedNoRefund = async () => {
    if (!refundModal.customer) return;
    setRefunding(true);

    try {
      await setCustomerOutstandingBox(refundModal.customer.clerkUserId, false);
      setCustomers((prev) =>
        prev.map((c) =>
          c.clerkUserId === refundModal.customer!.clerkUserId ? { ...c, hasOutstandingBox: false } : c
        )
      );
      closeRefundModal();
    } catch (error) {
      setRefundError("Failed to update box status");
    } finally {
      setRefunding(false);
    }
  };

  // Manual "they've got one of our boxes" - the mirror of Mark Returned, for
  // when a box goes out without the driver flow recording it.
  const handleGotABox = async (customer: CustomerSummary) => {
    try {
      await setCustomerOutstandingBox(customer.clerkUserId, true);
      setCustomers((prev) =>
        prev.map((c) =>
          c.clerkUserId === customer.clerkUserId ? { ...c, hasOutstandingBox: true } : c
        )
      );
    } catch (error) {
      console.error("Failed to set box status:", error);
      alert("Failed to update box status - try again.");
    }
  };

  const openNotesModal = (customer: CustomerSummary) => {
    setNotesModal({ open: true, customer });
    setNotesDraft(customer.adminNotes ?? "");
  };

  const saveNotes = async () => {
    if (!notesModal.customer) return;
    setSavingNotes(true);
    try {
      const trimmed = notesDraft.trim() || null;
      await updateCustomerAdminNotes(notesModal.customer.clerkUserId, trimmed);
      setCustomers((prev) =>
        prev.map((c) =>
          c.clerkUserId === notesModal.customer!.clerkUserId ? { ...c, adminNotes: trimmed } : c
        )
      );
      setNotesModal({ open: false, customer: null });
    } catch (error) {
      console.error("Failed to save notes:", error);
      alert("Failed to save notes - try again.");
    } finally {
      setSavingNotes(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.postcode?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q);

    const matchesFilter =
      filter === "all" ||
      (filter === "top" && c.isTopCustomer) ||
      (filter === "box" && c.hasOutstandingBox) ||
      c.segment === filter;

    return matchesSearch && matchesFilter;
  });

  const counts = {
    total: customers.length,
    current: customers.filter((c) => c.segment === "current" || c.segment === "new").length,
    churned: customers.filter((c) => c.segment === "churned").length,
    boxes: customers.filter((c) => c.hasOutstandingBox).length,
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const segmentBadge = (c: CustomerSummary) => (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${segmentConfig[c.segment].classes}`}>
        {segmentConfig[c.segment].label}
      </span>
      {c.isTopCustomer && <Star size={14} className="fill-accent text-accent" aria-label="Top customer" />}
    </span>
  );

  const boxBadge = (c: CustomerSummary) =>
    c.hasOutstandingBox ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
        <Package size={12} />
        Has box
      </span>
    ) : c.boxDepositOrders > 0 ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
        <CheckCircle size={12} />
        Returned
      </span>
    ) : (
      <span className="text-xs text-muted">—</span>
    );

  const actionButtons = (c: CustomerSummary) => (
    <div className="flex flex-wrap items-center gap-2">
      {c.hasOutstandingBox ? (
        <button
          onClick={() => openRefundModal(c)}
          className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-200"
        >
          <CheckCircle size={12} />
          Mark Returned
        </button>
      ) : (
        <>
          {c.boxDepositOrders > 0 && (
            // Box already back (e.g. collected at the door) but the £10 deposit
            // may still be owed - keep the refund reachable.
            <button
              onClick={() => openRefundModal(c)}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/15 px-2 py-1 text-xs font-semibold text-muted transition hover:bg-primary/5"
            >
              <CreditCard size={12} />
              Refund deposit
            </button>
          )}
          <button
            onClick={() => handleGotABox(c)}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-200"
          >
            <Package size={12} />
            Got a box
          </button>
        </>
      )}
      <button
        onClick={() => openNotesModal(c)}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
          c.adminNotes
            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            : "border border-primary/15 text-muted hover:bg-primary/5"
        }`}
      >
        <StickyNote size={12} />
        {c.adminNotes ? "Notes" : "Add note"}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Customers</h1>
        <p className="text-sm text-muted">Who they are, how to reach them, how they&apos;re ordering</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Total Customers</p>
          <p className="text-2xl font-bold text-primary">{counts.total}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Current (incl. new)</p>
          <p className="text-2xl font-bold text-green-600">{counts.current}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Churned</p>
          <p className="text-2xl font-bold text-red-600">{counts.churned}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Outstanding Boxes</p>
          <p className="text-2xl font-bold text-amber-600">{counts.boxes}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by name, email or postcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-primary/20 bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-secondary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "All"],
            ["new", "New"],
            ["current", "Current"],
            ["lapsing", "Lapsing"],
            ["churned", "Churned"],
            ["top", "⭐ Top"],
            ["box", "Has Box"],
          ] as Array<[Filter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                filter === key
                  ? "bg-primary text-white"
                  : "bg-surface text-muted hover:bg-primary/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List - mobile card view (below sm) */}
      <div className="sm:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="rounded-xl border border-primary/10 bg-surface p-4 text-center text-sm text-muted shadow-sm">
            No customers found
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.clerkUserId}
              className="rounded-xl border border-primary/10 bg-surface p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-primary">{customer.name || customer.email || "Unknown"}</span>
                {segmentBadge(customer)}
              </div>

              <div className="mt-2 space-y-1 text-sm">
                {customer.name && (
                  <p className="flex items-center gap-2 text-muted break-all">
                    <Mail size={12} className="flex-shrink-0" /> {customer.email || "—"}
                  </p>
                )}
                <p className="flex items-center gap-2 text-muted">
                  <Phone size={12} className="flex-shrink-0" />
                  {customer.phone ? <a href={`tel:${customer.phone}`} className="text-primary">{customer.phone}</a> : "—"}
                </p>
                <p className="flex items-center gap-2 text-muted">
                  <MapPin size={12} className="flex-shrink-0" />
                  <span className="text-primary">
                    {customer.addressLine1 ? `${customer.addressLine1}, ${customer.postcode ?? ""}` : customer.postcode || "—"}
                  </span>
                </p>
                {customer.defaultSafePlace && (
                  <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">
                    <Package size={12} className="flex-shrink-0 mt-0.5" />
                    <span>Safe place - {customer.defaultSafePlace}</span>
                  </p>
                )}
                {customer.deliveryInstructions && (
                  <p className="flex items-start gap-2 text-xs text-sky-800 bg-sky-50 rounded px-2 py-1">
                    <Info size={12} className="flex-shrink-0 mt-0.5" /> {customer.deliveryInstructions}
                  </p>
                )}
                {customer.adminNotes && (
                  <p className="flex items-start gap-2 text-xs text-yellow-800 bg-yellow-50 rounded px-2 py-1">
                    <StickyNote size={12} className="flex-shrink-0 mt-0.5" /> {customer.adminNotes}
                  </p>
                )}
                <p className="text-muted">
                  Orders: <span className="font-semibold text-primary">{customer.totalOrders}</span>
                  {" "}({formatFrequency(customer.avgGapDays)})
                </p>
                <p className="text-muted">
                  First: <span className="text-primary">{formatDate(customer.firstOrderDate)}</span>
                  {" · "}Last: <span className="text-primary">{formatDate(customer.lastOrderDate)}</span>
                </p>
                <p className="flex items-center gap-2 text-muted">Box: {boxBadge(customer)}</p>
              </div>

              <div className="mt-3">{actionButtons(customer)}</div>
            </div>
          ))
        )}
      </div>

      {/* Customer List - desktop table */}
      <div className="hidden sm:block rounded-xl bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary/10 bg-primary/5">
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Address</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Orders</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">First / Last</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Box</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.clerkUserId}
                    className="border-b border-primary/5 hover:bg-primary/5 align-top cursor-pointer"
                    onClick={() => setExpanded(expanded === customer.clerkUserId ? null : customer.clerkUserId)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-primary">{customer.name || "—"}</p>
                      <p className="text-xs text-muted break-all">{customer.email || "No email"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-sm text-primary hover:text-secondary"
                        >
                          <Phone size={12} />
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-sm text-primary">
                        {customer.addressLine1 || "—"}
                        {customer.addressLine1 && (customer.postcode || customer.city) ? (
                          <span className="text-muted text-xs block">
                            {[customer.city, customer.postcode].filter(Boolean).join(", ")}
                          </span>
                        ) : !customer.addressLine1 && customer.postcode ? (
                          <span className="text-muted text-xs block">{customer.postcode}</span>
                        ) : null}
                      </p>
                      {customer.defaultSafePlace && (
                        <p className={`mt-1 text-xs text-amber-800 ${expanded === customer.clerkUserId ? "" : "truncate"}`} title={customer.defaultSafePlace}>
                          📍 Safe place - {customer.defaultSafePlace}
                        </p>
                      )}
                      {customer.deliveryInstructions && (
                        <p className={`mt-1 text-xs text-sky-800 ${expanded === customer.clerkUserId ? "" : "truncate"}`} title={customer.deliveryInstructions}>
                          ℹ️ {customer.deliveryInstructions}
                        </p>
                      )}
                      {customer.adminNotes && (
                        <p className={`mt-1 text-xs text-yellow-800 ${expanded === customer.clerkUserId ? "" : "truncate"}`} title={customer.adminNotes}>
                          📌 {customer.adminNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm font-semibold text-primary">{customer.totalOrders}</p>
                      <p className="text-xs text-muted">{formatFrequency(customer.avgGapDays)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted">
                        <Calendar size={12} />
                        {formatDate(customer.firstOrderDate)}
                      </div>
                      <div className="text-xs text-primary mt-0.5">{formatDate(customer.lastOrderDate)}</div>
                    </td>
                    <td className="px-4 py-3 text-center">{segmentBadge(customer)}</td>
                    <td className="px-4 py-3 text-center">{boxBadge(customer)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {actionButtons(customer)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-muted">
        Showing {filteredCustomers.length} of {counts.total} customers · sorted A-Z
      </div>

      {/* Admin Notes Modal */}
      {notesModal.open && notesModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <StickyNote size={20} className="text-secondary" />
                <h2 className="text-lg font-bold text-primary">Notes</h2>
              </div>
              <button
                onClick={() => setNotesModal({ open: false, customer: null })}
                disabled={savingNotes}
                className="rounded p-1 text-muted hover:text-primary disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-primary mb-1">
              <strong>{notesModal.customer.name || notesModal.customer.email}</strong>
            </p>
            <p className="text-xs text-muted mb-3">
              Only you and the driver see this - it shows on the Driver Run stop card. Gate codes, dogs, "leave with no. 4", that kind of thing.
            </p>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              placeholder='e.g. "gate code 1234", "dog in garden - shut the gate"'
              className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none focus:border-secondary resize-none"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setNotesModal({ open: false, customer: null })}
                disabled={savingNotes}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
              >
                {savingNotes && <Loader2 size={14} className="animate-spin" />}
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundModal.open && refundModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package size={24} className="text-secondary" />
                <h2 className="text-lg font-bold text-primary">Box Returned</h2>
              </div>
              <button
                onClick={closeRefundModal}
                disabled={refunding}
                className="rounded p-1 text-muted hover:text-primary disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {refundSuccess ? (
              <div className="text-center py-4">
                <CheckCircle size={48} className="mx-auto text-green-600 mb-3" />
                <p className="text-lg font-semibold text-green-600">Refund Processed!</p>
                <p className="text-sm text-muted mt-1">£10 has been refunded to the customer</p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 rounded-lg bg-primary/5">
                  <p className="text-sm text-primary">
                    <strong>{refundModal.customer.name || refundModal.customer.email || "Customer"}</strong>
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {refundModal.customer.boxDepositOrders} order(s) with box deposit
                  </p>
                </div>

                <p className="text-sm text-muted mb-6">
                  The customer has returned their cool box. Would you like to refund the £10 deposit?
                </p>

                {refundError && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle size={16} />
                    {refundError}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={handleMarkReturnedWithRefund}
                    disabled={refunding}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {refunding ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <CreditCard size={18} />
                    )}
                    Refund £10 &amp; Mark Returned
                  </button>
                  <button
                    onClick={handleMarkReturnedNoRefund}
                    disabled={refunding}
                    className="w-full rounded-lg border border-primary/20 bg-surface py-3 font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-50"
                  >
                    Mark Returned (No Refund)
                  </button>
                  <button
                    onClick={closeRefundModal}
                    disabled={refunding}
                    className="w-full rounded-lg py-2 text-sm text-muted transition hover:text-primary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
