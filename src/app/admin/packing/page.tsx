"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  type Order,
  type OrderItemRefund,
  type SupplierProductFlag,
  type RefundReasonType,
  type RefundFaultHint,
  getOrders,
  getRefundsForDeliveryDay,
  getOrderItemCheckins,
  setOrderItemCheckin,
  getSupplierProductFlags,
} from "@/lib/data";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, PoundSterling } from "lucide-react";
import { ChilledTag } from "@/components/ChilledTag";

// ─── The bench ───────────────────────────────────────────────────────────────
// Luke's screen. One supplier's crate at a time, split into customer boxes.
//
// There is no separate goods-in step: packing *is* the count. Every line ends
// up in one of three states - not touched, ticked (in the box), or refunded
// (confirmed short, customer already paid back). A supplier is done when
// nothing is left untouched. Nothing here is inferred, so nothing here can
// argue with itself.
//
// No prices anywhere. Luke refunds units; the API prices them off the order
// line. And he never decides who pays - that's Josie's call on Stock.

const REASONS: Array<{ type: RefundReasonType; label: string; hint: string; note: string }> = [
  {
    type: "didnt_arrive",
    label: "Didn't turn up",
    hint: "Short in the crate, or never delivered",
    note: "Sorry - this didn't arrive from the farm this week, so we've refunded you for it.",
  },
  {
    type: "quality",
    label: "Not good enough to send",
    hint: "Past its best, mouldy, bruised",
    note: "Sorry - this wasn't up to standard when we packed your box, so we've refunded you rather than send it.",
  },
  {
    type: "damaged",
    label: "Damaged",
    hint: "Broken, leaking, crushed in transit",
    note: "Sorry - this arrived damaged, so we've refunded you rather than put it in your box.",
  },
  {
    type: "other",
    label: "Something else",
    hint: "Anything that doesn't fit above",
    note: "Sorry - we couldn't include this in your box this week, so we've refunded you for it.",
  },
];

