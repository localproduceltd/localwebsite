"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type Supplier,
  type SupplierUser,
  getSupplierUser,
  getSupplier,
  updateSupplier,
} from "@/lib/data";
import { Save, MapPin, Loader2, Pencil, X } from "lucide-react";

export default function SupplierDashboard() {
  const { user, isLoaded } = useUser();
  const [supplierUser, setSupplierUser] = useState<SupplierUser | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    (async () => {
      const su = await getSupplierUser(user.id);
      setSupplierUser(su);
      if (su) {
        const s = await getSupplier(su.supplierId);
        setSupplier(s);
        setForm(s);
      }
      setLoading(false);
    })();
  }, [isLoaded, user]);

  const handleEdit = () => {
    setForm(supplier);
    setEditing(true);
    setSaved(false);
  };

  const handleCancel = () => {
    setForm(supplier);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    await updateSupplier(form);
    setSupplier(form);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!supplierUser || !supplier || !form) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary">No Supplier Account</h1>
        <p className="mt-2 text-muted">Your account is not linked to a supplier. Please contact the admin to get set up.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Supplier photo + header */}
      <div className="overflow-hidden rounded-xl bg-surface shadow-sm">
        {(editing ? form.image : supplier.image) && (
          <div className="aspect-[3/1] overflow-hidden">
            <img src={editing ? form.image : supplier.image} alt={supplier.name} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">{editing ? form.name : supplier.name}</h1>
            <p className="mt-0.5 text-sm text-muted flex items-center gap-1">
              <MapPin size={12} /> {editing ? form.location : supplier.location}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${supplier.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {supplier.active ? "Live" : "Not Live"}
            </span>
            {!editing && (
              <button
                onClick={handleEdit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-secondary/90"
              >
                <Pencil size={12} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Read-only view */}
      {!editing && (
        <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm space-y-4">
          {saved && (
            <div className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              Profile saved successfully!
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted">Description</p>
            <p className="mt-1 text-sm text-primary">{supplier.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted">Location</p>
              <p className="mt-1 text-sm text-primary">{supplier.location}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Category</p>
              <p className="mt-1 text-sm text-primary">{supplier.category}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted">Latitude</p>
              <p className="mt-1 text-sm text-primary">{supplier.lat ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Longitude</p>
              <p className="mt-1 text-sm text-primary">{supplier.lng ?? "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <>
          <h2 className="mt-8 text-lg font-bold text-primary">Edit Profile</h2>
          <p className="mt-1 text-sm text-muted">Update your supplier information below</p>

          <div className="mt-4 space-y-4 rounded-xl bg-surface p-6 shadow-sm">
            <div>
              <label className="text-xs font-semibold text-muted">Supplier Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">Image URL</label>
              <input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.lat ?? ""}
                  onChange={(e) => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })}
                  className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.lng ?? ""}
                  onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })}
                  className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-primary/5 pt-4">
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted transition hover:bg-background"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
