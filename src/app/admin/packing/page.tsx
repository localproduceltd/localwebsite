"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Order, type OrderItem, DELIVERY_OPTION_LABELS, getOrders, getCustomerBoxStatuses } from "@/lib/data";
import { Printer, RefreshCw, ChevronDown, ChevronRight, Package } from "lucide-react";

// ─── Configurable thresholds ─────────────────────────────────────────────────
const SIZE_THRESHOLDS = { mediumMin: 12, bigMin: 30 } as const;
const COOL_THRESHOLDS = { bagMin: 1, boxMin: 4 } as const;
const CHILLED_CATEGORIES = ['Meat & Poultry', 'Cheese', 'Dairy', 'Fish & Seafood'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

function isUpcoming(dateStr: string) {
  if (!dateStr || dateStr === "unassigned") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return d >= today;
}

function getDisplayName(order: Order): string {
  if (order.customerName) return order.customerName;
  if (order.customerEmail) return order.customerEmail.split("@")[0];
  return "—";
}

function groupItemsBySupplier(items: OrderItem[]): Array<{ supplierId: string; supplierName: string; items: OrderItem[] }> {
  const map = new Map<string, { supplierName: string; items: OrderItem[] }>();
  for (const item of items) {
    const id = item.supplierId || "unknown";
    const name = item.supplierName || "Unknown Supplier";
    if (!map.has(id)) map.set(id, { supplierName: name, items: [] });
    map.get(id)!.items.push(item);
  }
  return Array.from(map.entries())
    .map(([supplierId, data]) => ({ supplierId, ...data }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

// ─── Derived packing fields ──────────────────────────────────────────────────

interface PackingOrder extends Order {
  totalItems: number;
  chilledItems: number;
  boxSize: "Small" | "Medium" | "Big";
  coolKit: "none" | "Cool bag" | "Cool box";
  boxAction: "New" | "Swap" | null;
  displayName: string;
  isIn: boolean;
  deliveryLabel: string;
}

function derivePackingFields(
  order: Order,
  productCategories: Map<string, string>,
  hasOutstandingBox: boolean
): PackingOrder {
  let totalItems = 0;
  let chilledItems = 0;

  for (const item of order.items) {
    totalItems += item.quantity;
    const category = productCategories.get(item.productId) || "";
    if ((CHILLED_CATEGORIES as readonly string[]).includes(category)) {
      chilledItems += item.quantity;
    }
  }

  let boxSize: "Small" | "Medium" | "Big" = "Small";
  if (totalItems >= SIZE_THRESHOLDS.bigMin) boxSize = "Big";
  else if (totalItems >= SIZE_THRESHOLDS.mediumMin) boxSize = "Medium";

  let coolKit: "none" | "Cool bag" | "Cool box" = "none";
  if (chilledItems >= COOL_THRESHOLDS.boxMin) coolKit = "Cool box";
  else if (chilledItems >= COOL_THRESHOLDS.bagMin) coolKit = "Cool bag";

  let boxAction: "New" | "Swap" | null = null;
  if (order.boxDepositPaid && !hasOutstandingBox) {
    boxAction = "New";
  } else if (hasOutstandingBox) {
    boxAction = "Swap";
  }

  const isIn = order.deliveryOption ? order.deliveryOption.startsWith("in") : order.willBeIn;
  const deliveryLabel = order.deliveryOption
    ? DELIVERY_OPTION_LABELS[order.deliveryOption]
    : (order.willBeIn ? "I'll be in" : "I'm out");

  return {
    ...order,
    totalItems,
    chilledItems,
    boxSize,
    coolKit,
    boxAction,
    displayName: getDisplayName(order),
    isIn,
    deliveryLabel,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPackingPage() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [boxStatuses, setBoxStatuses] = useState<Map<string, boolean>>(new Map());
  const [productCategories, setProductCategories] = useState<Map<string, string>>(new Map());
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [doneOrders, setDoneOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const orders = await getOrders();
      setOrderList(orders);

      const userIds = [...new Set(orders.map(o => o.userId))];
      const statuses = await getCustomerBoxStatuses(userIds);
      setBoxStatuses(statuses);

      // Build product category map from order items
      // We need to fetch products to get categories - but since order_items don't include category,
      // we'll fetch products separately
      const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))];
      if (productIds.length > 0) {
        const response = await fetch(`/api/products?ids=${productIds.join(",")}`);
        if (response.ok) {
          const products = await response.json();
          const catMap = new Map<string, string>();
          for (const p of products) {
            catMap.set(p.id, p.category);
          }
          setProductCategories(catMap);
        }
      }
    } catch (error) {
      console.error("Failed to load packing data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get delivery days with orders, sorted upcoming first
  const deliveryDays = useMemo(() => {
    const daySet = new Set<string>();
    for (const order of orderList) {
      if (order.deliveryDay && order.status !== "cancelled") {
        daySet.add(order.deliveryDay);
      }
    }
    return Array.from(daySet).sort((a, b) => {
      const aUp = isUpcoming(a);
      const bUp = isUpcoming(b);
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return a.localeCompare(b);
    });
  }, [orderList]);

  // Auto-select first upcoming day
  useEffect(() => {
    if (deliveryDays.length > 0 && !selectedDay) {
      const upcoming = deliveryDays.find(d => isUpcoming(d));
      setSelectedDay(upcoming || deliveryDays[0]);
    }
  }, [deliveryDays, selectedDay]);

  // Load done state from localStorage when day changes
  useEffect(() => {
    if (selectedDay) {
      const stored = localStorage.getItem(`packing-done-${selectedDay}`);
      if (stored) {
        try {
          setDoneOrders(new Set(JSON.parse(stored)));
        } catch {
          setDoneOrders(new Set());
        }
      } else {
        setDoneOrders(new Set());
      }
    }
  }, [selectedDay]);

  // Save done state to localStorage
  const toggleDone = useCallback((orderId: string) => {
    setDoneOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      localStorage.setItem(`packing-done-${selectedDay}`, JSON.stringify([...next]));
      return next;
    });
  }, [selectedDay]);

  const toggleExpand = useCallback((orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  // Get orders for selected day with derived fields
  const packingOrders = useMemo(() => {
    if (!selectedDay) return [];
    
    const dayOrders = orderList.filter(
      o => o.deliveryDay === selectedDay && o.status !== "cancelled"
    );

    const derived = dayOrders.map(order => 
      derivePackingFields(order, productCategories, boxStatuses.get(order.userId) ?? false)
    );

    // Sort by order number
    return derived.sort((a, b) => a.orderNumber - b.orderNumber);
  }, [selectedDay, orderList, productCategories, boxStatuses]);

  // Summary stats
  const summary = useMemo(() => {
    const morning = packingOrders.filter(o => o.deliveryWindow === "morning").length;
    const afternoon = packingOrders.filter(o => o.deliveryWindow === "afternoon").length;
    const big = packingOrders.filter(o => o.boxSize === "Big").length;
    const medium = packingOrders.filter(o => o.boxSize === "Medium").length;
    const small = packingOrders.filter(o => o.boxSize === "Small").length;
    return { total: packingOrders.length, morning, afternoon, big, medium, small };
  }, [packingOrders]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Packing List</h1>
        <p className="mt-4 text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8 print:px-0 print:py-0 print:max-w-none">
      {/* Header - hidden on print except title */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Packing List</h1>
            <p className="mt-1 text-muted">Friday morning packing view</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            >
              {deliveryDays.map(day => (
                <option key={day} value={day}>
                  {formatDeliveryDate(day)}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary line */}
        <div className="mb-4 text-sm text-muted">
          <span className="font-semibold text-primary">{summary.total} orders</span>
          {" | "}
          <span className="text-green-700">{summary.morning} morning</span>
          {" | "}
          <span className="text-amber-700">{summary.afternoon} afternoon</span>
          {" | "}
          <span className="text-red-700">{summary.big} big</span>
          {" | "}
          <span className="text-amber-600">{summary.medium} medium</span>
          {" | "}
          <span className="text-gray-600">{summary.small} small</span>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">Packing list - {formatDeliveryDate(selectedDay)}</h1>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface shadow-sm overflow-hidden print:shadow-none print:rounded-none">
        <table className="w-full text-sm print:text-[10pt]">
          <thead>
            <tr className="border-b border-primary/10 bg-primary/5 text-left text-xs uppercase text-muted print:bg-transparent">
              <th className="px-3 py-3 font-medium print:hidden">Done</th>
              <th className="px-3 py-3 font-medium w-16">#</th>
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Delivery</th>
              <th className="px-3 py-3 font-medium text-center">Window</th>
              <th className="px-3 py-3 font-medium text-center">Box size</th>
              <th className="px-3 py-3 font-medium text-center">Cool kit</th>
              <th className="px-3 py-3 font-medium text-center">Box</th>
              <th className="px-3 py-3 font-medium text-center">Items</th>
              <th className="px-3 py-3 font-medium text-right">Total</th>
              <th className="px-2 py-3 w-8 print:hidden"></th>
            </tr>
          </thead>
          {packingOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const isDone = doneOrders.has(order.id);

            return (
              <tbody key={order.id} className="divide-y divide-primary/5">
                  <tr 
                    className={`hover:bg-primary/5 transition cursor-pointer ${isDone ? "opacity-50" : ""}`}
                    onClick={() => toggleExpand(order.id)}
                  >
                    {/* Done checkbox */}
                    <td className="px-3 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleDone(order.id)}
                        className="w-4 h-4 rounded border-primary/30 text-green-600 focus:ring-green-500"
                      />
                    </td>

                    {/* Order number */}
                    <td className="px-3 py-3 font-bold text-primary">
                      #{order.orderNumber}
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3 font-medium text-primary">
                      {order.displayName}
                    </td>

                    {/* Delivery: in or out + chosen option */}
                    <td className="px-3 py-3">
                      <span className={`font-semibold ${order.isIn ? "text-green-700" : "text-amber-700"}`}>
                        {order.isIn ? "In" : "Out"}
                      </span>
                      <span className="block text-xs text-muted">{order.deliveryLabel}</span>
                    </td>

                    {/* Window pill */}
                    <td className="px-3 py-3 text-center">
                      {order.deliveryWindow === "morning" ? (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">AM</span>
                          <span className="hidden print:inline">AM</span>
                        </>
                      ) : order.deliveryWindow === "afternoon" ? (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">PM</span>
                          <span className="hidden print:inline">PM</span>
                        </>
                      ) : (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">—</span>
                          <span className="hidden print:inline">—</span>
                        </>
                      )}
                    </td>

                    {/* Box size pill */}
                    <td className="px-3 py-3 text-center">
                      {order.boxSize === "Big" ? (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Big</span>
                          <span className="hidden print:inline font-bold">B</span>
                        </>
                      ) : order.boxSize === "Medium" ? (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Medium</span>
                          <span className="hidden print:inline">M</span>
                        </>
                      ) : (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Small</span>
                          <span className="hidden print:inline">S</span>
                        </>
                      )}
                    </td>

                    {/* Cool kit pill */}
                    <td className="px-3 py-3 text-center">
                      {order.coolKit === "Cool box" ? (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                            Cool box ({order.chilledItems})
                          </span>
                          <span className="hidden print:inline font-bold">BOX ({order.chilledItems})</span>
                        </>
                      ) : order.coolKit === "Cool bag" ? (
                        <>
                          <span className="print:hidden inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            Cool bag ({order.chilledItems})
                          </span>
                          <span className="hidden print:inline">BAG ({order.chilledItems})</span>
                        </>
                      ) : (
                        <>
                          <span className="print:hidden text-xs text-muted">none</span>
                          <span className="hidden print:inline">—</span>
                        </>
                      )}
                    </td>

                    {/* Box action pill */}
                    <td className="px-3 py-3 text-center">
                      {order.boxAction === "New" ? (
                        <>
                          <span className="print:hidden inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            <Package size={10} />
                            New
                          </span>
                          <span className="hidden print:inline font-bold">NEW</span>
                        </>
                      ) : order.boxAction === "Swap" ? (
                        <>
                          <span className="print:hidden inline-flex items-center gap-1 rounded-full border border-blue-300 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            <Package size={10} />
                            Swap
                          </span>
                          <span className="hidden print:inline">SWAP</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>

                    {/* Items count */}
                    <td className="px-3 py-3 text-center font-medium text-primary">
                      {order.totalItems}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-3 text-right font-semibold text-primary">
                      £{order.total.toFixed(2)}
                    </td>

                    {/* Expand chevron */}
                    <td className="px-2 py-3 print:hidden">
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-muted" />
                      ) : (
                        <ChevronRight size={16} className="text-muted" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded row - items by supplier */}
                  {isExpanded && (
                    <tr className="print:hidden">
                      <td colSpan={11} className="bg-primary/5 px-6 py-4">
                        <div className="space-y-3">
                          {groupItemsBySupplier(order.items).map((supplierGroup) => (
                            <div key={supplierGroup.supplierId} className="rounded-lg border border-primary/10 bg-surface overflow-hidden">
                              <div className="px-3 py-2 border-b border-primary/10">
                                <span className="font-medium text-sm text-primary">{supplierGroup.supplierName}</span>
                              </div>
                              <div className="divide-y divide-primary/5">
                                {supplierGroup.items.map((item, i) => (
                                  <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-primary break-words">{item.productName}</p>
                                      {item.unit && <p className="text-xs text-muted">{item.unit}</p>}
                                    </div>
                                    <span className="text-sm font-medium text-primary flex-shrink-0">
                                      ×{item.quantity} = £{(item.quantity * item.price).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-4 text-[8pt] text-gray-500">
        Generated {new Date().toLocaleString("en-GB")}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* A4 with tight margins so the whole list fits one page */
          @page { size: A4 portrait; margin: 10mm; }

          /* Hide admin nav, header buttons, footer chrome */
          header, aside, footer,
          .print\\:hidden {
            display: none !important;
          }

          /* Full width, black on white */
          body {
            background: white !important;
            color: black !important;
            font-size: 9pt !important;
          }

          /* Table styling */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th, td {
            border: 1px solid #ccc !important;
            padding: 3px 6px !important;
          }

          /* Keep each order's row from splitting across pages */
          tr, tbody {
            break-inside: avoid;
          }

          /* Show print-only elements */
          .print\\:inline {
            display: inline !important;
          }

          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
