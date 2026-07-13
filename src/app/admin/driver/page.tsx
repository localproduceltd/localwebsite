"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type Order, type DeliveryOption, DELIVERY_OPTION_LABELS, getOrders, markOrderOnWay, markOrderDelivered } from "@/lib/data";
import { Truck, CheckCircle, MapPin, Home, Package, Upload, Play, RefreshCw, Navigation, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface RouteStop {
  id: string;
  delivery_day: string;
  order_id: string;
  order_number: number;
  route_position: number;
  leg: string;
}

interface RouteOrder extends Order {
  routePosition: number;
  leg: string;
}

const NEXT_BATCH_SIZE = 3;

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function getAccessLabel(order: Order): string {
  if (order.deliveryOption) {
    const labels: Record<DeliveryOption, string> = {
      in: "Hand to customer",
      in_no_disturb: "Leave at door (don't disturb)",
      out_need_coolbag: "Leave in cool box",
      out_own_coolbag: "Fill their cool bag",
    };
    return labels[order.deliveryOption];
  }
  return order.willBeIn ? "Hand to customer" : "Leave safe";
}

export default function AdminDriverPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [route, setRoute] = useState<RouteStop[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  // Locks the run/deliver actions while one is in flight, so a slow tap can't be
  // fired again and re-trigger the "on our way" batch. The DB-level idempotency
  // in markOrderOnWay is the real guarantee; this just stops the UI inviting it.
  const [busy, setBusy] = useState(false);

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const allOrders = await getOrders();
      setOrders(allOrders);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load route for selected day
  const loadRoute = useCallback(async (day: string) => {
    if (!day) return;
    try {
      const response = await fetch(`/api/admin/delivery-route?deliveryDay=${day}`);
      if (response.ok) {
        const data = await response.json();
        setRoute(data);
      }
    } catch (error) {
      console.error("Failed to load route:", error);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Get delivery days with orders (include past 4 weeks for testing)
  const deliveryDays = useMemo(() => {
    const daySet = new Set<string>();
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    fourWeeksAgo.setHours(0, 0, 0, 0);
    
    for (const order of orders) {
      if (order.deliveryDay && order.status !== "cancelled") {
        const d = new Date(order.deliveryDay + "T00:00:00");
        // Show last 4 weeks and future
        if (d >= fourWeeksAgo) {
          daySet.add(order.deliveryDay);
        }
      }
    }
    // Sort descending so most recent is first
    return Array.from(daySet).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Auto-select today or next delivery day
  useEffect(() => {
    if (deliveryDays.length > 0 && !selectedDay) {
      const today = new Date().toISOString().split("T")[0];
      const todayOrNext = deliveryDays.find(d => d >= today) || deliveryDays[0];
      setSelectedDay(todayOrNext);
    }
  }, [deliveryDays, selectedDay]);

  // Load route when day changes
  useEffect(() => {
    if (selectedDay) {
      loadRoute(selectedDay);
    }
  }, [selectedDay, loadRoute]);

  // Build route-ordered list of orders
  const routeOrders = useMemo((): RouteOrder[] => {
    if (!selectedDay || route.length === 0) return [];

    const dayOrders = orders.filter(
      o => o.deliveryDay === selectedDay && o.status !== "cancelled"
    );

    const routeMap = new Map(route.map(r => [r.order_id, r]));
    
    return dayOrders
      .filter(o => routeMap.has(o.id))
      .map(o => {
        const r = routeMap.get(o.id)!;
        return {
          ...o,
          routePosition: r.route_position,
          leg: r.leg,
        };
      })
      .sort((a, b) => {
        // Morning before afternoon
        if (a.leg !== b.leg) {
          return a.leg === "morning" ? -1 : 1;
        }
        return a.routePosition - b.routePosition;
      });
  }, [orders, route, selectedDay]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = routeOrders.length;
    const delivered = routeOrders.filter(o => o.status === "delivered").length;
    const onWay = routeOrders.filter(o => o.status === "next_hour").length;
    const remaining = total - delivered;
    return { total, delivered, onWay, remaining };
  }, [routeOrders]);

  // Find next undelivered orders
  const nextUndelivered = useMemo(() => {
    return routeOrders.filter(o => o.status !== "delivered");
  }, [routeOrders]);

  // Per-leg state - the morning and afternoon runs are started and finished
  // separately, so the morning run never spills into the afternoon.
  const legStats = useMemo(() => {
    const morning = routeOrders.filter(o => o.leg === "morning");
    const afternoon = routeOrders.filter(o => o.leg === "afternoon");
    const undelivered = (arr: RouteOrder[]) => arr.filter(o => o.status !== "delivered");
    const started = (arr: RouteOrder[]) => arr.some(o => o.status === "next_hour" || o.status === "delivered");
    return {
      hasMorning: morning.length > 0,
      hasAfternoon: afternoon.length > 0,
      morningStarted: started(morning),
      afternoonStarted: started(afternoon),
      morningRemaining: undelivered(morning).length,
      afternoonRemaining: undelivered(afternoon).length,
      morningComplete: morning.length > 0 && undelivered(morning).length === 0,
    };
  }, [routeOrders]);

  // Handle route upload
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch("/api/admin/delivery-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      // Reload route
      if (data.delivery_day) {
        setSelectedDay(data.delivery_day);
        await loadRoute(data.delivery_day);
      }
      await loadOrders();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload route");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // Sort one leg's still-undelivered orders by their position in the route.
  const legUndeliveredFrom = useCallback(
    (sourceOrders: Order[], leg: string): RouteOrder[] => {
      const routeMap = new Map(route.map(r => [r.order_id, r]));
      return sourceOrders
        .filter(o => o.deliveryDay === selectedDay && o.status !== "cancelled" && routeMap.has(o.id))
        .map(o => ({ ...o, routePosition: routeMap.get(o.id)!.route_position, leg: routeMap.get(o.id)!.leg }))
        .filter(o => o.leg === leg && o.status !== "delivered")
        .sort((a, b) => a.routePosition - b.routePosition);
    },
    [route, selectedDay]
  );

  // Put the next batch of a leg "on the van": mark up to NEXT_BATCH_SIZE as
  // next_hour, emailing only those newly added, with their place in the queue.
  // Scoped to a single leg so the morning run never pulls in afternoon stops.
  const notifyLeg = useCallback(
    async (leg: string, sourceOrders: Order[]) => {
      const undelivered = legUndeliveredFrom(sourceOrders, leg);
      const toMark = undelivered.slice(0, NEXT_BATCH_SIZE);
      for (let i = 0; i < toMark.length; i++) {
        const o = toMark[i];
        // Atomically move this order to next_hour. Returns false if it was
        // already on its way (or delivered) - in which case we must NOT email,
        // because someone/something already told this customer. This is what
        // makes repeat/overlapping taps safe, regardless of the stale snapshot.
        const justNotified = await markOrderOnWay(o.id);
        if (!justNotified) continue;
        if (o.customerEmail) {
          fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "order_status_update",
              data: {
                customerEmail: o.customerEmail,
                customerName: o.customerName || o.customerEmail.split("@")[0],
                orderNumber: o.orderNumber,
                status: "next_hour",
                stopsAhead: i, // 0 = first in line, 1 = second, 2 = third
                deliveryDay: o.deliveryDay
                  ? new Date(o.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                  : "Not set",
                deliveryWindow: o.deliveryWindow,
                routeLeg: leg,
                deliveryOption: o.deliveryOption,
                safePlace: o.safePlace,
              },
            }),
          }).catch(console.error);
        }
      }
    },
    [legUndeliveredFrom]
  );

  // Start a leg's run - put the first batch on the van. Re-fetch orders first so
  // the batch is built from current statuses (not a stale render snapshot), and
  // guard with `busy` so a second tap while this is in flight does nothing.
  const handleStartRun = async (leg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const fresh = await getOrders();
      setOrders(fresh);
      await notifyLeg(leg, fresh);
      await loadOrders();
    } finally {
      setBusy(false);
    }
  };

  // Mark an order delivered, then top up the SAME leg's queue so the next
  // person in line gets their "on our way" email.
  const handleDelivered = async (orderId: string) => {
    if (busy) return;
    const order = routeOrders.find(o => o.id === orderId);
    if (!order) return;

    setBusy(true);
    try {
    // Atomically mark delivered; returns false if it was already delivered, in
    // which case we skip the email so a double-tap can't send two.
    const justDelivered = await markOrderDelivered(orderId);
    if (!justDelivered) return;

    // Send delivered email
    if (order.customerEmail) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order_status_update",
          data: {
            customerEmail: order.customerEmail,
            customerName: order.customerName || order.customerEmail.split("@")[0],
            orderNumber: order.orderNumber,
            status: "delivered",
            deliveryDay: order.deliveryDay
              ? new Date(order.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
              : "Not set",
            deliveryWindow: order.deliveryWindow,
          },
        }),
      }).catch(console.error);
    }

    // Use a fresh snapshot so the just-delivered order is excluded, then top up
    // the queue within this leg only.
    const fresh = await getOrders();
    setOrders(fresh);
    await notifyLeg(order.leg, fresh);
    await loadOrders();
    } finally {
      setBusy(false);
    }
  };

  // Open Google Maps for an address
  const openMaps = (order: Order) => {
    if (order.pinLat && order.pinLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.pinLat},${order.pinLng}`, "_blank");
    } else if (order.address) {
      const addr = `${order.address.addressLine1}, ${order.address.city}, ${order.address.postcode}`;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const hasRoute = route.length > 0;
  const currentLeg = nextUndelivered[0]?.leg || "morning";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck size={28} className="text-secondary" />
          <div>
            <h1 className="text-xl font-bold text-primary">Driver Run</h1>
            <p className="text-sm text-muted">Delivery tracking</p>
          </div>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 text-muted hover:text-primary transition"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Day selector */}
      <div className="mb-4">
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value)}
          className="w-full rounded-xl border border-primary/20 px-4 py-3 text-lg font-semibold focus:border-secondary focus:outline-none"
        >
          {deliveryDays.map(day => (
            <option key={day} value={day}>
              {formatDeliveryDate(day)}
            </option>
          ))}
        </select>
      </div>

      {/* Upload route section */}
      {!hasRoute && (
        <div className="rounded-xl bg-amber-50 border-2 border-dashed border-amber-300 p-6 text-center mb-6">
          <Upload size={32} className="mx-auto text-amber-600 mb-2" />
          <p className="font-semibold text-amber-800 mb-1">No route uploaded</p>
          <p className="text-sm text-amber-700 mb-4">Upload the route JSON to start</p>
          <label className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition cursor-pointer">
            <Upload size={16} />
            Upload Route JSON
            <input
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          {uploadError && (
            <p className="mt-3 text-sm text-red-600">{uploadError}</p>
          )}
        </div>
      )}

      {/* Route loaded - show controls */}
      {hasRoute && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{stats.delivered}</p>
              <p className="text-xs text-green-600">Delivered</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{stats.onWay}</p>
              <p className="text-xs text-purple-600">On way</p>
            </div>
            <div className="rounded-xl bg-gray-100 p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{stats.remaining}</p>
              <p className="text-xs text-gray-600">Remaining</p>
            </div>
          </div>

          {/* Start morning run */}
          {legStats.hasMorning && !legStats.morningStarted && legStats.morningRemaining > 0 && (
            <button
              onClick={() => handleStartRun("morning")}
              disabled={busy}
              className="w-full rounded-xl bg-secondary py-4 text-lg font-bold text-white hover:bg-secondary/90 transition mb-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? <RefreshCw size={24} className="animate-spin" /> : <Play size={24} />}
              {busy ? "Working..." : "Start Morning Run"}
            </button>
          )}

          {/* Morning complete - afternoon ready */}
          {legStats.morningComplete && legStats.hasAfternoon && !legStats.afternoonStarted && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center mb-4">
              <p className="text-sm font-semibold text-green-800">Morning run complete 🎉</p>
              <p className="text-xs text-green-700">Start the afternoon run when you're ready.</p>
            </div>
          )}

          {/* Start afternoon run - only once the morning has finished */}
          {legStats.hasAfternoon && !legStats.afternoonStarted && legStats.afternoonRemaining > 0 && (legStats.morningComplete || !legStats.hasMorning) && (
            <button
              onClick={() => handleStartRun("afternoon")}
              disabled={busy}
              className="w-full rounded-xl bg-secondary py-4 text-lg font-bold text-white hover:bg-secondary/90 transition mb-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? <RefreshCw size={24} className="animate-spin" /> : <Play size={24} />}
              {busy ? "Working..." : "Start Afternoon Run"}
            </button>
          )}

          {/* Current leg indicator */}
          {((legStats.morningStarted && legStats.morningRemaining > 0) || (legStats.afternoonStarted && legStats.afternoonRemaining > 0)) && (
            <div className="flex items-center gap-2 mb-4 px-2">
              <Clock size={16} className="text-muted" />
              <span className="text-sm font-medium text-muted uppercase">
                {currentLeg} leg
              </span>
            </div>
          )}

          {/* Delivery list */}
          <div className="space-y-3">
            {routeOrders.map((order, index) => {
              const isDelivered = order.status === "delivered";
              const isOnWay = order.status === "next_hour";
              const isNext = !isDelivered && nextUndelivered[0]?.id === order.id;
              const isExpanded = expandedStop === order.id;
              
              // Show leg divider
              const prevOrder = routeOrders[index - 1];
              const showLegDivider = prevOrder && prevOrder.leg !== order.leg;

              return (
                <div key={order.id}>
                  {showLegDivider && (
                    <div className="flex items-center gap-2 py-3">
                      <div className="flex-1 h-px bg-primary/20" />
                      <span className="text-xs font-semibold text-muted uppercase">Afternoon leg</span>
                      <div className="flex-1 h-px bg-primary/20" />
                    </div>
                  )}
                  
                  <div
                    className={`rounded-xl border-2 overflow-hidden transition ${
                      isDelivered
                        ? "bg-green-50 border-green-200 opacity-60"
                        : isNext
                        ? "bg-secondary/10 border-secondary"
                        : isOnWay
                        ? "bg-purple-50 border-purple-200"
                        : "bg-surface border-primary/10"
                    }`}
                  >
                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer"
                      onClick={() => setExpandedStop(isExpanded ? null : order.id)}
                    >
                      {/* Position */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        isDelivered
                          ? "bg-green-500 text-white"
                          : isOnWay
                          ? "bg-purple-500 text-white"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {isDelivered ? <CheckCircle size={18} /> : order.routePosition}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">Box {order.boxNumber ?? `#${order.orderNumber}`}</span>
                          <span className="font-semibold text-primary truncate">
                            {order.customerName || order.customerEmail?.split("@")[0]}
                          </span>
                        </div>
                        <p className="text-sm text-muted truncate">
                          {order.address?.postcode} · {getAccessLabel(order)}
                        </p>
                      </div>

                      {/* Status / Action */}
                      <div className="flex items-center gap-2">
                        {isOnWay && !isDelivered && (
                          <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            ON WAY
                          </span>
                        )}
                        {isExpanded ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-primary/10 p-4 space-y-3">
                        {/* Address */}
                        <div>
                          <p className="font-semibold text-primary">
                            {order.address?.addressLine1}
                          </p>
                          {order.address?.addressLine2 && (
                            <p className="text-sm text-primary">{order.address.addressLine2}</p>
                          )}
                          <p className="text-sm text-primary">
                            {order.address?.city}, <strong>{order.address?.postcode}</strong>
                          </p>
                        </div>

                        {/* Delivery option */}
                        <div className="flex items-center gap-2 text-sm">
                          {order.deliveryOption?.startsWith("in") ? (
                            <Home size={16} className="text-green-600" />
                          ) : (
                            <MapPin size={16} className="text-amber-600" />
                          )}
                          <span className="font-medium">
                            {order.deliveryOption ? DELIVERY_OPTION_LABELS[order.deliveryOption] : (order.willBeIn ? "I'll be in" : "I'm out")}
                          </span>
                        </div>

                        {/* Safe place */}
                        {order.safePlace && (
                          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            📍 {order.safePlace}
                          </div>
                        )}

                        {/* Instructions */}
                        {order.instructions && (
                          <div className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                            ℹ️ {order.instructions}
                          </div>
                        )}

                        {/* Box info */}
                        {order.boxDepositPaid && (
                          <div className="flex items-center gap-2 text-sm text-green-700">
                            <Package size={16} />
                            <span className="font-medium">New cool box customer</span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openMaps(order); }}
                            className="flex-1 rounded-lg bg-sky-100 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-200 transition flex items-center justify-center gap-2"
                          >
                            <Navigation size={18} />
                            Navigate
                          </button>
                          {!isDelivered && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelivered(order.id); }}
                              disabled={busy}
                              className="flex-1 rounded-lg bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <CheckCircle size={18} />
                              {busy ? "Saving..." : "Delivered"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All done message */}
          {stats.remaining === 0 && stats.total > 0 && (
            <div className="rounded-xl bg-green-100 border-2 border-green-300 p-6 text-center mt-6">
              <CheckCircle size={48} className="mx-auto text-green-600 mb-2" />
              <p className="text-xl font-bold text-green-800">All delivered! 🎉</p>
              <p className="text-sm text-green-700 mt-1">{stats.total} orders completed</p>
            </div>
          )}

          {/* Re-upload option */}
          <div className="mt-6 pt-4 border-t border-primary/10">
            <label className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition cursor-pointer">
              <Upload size={16} />
              Re-upload route
              <input
                type="file"
                accept=".json"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
