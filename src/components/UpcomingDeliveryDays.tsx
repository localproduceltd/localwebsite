"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import type { Order } from "@/lib/data";

interface DeliveryStat {
  date: string;
  orderCount: number;
  revenue: number;
}

interface SupplierSummary {
  supplierId: string;
  supplierName: string;
  totalValue: number;
  items: { productName: string; quantity: number; price: number }[];
}

function formatDeliveryDate(dateStr: string) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function getSupplierSummariesForDay(orders: Order[], deliveryDate: string): SupplierSummary[] {
  const dayOrders = orders.filter((o) => o.deliveryDay === deliveryDate && o.status !== "cancelled");
  const supplierMap = new Map<string, SupplierSummary>();

  for (const order of dayOrders) {
    for (const item of order.items) {
      if (!item.supplierId || !item.supplierName) continue;
      
      const existing = supplierMap.get(item.supplierId) || {
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        totalValue: 0,
        items: [],
      };
      
      // Check if this product already exists in items
      const existingItem = existing.items.find((i) => i.productName === item.productName);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        existing.items.push({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        });
      }
      
      existing.totalValue += item.quantity * item.price;
      supplierMap.set(item.supplierId, existing);
    }
  }

  return Array.from(supplierMap.values()).sort((a, b) => b.totalValue - a.totalValue);
}

export default function UpcomingDeliveryDays({
  upcomingDeliveryStats,
  orders,
}: {
  upcomingDeliveryStats: DeliveryStat[];
  orders: Order[];
}) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
        // Also collapse all suppliers for this day
        setExpandedSuppliers((prevSuppliers) => {
          const nextSuppliers = new Set(prevSuppliers);
          for (const key of prevSuppliers) {
            if (key.startsWith(date + ":")) {
              nextSuppliers.delete(key);
            }
          }
          return nextSuppliers;
        });
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const toggleSupplier = (dayDate: string, supplierId: string) => {
    const key = `${dayDate}:${supplierId}`;
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={20} className="text-secondary" />
        <h2 className="text-lg font-semibold text-primary">Upcoming Delivery Days</h2>
      </div>
      {upcomingDeliveryStats.length === 0 ? (
        <p className="text-sm text-muted">No upcoming delivery days</p>
      ) : (
        <div className="space-y-3">
          {upcomingDeliveryStats.map((day) => {
            const isDayExpanded = expandedDays.has(day.date);
            const supplierSummaries = isDayExpanded ? getSupplierSummariesForDay(orders, day.date) : [];

            return (
              <div key={day.date} className="rounded-lg bg-primary/5 overflow-hidden">
                {/* Day Header */}
                <button
                  onClick={() => toggleDay(day.date)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/10 transition"
                >
                  <div className="flex items-center gap-3">
                    {isDayExpanded ? (
                      <ChevronDown size={18} className="text-primary" />
                    ) : (
                      <ChevronRight size={18} className="text-primary" />
                    )}
                    <span className="font-medium text-primary">{formatDeliveryDate(day.date)}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-muted">
                      <span className="font-semibold text-primary">{day.orderCount}</span> order{day.orderCount !== 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-green-600">£{day.revenue.toFixed(2)}</span>
                  </div>
                </button>

                {/* Expanded: Supplier List */}
                {isDayExpanded && (
                  <div className="border-t border-primary/10 px-4 py-3 space-y-2">
                    {supplierSummaries.length === 0 ? (
                      <p className="text-sm text-muted pl-6">No supplier data</p>
                    ) : (
                      supplierSummaries.map((supplier) => {
                        const supplierKey = `${day.date}:${supplier.supplierId}`;
                        const isSupplierExpanded = expandedSuppliers.has(supplierKey);

                        return (
                          <div key={supplier.supplierId} className="rounded-lg bg-surface overflow-hidden">
                            {/* Supplier Header */}
                            <button
                              onClick={() => toggleSupplier(day.date, supplier.supplierId)}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 transition"
                            >
                              <div className="flex items-center gap-2">
                                {isSupplierExpanded ? (
                                  <ChevronDown size={16} className="text-muted" />
                                ) : (
                                  <ChevronRight size={16} className="text-muted" />
                                )}
                                <span className="font-medium text-primary text-sm">{supplier.supplierName}</span>
                              </div>
                              <span className="font-semibold text-green-600 text-sm">£{supplier.totalValue.toFixed(2)}</span>
                            </button>

                            {/* Expanded: Item List */}
                            {isSupplierExpanded && (
                              <div className="border-t border-primary/5 px-3 py-2 bg-primary/5">
                                <div className="space-y-1">
                                  {supplier.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm pl-6">
                                      <span className="text-muted">
                                        {item.productName} <span className="text-primary">×{item.quantity}</span>
                                      </span>
                                      <span className="text-primary">£{(item.quantity * item.price).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-primary/10 pl-6">
                                  <span className="text-primary">Total</span>
                                  <span className="text-green-600">£{supplier.totalValue.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
