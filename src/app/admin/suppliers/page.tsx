"use client";

import { useState, useEffect } from "react";
import { type Supplier, getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/data";
import { Plus, Pencil, Trash2, X, MapPin } from "lucide-react";

export default function AdminSuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchSuppliers = () => getSuppliers().then(setSupplierList).catch(console.error);

  useEffect(() => { fetchSuppliers(); }, []);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Suppliers</h1>
          <p className="mt-1 text-muted">{supplierList.length} suppliers</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-light"
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
        {supplierList.map((supplier) => (
          <div key={supplier.id} className="overflow-hidden rounded-xl bg-surface shadow-sm">
            <div className="aspect-[3/2] overflow-hidden">
              <img src={supplier.image} alt={supplier.name} className="h-full w-full object-cover" />
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
              <div className="mt-3 flex gap-2 border-t border-primary/5 pt-3">
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
        ))}
      </div>
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
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">{supplier ? "Edit Supplier" : "Add Supplier"}</h2>
          <button onClick={onCancel} className="rounded p-1 text-muted hover:text-primary">
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
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
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-background">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
          >
            {supplier ? "Save Changes" : "Add Supplier"}
          </button>
        </div>
      </div>
    </div>
  );
}