const FAULT_OPTIONS: Array<{ value: RefundFaultHint; label: string }> = [
  { value: "supplier", label: "The farm's" },
  { value: "local", label: "Ours" },
  { value: "unsure", label: "Not sure" },
];

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// "1st", "2nd", "3rd", "11th"...
function ordinal(n: number) {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function formatItemLine(name: string, unit: string, qty: number) {
  return unit ? `${name} - ${unit} × ${qty}` : `${name} × ${qty}`;
}

interface BenchLine {
  orderId: string;
  orderNumber: number;
  boxNumber: number | null;
  customerName: string | null;
  // Which order this is for that customer, counting this one. 1 = first ever.
  orderSeq: number;
  productName: string;
  unit: string;
  ordered: number;
  refunded: number;
  remaining: number;
  refrigerated: boolean;
}

interface BenchSupplier {
  supplierId: string;
  supplierName: string;
  // Crate totals - what should be sitting there, across all boxes.
  products: Array<{ productName: string; unit: string; total: number; refrigerated: boolean }>;
  boxes: Array<{
    orderId: string;
    orderNumber: number;
    boxNumber: number | null;
    customerName: string | null;
    orderSeq: number;
    lines: BenchLine[];
  }>;
}

interface MissingModalState {
  line: BenchLine;
  supplierId: string;
  supplierName: string;
  quantity: number;
  reasonType: RefundReasonType;
  customerNote: string;
  faultHint: RefundFaultHint;
  // One key per opened modal, so a double-submit of the same click can't
  // reach Stripe twice.
  idempotencyKey: string;
}

// A customer's order count, shown wherever Luke sees a box. First orders are
// loud on purpose - they're the ones to pack best and to short last.
function OrderCount({ seq, className = "" }: { seq: number; className?: string }) {
  if (seq === 1) {
    return (
      <span className={`rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-white ${className}`}>
        1st order
      </span>
    );
  }
  return (
    <span className={`rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-muted ${className}`}>
      {ordinal(seq)}
    </span>
  );
}

export default function PackingBenchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [day, setDay] = useState<string>("");
  const [checkins, setCheckins] = useState<Set<string>>(new Set());
  const [refunds, setRefunds] = useState<OrderItemRefund[]>([]);
  const [flags, setFlags] = useState<SupplierProductFlag[]>([]);
  const [refrigerated, setRefrigerated] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [modal, setModal] = useState<MissingModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [openSupplier, setOpenSupplier] = useState<string | null>(null);

  // ── Loading ────────────────────────────────────────────────────────────────
  // Only ever the day being packed. (The old Stock page reloaded all 18
  // delivery days after every refund, which is what made a refund look like it
  // had failed when it hadn't.)
  const loadDay = useCallback(async (deliveryDay: string) => {
    if (!deliveryDay) return;
    const [dayCheckins, dayRefunds, dayFlags] = await Promise.all([
      getOrderItemCheckins(deliveryDay),
      getRefundsForDeliveryDay(deliveryDay),
      getSupplierProductFlags(deliveryDay),
    ]);
    setCheckins(new Set(dayCheckins.map(c => `${c.orderId}|${c.supplierId}|${c.productName}`)));
    setRefunds(dayRefunds);
    setFlags(dayFlags.filter(f => !f.resolved));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const all = await getOrders();
        setOrders(all);

        // Default to the next delivery day that hasn't been yet - on a
        // Thursday that's tomorrow, which is what Luke is packing.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = [...new Set(all.map(o => o.deliveryDay).filter(Boolean))].sort();
        const upcoming = days.find(d => new Date(d + "T00:00:00") >= today);
        const chosen = upcoming ?? days[days.length - 1] ?? "";
        setDay(chosen);
        await loadDay(chosen);

        const productIds = [...new Set(all.flatMap(o => o.items.map(i => i.productId)))].filter(Boolean);
        if (productIds.length > 0) {
          const res = await fetch(`/api/products?ids=${productIds.join(",")}`);
          if (res.ok) {
            const products = await res.json();
            setRefrigerated(new Map(products.map((p: { id: string; refrigerated: boolean }) => [p.id, !!p.refrigerated])));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDay]);

  const changeDay = async (next: string) => {
    setDay(next);
    setReloading(true);
    try {
      await loadDay(next);
    } finally {
      setReloading(false);
    }
  };

  const deliveryDays = useMemo(
    () => [...new Set(orders.map(o => o.deliveryDay).filter(Boolean))].sort().reverse(),
    [orders]
  );

  const dayOrders = useMemo(
    () => orders.filter(o => o.deliveryDay === day && o.status !== "cancelled"),
    [orders, day]
  );

  // Which order this is for each customer, counting from their first ever.
  // Luke uses it to give first-timers the best of the crate - a poor first box
  // is the one we never get a second chance at. Counted across their whole
  // history, not just this week, and cancelled orders don't count. Keyed on
  // the Clerk id where there is one, email otherwise.
  const orderSequence = useMemo(() => {
    const byCustomer = new Map<string, Order[]>();
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      const key = order.userId || order.customerEmail?.toLowerCase() || `one-off-${order.id}`;
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key)!.push(order);
    }
    const seq = new Map<string, number>();
    for (const list of byCustomer.values()) {
      // order_number is a permanent global sequence, so it always sorts right.
      list.sort((a, b) => a.orderNumber - b.orderNumber);
      list.forEach((order, i) => seq.set(order.id, i + 1));
    }
    return seq;
  }, [orders]);

  // Every refunded unit, whatever the reason - what's left to refund on a line.
  const refundedQty = useCallback(
    (orderId: string, productName: string) =>
      refunds
        .filter(r => r.orderId === orderId && r.productName === productName)
        .reduce((sum, r) => sum + r.quantityRefunded, 0),
    [refunds]
  );

  const isTicked = useCallback(
    (orderId: string, supplierId: string, productName: string) =>
      checkins.has(`${orderId}|${supplierId}|${productName}`),
    [checkins]
  );

  const suppliers: BenchSupplier[] = useMemo(() => {
    const map = new Map<string, BenchSupplier>();
    for (const order of dayOrders) {
      for (const item of order.items) {
        const supplierId = item.supplierId || "unknown";
        const supplierName = item.supplierName || "Unknown supplier";
        if (!map.has(supplierId)) {
          map.set(supplierId, { supplierId, supplierName, products: [], boxes: [] });
        }
        const supplier = map.get(supplierId)!;
        const chilled = refrigerated.get(item.productId) ?? false;

        // Anything refunded is not going in the box, whatever the reason - a
        // punnet refunded for being squashed is as gone as one that never
        // arrived. (Before this, a quality or damage refund left the line
        // sitting on Luke's list asking to be packed.)
        const refunded = refundedQty(order.id, item.productName);
        const remaining = item.quantity - refunded;

        const product = supplier.products.find(p => p.productName === item.productName);
        if (product) {
          product.total += Math.max(0, remaining);
          product.refrigerated = product.refrigerated || chilled;
        } else {
          supplier.products.push({
            productName: item.productName,
            unit: item.unit,
            total: Math.max(0, remaining),
            refrigerated: chilled,
          });
        }

        const orderSeq = orderSequence.get(order.id) ?? 1;
        let box = supplier.boxes.find(b => b.orderId === order.id);
        if (!box) {
          box = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            boxNumber: order.boxNumber,
            customerName: order.customerName,
            orderSeq,
            lines: [],
          };
          supplier.boxes.push(box);
        }
        box.lines.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          boxNumber: order.boxNumber,
          customerName: order.customerName,
          orderSeq,
          productName: item.productName,
          unit: item.unit,
          ordered: item.quantity,
          refunded,
          remaining,
          refrigerated: chilled,
        });
      }
    }
    for (const supplier of map.values()) {
      supplier.products.sort((a, b) => a.productName.localeCompare(b.productName));
      supplier.boxes.sort((a, b) => (a.boxNumber ?? a.orderNumber) - (b.boxNumber ?? b.orderNumber));
    }
    return [...map.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [dayOrders, refrigerated, refundedQty, orderSequence]);

  // Done = every line either packed or refunded. No button to press.
  const supplierProgress = useCallback(
    (supplier: BenchSupplier) => {
      let done = 0;
      let total = 0;
      for (const box of supplier.boxes) {
        for (const line of box.lines) {
          total++;
          if (line.remaining <= 0 || isTicked(line.orderId, supplier.supplierId, line.productName)) done++;
        }
      }
      return { done, total, complete: total > 0 && done === total };
    },
    [isTicked]
  );

  const dayRefundTotal = refunds.reduce((sum, r) => sum + r.refundAmount, 0);
  const pendingCount = refunds.filter(r => r.supplierStatus === "pending").length;

  // Flags a supplier raised in their portal, or that Josie logged off an
  // email. These are known-short before Luke starts, so they get cleared
  // first rather than discovered box by box.
  const flagWork = useMemo(() => {
    return flags
      .map(flag => {
        const supplier = suppliers.find(s => s.supplierId === flag.supplierId);
        const lines: BenchLine[] = [];
        for (const box of supplier?.boxes ?? []) {
          for (const line of box.lines) {
            if (line.productName === flag.productName && line.remaining > 0) lines.push(line);
          }
        }
        return { flag, supplierName: supplier?.supplierName ?? "Unknown supplier", lines };
      })
      .filter(f => f.lines.length > 0);
  }, [flags, suppliers]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleTick = async (supplierId: string, line: BenchLine) => {
    const key = `${line.orderId}|${supplierId}|${line.productName}`;
    const next = !checkins.has(key);
    setCheckins(prev => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
    try {
      await setOrderItemCheckin(line.orderId, supplierId, line.productName, line.remaining, next);
    } catch {
      // Put the tick back where it was - the box is the source of truth, and
      // a tick that didn't save must not look like it did.
      setCheckins(prev => {
        const copy = new Set(prev);
        if (next) copy.delete(key);
        else copy.add(key);
        return copy;
      });
      setBanner("That tick didn't save - check the connection and try again.");
    }
  };

  const openMissing = (supplierId: string, supplierName: string, line: BenchLine) => {
    const reason = REASONS[0];
    setModal({
      line,
      supplierId,
      supplierName,
      quantity: line.remaining,
      reasonType: reason.type,
      customerNote: reason.note,
      faultHint: "supplier",
      idempotencyKey: crypto.randomUUID(),
    });
    setModalError(null);
  };

  const submitRefund = async () => {
    if (!modal) return;
    setSaving(true);
    setModalError(null);

    // Deliberately outside the try below: a refund that worked must never be
    // reported as one that failed. Everything after this point is bookkeeping.
    let ok = false;
    try {
      const response = await fetch("/api/refund-order-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: modal.line.orderId,
          productName: modal.line.productName,
          quantity: modal.quantity,
          reasonType: modal.reasonType,
          customerNote: modal.customerNote.trim() || null,
          supplierId: modal.supplierId === "unknown" ? null : modal.supplierId,
          faultHint: modal.faultHint,
          idempotencyKey: modal.idempotencyKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error || "Couldn't process that refund - try again.");
        return;
      }
      ok = true;
    } catch {
      setModalError("Couldn't reach the server. Check the connection, then refresh before trying again - the refund may already have gone through.");
      return;
    } finally {
      setSaving(false);
    }

    if (ok) {
      const boxLabel = modal.line.boxNumber != null ? `Box ${modal.line.boxNumber}` : `Order #${modal.line.orderNumber}`;
      setModal(null);
      setBanner(`Refunded ${modal.quantity} × ${modal.line.productName} for ${boxLabel} - the customer has been emailed.`);
      try {
        await loadDay(day);
      } catch {
        setBanner(`Refunded ${modal.quantity} × ${modal.line.productName} for ${boxLabel}. The screen couldn't refresh itself - hit Refresh before carrying on.`);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted">Loading this week&apos;s packing...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-primary">Packing</h1>
        <p className="text-sm text-muted mt-0.5">
          Tick each item as it goes in the box. If it isn&apos;t there, hit Missing.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={day}
          onChange={(e) => changeDay(e.target.value)}
          className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm font-semibold text-primary"
        >
          {deliveryDays.map(d => (
            <option key={d} value={d}>{formatDeliveryDate(d)}</option>
          ))}
        </select>
        <button
          onClick={() => changeDay(day)}
          disabled={reloading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-sm font-medium text-muted hover:bg-primary/5 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={reloading ? "animate-spin" : ""} />
          Refresh
        </button>

        <div className="w-full sm:w-auto sm:ml-auto rounded-lg bg-surface border border-primary/10 px-3 py-2 text-sm">
          <span className="text-muted">Refunded this week</span>{" "}
          <strong className="text-primary">£{dayRefundTotal.toFixed(2)}</strong>
          <span className="text-muted text-xs"> · {refunds.length} item{refunds.length !== 1 ? "s" : ""}</span>
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {pendingCount} with Josie
            </span>
          )}
        </div>
      </div>

      {banner && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} className="text-green-600 hover:text-green-800">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* ── Known short before we start ─────────────────────────────────────── */}
      {flagWork.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200">
            <h2 className="font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle size={17} />
              Refund these first
            </h2>
            <p className="text-xs text-amber-700 mt-0.5">
              The farm has already told us these aren&apos;t coming. Clear them, then pack.
            </p>
          </div>
          <div className="divide-y divide-amber-200">
            {flagWork.map(({ flag, supplierName, lines }) => (
              <div key={`${flag.supplierId}-${flag.productName}`} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-amber-900">{flag.productName}</span>
                  <span className="text-xs text-amber-700">from {supplierName}</span>
                  {flag.quantityUnavailable != null && (
                    <span className="text-xs text-amber-700">· {flag.quantityUnavailable} short</span>
                  )}
                  <span className="text-xs text-amber-700/80">
                    · {flag.flaggedBy === "admin" ? "Josie logged this" : "the farm told us"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lines.map(line => (
                    <button
                      key={`${line.orderId}-${line.productName}`}
                      onClick={() => openMissing(flag.supplierId, supplierName, line)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-300 px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                    >
                      <XCircle size={13} />
                      {line.boxNumber != null ? `Box ${line.boxNumber}` : `#${line.orderNumber}`} × {line.remaining}
                      <OrderCount seq={line.orderSeq} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The crates ──────────────────────────────────────────────────────── */}
      {suppliers.length === 0 && (
        <p className="text-muted text-sm">No orders for {formatDeliveryDate(day)}.</p>
      )}

      <div className="space-y-3">
        {suppliers.map(supplier => {
          const { done, total, complete } = supplierProgress(supplier);
          const isOpen = openSupplier === supplier.supplierId;
          return (
            <div
              key={supplier.supplierId}
              className={`rounded-xl border overflow-hidden ${complete ? "border-green-300 bg-green-50/60" : "border-primary/15 bg-surface"}`}
            >
              <button
                onClick={() => setOpenSupplier(isOpen ? null : supplier.supplierId)}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <span className={`font-bold ${complete ? "text-green-800" : "text-primary"}`}>
                    {supplier.supplierName}
                  </span>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {supplier.products.map(p => `${p.productName} × ${p.total}`).join("  ·  ")}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    complete ? "bg-green-200 text-green-900" : "bg-primary/10 text-primary"
                  }`}
                >
                  {complete ? "✓ Done" : `${done}/${total}`}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-primary/10 divide-y divide-primary/5">
                  {supplier.boxes.map(box => {
                    const boxDone = box.lines.every(
                      l => l.remaining <= 0 || isTicked(l.orderId, supplier.supplierId, l.productName)
                    );
                    return (
                      <div key={box.orderId} className={boxDone ? "bg-green-50/70" : ""}>
                        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                          <span className={`font-semibold ${boxDone ? "text-green-800" : "text-primary"}`}>
                            {box.boxNumber != null ? `Box ${box.boxNumber}` : `Order #${box.orderNumber}`}
                          </span>
                          <span className="text-xs text-muted">#{box.orderNumber}</span>
                          <OrderCount seq={box.orderSeq} />
                          {boxDone && <CheckCircle2 size={14} className="text-green-600" />}
                        </div>
                        <div className="px-4 pb-3 space-y-1.5">
                          {box.lines.map(line => {
                            if (line.remaining <= 0) {
                              return (
                                <div key={line.productName} className="flex items-center gap-2 pl-1 opacity-60">
                                  <XCircle size={18} className="text-red-300 flex-shrink-0" />
                                  <span className="text-sm text-red-400 line-through">
                                    {formatItemLine(line.productName, line.unit, line.ordered)}
                                  </span>
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                    Refunded
                                  </span>
                                </div>
                              );
                            }
                            const ticked = isTicked(line.orderId, supplier.supplierId, line.productName);
                            return (
                              <div key={line.productName} className="flex items-center gap-2 pl-1">
                                <label className="flex flex-1 items-center gap-2.5 cursor-pointer min-w-0 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={ticked}
                                    onChange={() => toggleTick(supplier.supplierId, line)}
                                    className="h-6 w-6 rounded border-primary/30 text-green-600 focus:ring-green-500 flex-shrink-0"
                                  />
                                  <span className={`text-sm ${ticked ? "text-green-600 line-through" : "text-primary"}`}>
                                    {formatItemLine(line.productName, line.unit, line.remaining)}
                                    {line.refunded > 0 && (
                                      <span className="ml-1 text-xs text-red-500">({line.refunded} refunded)</span>
                                    )}
                                  </span>
                                  {line.refrigerated && <ChilledTag />}
                                </label>
                                {!ticked && (
                                  <button
                                    onClick={() => openMissing(supplier.supplierId, supplier.supplierName, line)}
                                    className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/15 px-3 py-2.5 text-xs font-medium text-muted hover:text-red-600 hover:border-red-200 transition"
                                  >
                                    <XCircle size={13} />
                                    Missing
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Missing / refund ────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-xl">
            <div className="sticky top-0 bg-background border-b border-primary/10 px-5 py-4">
              <h3 className="font-bold text-primary">Refund {modal.line.productName}</h3>
              <p className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>
                  {modal.line.boxNumber != null ? `Box ${modal.line.boxNumber}` : `Order #${modal.line.orderNumber}`}
                  {modal.line.customerName ? ` · ${modal.line.customerName}` : ""} · {modal.supplierName}
                </span>
                <OrderCount seq={modal.line.orderSeq} />
              </p>
              {modal.line.orderSeq === 1 && (
                <p className="mt-1.5 rounded-lg bg-secondary/10 px-2.5 py-1.5 text-xs text-primary">
                  This is their very first box - worth a second look before you refund it.
                </p>
              )}
            </div>

            <div className="px-5 py-4 space-y-5">
              {modal.line.remaining > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-2">How many are missing?</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: modal.line.remaining }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setModal({ ...modal, quantity: n })}
                        className={`h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold transition ${
                          modal.quantity === n
                            ? "border-secondary bg-secondary text-white"
                            : "border-primary/20 text-primary hover:bg-primary/5"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-1.5">of {modal.line.remaining} in this box</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">What happened?</label>
                <div className="space-y-2">
                  {REASONS.map(reason => (
                    <button
                      key={reason.type}
                      onClick={() =>
                        setModal({
                          ...modal,
                          reasonType: reason.type,
                          // Keep an edited note; swap a stock one for the new stock one.
                          customerNote: REASONS.some(r => r.note === modal.customerNote)
                            ? reason.note
                            : modal.customerNote,
                        })
                      }
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        modal.reasonType === reason.type
                          ? "border-secondary bg-secondary/10"
                          : "border-primary/15 hover:bg-primary/5"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-primary">{reason.label}</span>
                      <span className="block text-xs text-muted">{reason.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">
                  What the customer will be told
                </label>
                <textarea
                  value={modal.customerNote}
                  onChange={(e) => setModal({ ...modal, customerNote: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-primary"
                />
                <p className="text-xs text-muted mt-1">This goes straight into their refund email.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">
                  Whose fault, do you reckon?
                </label>
                <div className="flex gap-2">
                  {FAULT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setModal({ ...modal, faultHint: option.value })}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        modal.faultHint === option.value
                          ? "border-secondary bg-secondary/10 text-primary"
                          : "border-primary/15 text-muted hover:bg-primary/5"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-1.5">
                  Just a steer for Josie - she decides whether the farm pays.
                </p>
              </div>

              {modalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {modalError}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-background border-t border-primary/10 px-5 py-4">
              <p className="text-xs text-muted mb-2.5 text-center">
                Refunds the card and emails the customer straight away.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setModal(null)}
                  disabled={saving}
                  className="rounded-lg border border-primary/20 px-4 py-3 text-sm font-medium text-muted hover:bg-primary/5 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRefund}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-4 py-3 text-sm font-semibold text-white hover:bg-secondary/90 transition disabled:opacity-50"
                >
                  <PoundSterling size={15} />
                  {saving ? "Refunding..." : `Refund ${modal.quantity}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
