"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type Product,
  type Supplier,
  type SupplierUser,
  type Locality,
  type ProductStatus,
  LOCALITY_OPTIONS,
  getSupplierUser,
  getSupplier,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/data";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

export default function SupplierProductsPage() {
  const { user, isLoaded } = useUser();
  const [supplierUser, setSupplierUser] = useState<SupplierUser | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchProducts = async (supplierId: string) => {
    const prods = await getProductsBySupplier(supplierId);
    setProducts(prods);
  };

  useEffect(() => {
    if (!isLoaded || !user) return;
    (async () => {
      const su = await getSupplierUser(user.id);
      setSupplierUser(su);
      if (su) {
        const s = await getSupplier(su.supplierId);
        setSupplier(s);
        if (s) await fetchProducts(s.id);
      }
      setLoading(false);
    })();
  }, [isLoaded, user]);

  const handleSave = async (product: Product) => {
    if (!supplier) return;
    if (editing) {
      // Editing an existing product → set back to pending
      await updateProduct({ ...product, status: "pending" });
    } else {
      // New product → pending
      await createProduct({ ...product, supplierId: supplier.id, status: "pending" });
    }
    await fetchProducts(supplier.id);
    setEditing(null);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!supplier) return;
    await deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!supplierUser || !supplier) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary">No Supplier Account</h1>
        <p className="mt-2 text-muted">Your account is not linked to a supplier.</p>
      </div>
    );
  }

  const pendingCount = products.filter((p) => p.status === "pending").length;
  const approvedCount = products.filter((p) => p.status === "approved").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Your Products</h1>
          <p className="mt-1 text-sm text-muted">
            {products.length} products
            {pendingCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingCount} pending</span>}
            {approvedCount > 0 && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{approvedCount} approved</span>}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {showForm && (
        <SupplierProductForm
          product={editing}
          supplierId={supplier.id}
          supplierName={supplier.name}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setShowForm(false); }}
        />
      )}

      <div className="mt-8 overflow-hidden rounded-xl bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/5 bg-primary/5 text-left">
              <th className="px-4 py-3 font-semibold text-primary">Product</th>
              <th className="px-4 py-3 font-semibold text-primary">Category</th>
              <th className="px-4 py-3 font-semibold text-primary">Locality</th>
              <th className="px-4 py-3 font-semibold text-primary text-right">Price</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Stock</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Status</th>
              <th className="px-4 py-3 font-semibold text-primary text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">No products yet. Add your first product!</td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className="border-b border-primary/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-secondary/10">
                      {product.image && <img src={product.image} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-medium text-primary">{product.name}</p>
                      <p className="text-xs text-muted">{product.unit}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {product.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {product.locality ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-primary">£{product.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${product.inStock ? "bg-green-500" : "bg-red-400"}`} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    product.status === "approved" ? "bg-green-100 text-green-700" :
                    product.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-600"
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { setEditing(product); setShowForm(true); }}
                    className="mr-2 rounded p-1.5 text-muted transition hover:bg-secondary/20 hover:text-primary"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="rounded p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        New products and edits require admin approval before they appear on the site.
      </p>
    </div>
  );
}

function SupplierProductForm({
  product,
  supplierId,
  supplierName,
  onSave,
  onCancel,
}: {
  product: Product | null;
  supplierId: string;
  supplierName: string;
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Product>(
    product ?? {
      id: "",
      supplierId,
      supplierName,
      name: "",
      description: "",
      price: 0,
      unit: "",
      image: "",
      category: "",
      inStock: true,
      locality: "Local" as Locality,
      lat: null,
      lng: null,
      status: "pending" as ProductStatus,
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">{product ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onCancel} className="rounded p-1 text-muted hover:text-primary">
            <X size={20} />
          </button>
        </div>
        {product && (
          <p className="mt-1 text-xs text-amber-600">Editing will set this product back to pending approval.</p>
        )}
        <div className="mt-4 space-y-3 overflow-y-auto flex-1">
          <input
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              value={form.price || ""}
              onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            />
            <input
              placeholder="Unit (e.g. 500g)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
            />
          </div>
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
          />
          <input
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
          />
          <select
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value as Locality })}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary-light"
          >
            {LOCALITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
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
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
              className="rounded"
            />
            In Stock
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-background">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90"
          >
            {product ? "Save & Submit for Approval" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
