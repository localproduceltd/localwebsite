"use client";

import { useState, useEffect } from "react";
import { Package, Search, Mail, MapPin, ShoppingBag, Calendar, CheckCircle, X, Loader2, CreditCard, AlertCircle } from "lucide-react";
import { type CustomerSummary, getAllCustomers, setCustomerOutstandingBox } from "@/lib/data";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBox, setFilterBox] = useState<"all" | "outstanding" | "none">("all");
  
  // Refund modal state
  const [refundModal, setRefundModal] = useState<{ open: boolean; customer: CustomerSummary | null }>({ open: false, customer: null });
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);

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

      // Close modal after short delay
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

  const handleMarkReturned = (clerkUserId: string) => {
    const customer = customers.find(c => c.clerkUserId === clerkUserId);
    if (customer) {
      openRefundModal(customer);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      !search ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.postcode?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter =
      filterBox === "all" ||
      (filterBox === "outstanding" && c.hasOutstandingBox) ||
      (filterBox === "none" && !c.hasOutstandingBox);
    
    return matchesSearch && matchesFilter;
  });

  const totalCustomers = customers.length;
  const customersWithBox = customers.filter((c) => c.hasOutstandingBox).length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Customers</h1>
        <p className="text-sm text-muted">View and manage customer accounts</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Total Customers</p>
          <p className="text-2xl font-bold text-primary">{totalCustomers}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Outstanding Boxes</p>
          <p className="text-2xl font-bold text-amber-600">{customersWithBox}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">£{totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Avg Order Value</p>
          <p className="text-2xl font-bold text-primary">
            £{(totalRevenue / Math.max(customers.reduce((sum, c) => sum + c.totalOrders, 0), 1)).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by email or postcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-primary/20 bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-secondary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterBox("all")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              filterBox === "all"
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:bg-primary/10"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterBox("outstanding")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              filterBox === "outstanding"
                ? "bg-amber-600 text-white"
                : "bg-surface text-muted hover:bg-amber-100"
            }`}
          >
            <Package size={14} className="mr-1 inline" />
            Outstanding Box
          </button>
          <button
            onClick={() => setFilterBox("none")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              filterBox === "none"
                ? "bg-green-600 text-white"
                : "bg-surface text-muted hover:bg-green-100"
            }`}
          >
            No Box
          </button>
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
              <div className="flex items-center gap-2">
                <Mail size={14} className="flex-shrink-0 text-muted" />
                <span className="break-all font-bold text-primary">
                  {customer.email || "No email"}
                </span>
              </div>

              <div className="mt-2 space-y-1 text-sm">
                <p className="text-muted">
                  Postcode: <span className="text-primary">{customer.postcode || "—"}</span>
                </p>
                <p className="text-muted">
                  Orders: <span className="font-semibold text-primary">{customer.totalOrders}</span>
                </p>
                <p className="text-muted">
                  Total spent:{" "}
                  <span className="font-semibold text-green-600">£{customer.totalSpent.toFixed(2)}</span>
                </p>
                <p className="text-muted">
                  Last order:{" "}
                  <span className="text-primary">
                    {customer.lastOrderDate
                      ? new Date(customer.lastOrderDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })
                      : "—"}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-muted">
                  Box status:{" "}
                  {customer.hasOutstandingBox ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                      <Package size={12} />
                      Outstanding
                    </span>
                  ) : customer.boxDepositOrders > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle size={12} />
                      Returned
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </p>
              </div>

              {customer.hasOutstandingBox && (
                <button
                  onClick={() => handleMarkReturned(customer.clerkUserId)}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-green-100 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-200"
                >
                  <CheckCircle size={14} />
                  Mark Returned
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Customer List */}
      <div className="hidden sm:block rounded-xl bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary/10 bg-primary/5">
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Postcode</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-primary">Total Spent</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Last Order</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Box Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.clerkUserId} className="border-b border-primary/5 hover:bg-primary/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-muted" />
                        <span className="text-sm font-medium text-primary">
                          {customer.email || "No email"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-muted">
                        <MapPin size={12} />
                        {customer.postcode || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ShoppingBag size={12} className="text-muted" />
                        <span className="text-sm font-semibold text-primary">{customer.totalOrders}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-green-600">
                        £{customer.totalSpent.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted">
                        <Calendar size={12} />
                        {customer.lastOrderDate
                          ? new Date(customer.lastOrderDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "2-digit",
                            })
                          : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {customer.hasOutstandingBox ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          <Package size={12} />
                          Outstanding
                        </span>
                      ) : customer.boxDepositOrders > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle size={12} />
                          Returned
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {customer.hasOutstandingBox && (
                        <button
                          onClick={() => handleMarkReturned(customer.clerkUserId)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          <CheckCircle size={12} />
                          Mark Returned
                        </button>
                      )}
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
        Showing {filteredCustomers.length} of {totalCustomers} customers
      </div>

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
                    <strong>{refundModal.customer.email || "Customer"}</strong>
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
