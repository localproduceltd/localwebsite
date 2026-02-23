"use client";

import { useState, useEffect } from "react";
import { type DeliveryDay } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Calendar, Clock } from "lucide-react";

export default function AdminDeliveryDaysPage() {
  const [days, setDays] = useState<DeliveryDay[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("delivery_days").select("*").order("id").then(({ data }) => {
      if (data) setDays(data.map((d) => ({ id: d.id, dayOfWeek: d.day_of_week, cutoffTime: d.cutoff_time, active: d.active })));
    });
  }, []);

  const toggleActive = (id: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d))
    );
  };

  const updateCutoff = (id: string, cutoffTime: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === id ? { ...d, cutoffTime } : d))
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Calendar size={28} className="text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-primary">Delivery Days</h1>
          <p className="mt-1 text-muted">Set which days deliveries are available and order cutoff times</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {days.map((day) => (
          <div
            key={day.id}
            className={`flex items-center justify-between rounded-xl p-5 shadow-sm transition ${
              day.active ? "bg-surface ring-2 ring-primary-light/30" : "bg-surface opacity-60"
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleActive(day.id)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  day.active ? "bg-primary-light" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    day.active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <div>
                <p className="font-semibold text-primary">{day.dayOfWeek}</p>
                <p className="text-xs text-muted">
                  {day.active ? "Deliveries enabled" : "No deliveries"}
                </p>
              </div>
            </div>

            {day.active && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted" />
                <label className="text-xs text-muted">Cutoff:</label>
                <input
                  type="time"
                  value={day.cutoffTime}
                  onChange={(e) => updateCutoff(day.id, e.target.value)}
                  className="rounded-lg border border-primary/20 bg-background px-2 py-1 text-sm outline-none focus:border-primary-light"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-secondary/10 p-4">
        <h3 className="text-sm font-semibold text-primary">How it works</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>&#8226; Enable the days you want to offer deliveries</li>
          <li>&#8226; Set a cutoff time — orders placed after this time will go to the next delivery day</li>
          <li>&#8226; Customers will see available delivery days when placing orders</li>
        </ul>
      </div>

      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          for (const day of days) {
            await supabase.from("delivery_days").update({ active: day.active, cutoff_time: day.cutoffTime }).eq("id", day.id);
          }
          setSaving(false);
        }}
        className="mt-6 w-full rounded-lg bg-primary py-3 text-center font-semibold text-white transition hover:bg-primary-light disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
