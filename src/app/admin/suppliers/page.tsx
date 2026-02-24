"use client";

import { useState, useEffect } from "react";
import {
  type Supplier,
  type SupplierUser,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierUsers,
  createSupplierUser,
  deleteSupplierUser,
} from "@/lib/data";
import { Plus, Pencil, Trash2, X, MapPin, UserPlus, Link2, Power } from "lucide-react";

export default function AdminSuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [supplierUsers, setSupplierUsers] = useState<(SupplierUser & { supplierName: string })[]>([]);
  const [linkingSupplierId, setLinkingSupplierId] = useState<string | null>(null);
  const [linkClerkId, setLinkClerkId] = useState("");

  const fetchSuppliers = () => getSuppliers().then(setSupplierList).catch(console.error);
  const fetchSupplierUsers = () => getSupplierUsers().then(setSupplierUsers).catch(console.error);

  useEffect(() => { fetchSuppliers(); fetchSupplierUsers(); }, []);

  const handleDelete = async (id: string) => {
    await deleteSupplier(id);
    setSupplierList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async (supplier: Supplier) => {
    if (editing) {
      await updateSupplier(supplier);
      setSupplierList((prev) => prev.map((s) => (s.id === supplier.id ? supplier : s)));
    } else {
      const created = await createSupplier(supplier);
      setSupplierList((prev) => [...prev, created]);
    }
    setEditing(null);
    setShowForm(false);
  };

  const handleToggleActive = async (supplier: Supplier) => {
    const updated = { ...supplier, active: !supplier.active };
    await updateSupplier(updated);
    setSupplierList((prev) => prev.map((s) => (s.id === supplier.id ? updated : s)));
  };

  const handleLinkUser = async () => {
    if (!linkingSupplierId || !linkClerkId.trim()) return;
    try {
      await createSupplierUser(linkClerkId.trim(), linkingSupplierId);
      setLinkClerkId("");
      setLinkingSupplierId(null);
      fetchSupplierUsers();
    } catch (e) {
      alert("Failed to link user. Check the Clerk User ID is correct and not already linked.");
    }
  };

  const handleUnlinkUser = async (id: string) => {
    await deleteSupplierUser(id);
    fetchSupplierUsers();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Suppliers</h1>
          <p className="mt-1 text-muted">{supplierList.length} suppliers</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary-light"
        >
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      {showForm && (
        <SupplierForm
          supplier={editing}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setShowForm(false); }}
        />
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {supplierList.map((supplier) => {
          const linked = supplierUsers.find((su) => su.supplierId === supplier.id);
          return (
            <div key={supplier.id} className={`overflow-hidden rounded-xl bg-surface shadow-sm ${!supplier.active ? "opacity-60" : ""}`}>
              <div className="relative aspect-[3/2] overflow-hidden">
                <img src={supplier.image} alt={supplier.name} className="h-full w-full object-cover" />
                <span className={`absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${supplier.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {supplier.active ? "Live" : "Not Live"}
                </span>
              </div>
              <div className="p-4">
                <span className="inline-block rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {supplier.category}
                </span>
                <h3 className="mt-2 font-semibold text-primary">{supplier.name}</h3>
                <p className="mt-1 text-sm text-muted line-clamp-2">{supplier.description}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-primary-light">
                  <MapPin size={12} />
                  <span>{supplier.location}</span>
                </div>

                {/* Linked user info */}
                <div className="mt-2 text-xs">
                  {linked ? (
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 px-2 py-1">
                      <span className="flex items-center gap-1 text-primary"><Link2 size={11} /> Linked: <span className="font-mono text-[10px]">{linked.clerkUserId.slice(0, 16)}...</span></span>
                      <button onClick={() => handleUnlinkUser(linked.id)} className="text-red-500 hover:text-red-700 font-medium">Unlink</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setLinkingSupplierId(supplier.id); setLinkClerkId(""); }}
                      className="flex items-center gap-1 text-secondary hover:underline"
                    >
                      <UserPlus size={11} /> Link supplier login
                    </button>
                  )}
                </div>

                <div className="mt-3 flex gap-2 border-t border-primary/5 pt-3">
                  <button
                    onClick={() => handleToggleActive(supplier)}
                    className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition ${
                      supplier.active
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    <Power size={12} /> {supplier.active ? "Set Not Live" : "Set Live"}
                  </button>
                  <button
                    onClick={() => { setEditing(supplier); setShowForm(true); }}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-secondary/20 py-1.5 text-xs font-medium text-primary transition hover:bg-secondary/30"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Link Clerk User modal */}
      {linkingSupplierId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary">Link Supplier Login</h2>
              <button onClick={() => setLinkingSupplierId(null)} className="rounded p-1 text-muted hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">Enter the Clerk User ID of the supplier user. You can find this in the Clerk dashboard.</p>
            <input
              placeholder="user_2x..." 
              value={linkClerkId}
              onChange={(e) => setLinkClerkId(e.target.value)}
              className="mt-3 w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary-light"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setLinkingSupplierId(null)} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-background">
                Cancel
              </button>
              <button
                onClick={handleLinkUser}
                disabled={!linkClerkId.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-40"
              >
                Link User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierForm({
  supplier,
  onSave,
  onCancel,
}: {
  supplier: Supplier | null;
  onSave: (s: Supplier) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Supplier>(
    supplier ?? {
      id: "",
      name: "",
      description: "",
      image: "",
      location: "",
      category: "",
      lat: null,
      lng: null,
      active: false,
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">{supplier ? "Edit Supplier" : "Add Supplier"}</h2>
          <button onClick={onCancel} className="rounded p-1 text-muted hover:text-primary">
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 space-y-3 overflow-y-auto flex-1">
          <input
            placeholder="Supplier name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            />
          </div>
          <input
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Latitude (optional)"
              type="number"
              step="any"
              value={form.lat ?? ""}
              onChange={(e) => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            />
            <input
              placeholder="Longitude (optional)"
              type="number"
              step="any"
              value={form.lng ?? ""}
              onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-background">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-primary-light"
          >
            {supplier ? "Save Changes" : "Add Supplier"}
          </button>
        </div>
      </div>
    </div>
  );
}
