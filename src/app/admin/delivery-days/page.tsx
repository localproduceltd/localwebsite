"use client";

import { useState, useEffect } from "react";
import { type DeliveryDay, getDeliveryDays, createDeliveryDay, updateDeliveryDay, deleteDeliveryDay } from "@/lib/data";
import { Calendar, Plus, Trash2, X } from "lucide-react";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function isPast(day: DeliveryDay) {
  const now = new Date();
  const cutoff = new Date(`${day.cutoffDate}T${day.cutoffTime}`);
  return now > cutoff;
}

export default function AdminDeliveryDaysPage() {
  const [days, setDays] = useState<DeliveryDay[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDay, setEditingDay] = useState<DeliveryDay | null>(null);
  const [form, setForm] = useState({ deliveryDate: "", cutoffDate: "", cutoffTime: "18:00" });

  const fetchDays = () => getDeliveryDays().then(setDays).catch(console.error);

  useEffect(() => { fetchDays(); }, []);

  const openNew = () => {
    setEditingDay(null);
    setForm({ deliveryDate: "", cutoffDate: "", cutoffTime: "18:00" });
    setShowForm(true);
  };

  const openEdit = (day: DeliveryDay) => {
    setEditingDay(day);
    setForm({ deliveryDate: day.deliveryDate, cutoffDate: day.cutoffDate, cutoffTime: day.cutoffTime });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.deliveryDate || !form.cutoffDate || !form.cutoffTime) return;
    if (editingDay) {
      await updateDeliveryDay({ ...editingDay, ...form });
    } else {
      await createDeliveryDay(form);
    }
    setShowForm(false);
    await fetchDays();
  };

  const handleDelete = async (id: string) => {
    await deleteDeliveryDay(id);
    await fetchDays();
  };

  const upcoming = days.filter((d) => !isPast(d));
  const past = days.filter((d) => isPast(d));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={28} className="text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-primary">Delivery Days</h1>
            <p className="mt-1 text-muted">Add specific delivery dates with order cutoff deadlines</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-secondary"
        >
          <Plus size={16} /> Add Date
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary">{editingDay ? "Edit Delivery Date" : "Add Delivery Date"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 text-muted hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Order Cutoff Date</label>
                <input
                  type="date"
                  value={form.cutoffDate}
                  onChange={(e) => setForm({ ...form, cutoffDate: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Order Cutoff Time</label>
                <input
                  type="time"
                  value={form.cutoffTime}
                  onChange={(e) => setForm({ ...form, cutoffTime: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.deliveryDate || !form.cutoffDate || !form.cutoffTime}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-secondary disabled:opacity-50"
              >
                {editingDay ? "Save Changes" : "Add Date"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Delivery Days */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 rounded-xl bg-surface p-6 text-center text-sm text-muted shadow-sm">
            No upcoming delivery dates. Click &quot;Add Date&quot; to create one.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {upcoming.map((day) => (
              <div key={day.id} className="flex items-center justify-between rounded-xl bg-surface p-5 shadow-sm ring-2 ring-secondary/20">
                <div>
                  <p className="font-semibold text-primary">{formatDate(day.deliveryDate)}</p>
                  <p className="text-xs text-muted">
                    Order by {formatDate(day.cutoffDate)} at {day.cutoffTime}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(day)}
                    className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-secondary/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(day.id)}
                    className="rounded p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Delivery Days */}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Past ({past.length})</h2>
          <div className="mt-3 space-y-3">
            {past.map((day) => (
              <div key={day.id} className="flex items-center justify-between rounded-xl bg-surface p-5 opacity-50 shadow-sm">
                <div>
                  <p className="font-semibold text-primary">{formatDate(day.deliveryDate)}</p>
                  <p className="text-xs text-muted">
                    Cutoff was {formatDate(day.cutoffDate)} at {day.cutoffTime}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(day.id)}
                  className="rounded p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl bg-secondary/10 p-4">
        <h3 className="text-sm font-semibold text-primary">How it works</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>&#8226; Add a delivery date — the day customers will receive their orders</li>
          <li>&#8226; Set a cutoff date &amp; time — orders must be placed before this deadline</li>
          <li>&#8226; Customers only see dates where the cutoff hasn&apos;t passed yet</li>
        </ul>
      </div>
    </div>
  );
}
