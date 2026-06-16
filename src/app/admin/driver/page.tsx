"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type Order, type DeliveryOption, DELIVERY_OPTION_LABELS, getOrders, updateOrderStatus } from "@/lib/data";
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
  const [runStarted, setRunStarted] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

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
        // Check if run has started (any order is next_hour or delivered)
        const dayOrders = orders.filter(o => o.deliveryDay === day);
        const hasStarted = dayOrders.some(o => o.status === "next_hour" || o.status === "delivered");
        setRunStarted(hasStarted);
      }
    } catch (error) {
      console.error("Failed to load route:", error);
    }
  }, [orders]);

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

  // Start the run - mark first N as next_hour
  const handleStartRun = async () => {
    const toMark = nextUndelivered.slice(0, NEXT_BATCH_SIZE);
    
    for (const order of toMark) {
      if (order.status !== "next_hour" && order.status !== "delivered") {
        await updateOrderStatus(order.id, "next_hour");
        // Send email
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
                status: "next_hour",
                deliveryDay: order.deliveryDay
                  ? new Date(order.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                  : "Not set",
                deliveryWindow: order.deliveryWindow,
                deliveryOption: order.deliveryOption,
                safePlace: order.safePlace,
              },
            }),
          }).catch(console.error);
        }
      }
    }

    setRunStarted(true);
    await loadOrders();
  };

  // Mark order as delivered and queue next batch
  const handleDelivered = async (orderId: string) => {
    const order = routeOrders.find(o => o.id === orderId);
    if (!order) return;

    // Mark as delivered
    await updateOrderStatus(orderId, "delivered");
    
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

    // Reload orders to get updated statuses
    await loadOrders();

    // After reload, check if we need to mark more as next_hour
    // We need to ensure next NEXT_BATCH_SIZE undelivered are marked
    setTimeout(async () => {
      const updatedOrders = await getOrders();
      const dayOrders = updatedOrders.filter(o => o.deliveryDay === selectedDay && o.status !== "cancelled");
      const routeMap = new Map(route.map(r => [r.order_id, r]));
      
      const sortedUndelivered = dayOrders
        .filter(o => routeMap.has(o.id) && o.status !== "delivered")
        .map(o => ({ ...o, routePosition: routeMap.get(o.id)!.route_position, leg: routeMap.get(o.id)!.leg }))
        .sort((a, b) => {
          if (a.leg !== b.leg) return a.leg === "morning" ? -1 : 1;
          return a.routePosition - b.routePosition;
        });

      // Mark next batch as next_hour if not already
      const toMark = sortedUndelivered.slice(0, NEXT_BATCH_SIZE);
      for (const o of toMark) {
        if (o.status !== "next_hour") {
          await updateOrderStatus(o.id, "next_hour");
          // Send email
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
                  deliveryDay: o.deliveryDay
                    ? new Date(o.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                    : "Not set",
                  deliveryWindow: o.deliveryWindow,
                  deliveryOption: o.deliveryOption,
                  safePlace: o.safePlace,
                },
              }),
            }).catch(console.error);
          }
        }
      }

      await loadOrders();
    }, 500);
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

          {/* Start run button */}
          {!runStarted && stats.remaining > 0 && (
            <button
              onClick={handleStartRun}
              className="w-full rounded-xl bg-secondary py-4 text-lg font-bold text-white hover:bg-secondary/90 transition mb-4 flex items-center justify-center gap-2"
            >
              <Play size={24} />
              Start Run
            </button>
          )}

          {/* Current leg indicator */}
          {runStarted && stats.remaining > 0 && (
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
                          <span className="font-bold text-primary">#{order.orderNumber}</span>
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
                              className="flex-1 rounded-lg bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 transition flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={18} />
                              Delivered
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
