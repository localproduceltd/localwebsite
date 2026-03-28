"use client";

import { useState, useEffect } from "react";
import { type Product, type Supplier, type Locality, type ProductStatus, LOCALITY_OPTIONS, getProducts, getSuppliers, createProduct, updateProduct, deleteProduct, updateProductStatus } from "@/lib/data";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { Plus, Pencil, Trash2, X, Check, XCircle } from "lucide-react";

export default function AdminProductsPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");

  const fetchProducts = () => getProducts().then(setProductList).catch(console.error);

  useEffect(() => {
    fetchProducts();
    getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  const handleDelete = async (id: string) => {
    await deleteProduct(id);
    setProductList((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async (product: Product) => {
    if (editing) {
      await updateProduct(product);
    } else {
      await createProduct(product);
    }
    await fetchProducts();
    setEditing(null);
    setShowForm(false);
  };

  const handleStatusChange = async (productId: string, status: ProductStatus) => {
    await updateProductStatus(productId, status);
    setProductList((prev) => prev.map((p) => (p.id === productId ? { ...p, status } : p)));
  };

  const filtered = statusFilter === "all" ? productList : productList.filter((p) => p.status === statusFilter);
  const pendingCount = productList.filter((p) => p.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Products</h1>
          <p className="mt-1 text-muted">{productList.length} products{pendingCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingCount} pending</span>}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-secondary"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editing}
          suppliers={suppliers}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setShowForm(false); }}
        />
      )}

      {/* Status filter */}
      <div className="mt-6 flex gap-2">
        {(["all", "approved", "pending", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
              statusFilter === s
                ? "bg-primary text-white"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {s} {s !== "all" && `(${productList.filter((p) => p.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Product Table */}
      <div className="mt-4 overflow-hidden rounded-xl bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/5 bg-primary/5 text-left">
              <th className="px-4 py-3 font-semibold text-primary">Product</th>
              <th className="px-4 py-3 font-semibold text-primary">Supplier</th>
              <th className="px-4 py-3 font-semibold text-primary">Category</th>
              <th className="px-4 py-3 font-semibold text-primary">Locality</th>
              <th className="px-4 py-3 font-semibold text-primary text-right">Price</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Stock</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Status</th>
              <th className="px-4 py-3 font-semibold text-primary text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id} className="border-b border-primary/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-secondary/10">
                      <img src={product.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="font-medium text-primary">{product.name}</p>
                      <p className="text-xs text-muted">{product.unit}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{product.supplierName}</td>
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
                  <div className="flex items-center justify-end gap-1">
                    {product.status !== "approved" && (
                      <button
                        onClick={() => handleStatusChange(product.id, "approved")}
                        title="Approve"
                        className="rounded p-1.5 text-green-600 transition hover:bg-green-50"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {product.status !== "rejected" && (
                      <button
                        onClick={() => handleStatusChange(product.id, "rejected")}
                        title="Reject"
                        className="rounded p-1.5 text-red-500 transition hover:bg-red-50"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => { setEditing(product); setShowForm(true); }}
                      className="rounded p-1.5 text-muted transition hover:bg-secondary/20 hover:text-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="rounded p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({
  product,
  suppliers,
  onSave,
  onCancel,
}: {
  product: Product | null;
  suppliers: Supplier[];
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Product>(
    product ?? {
      id: "",
      supplierId: "",
      supplierName: "",
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
      status: "approved" as ProductStatus,
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
        <div className="mt-4 space-y-3 overflow-y-auto flex-1">
          <input
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
          <select
            value={form.supplierId}
            onChange={(e) => {
              const s = suppliers.find((s) => s.id === e.target.value);
              setForm({ ...form, supplierId: e.target.value, supplierName: s?.name ?? "" });
            }}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          >
            <option value="">Select a supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              value={form.price || ""}
              onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            />
            <input
              placeholder="Unit (e.g. 500g)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          >
            <option value="">Select category...</option>
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
          <select
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value as Locality })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
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
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            />
            <input
              placeholder="Longitude (optional)"
              type="number"
              step="any"
              value={form.lng ?? ""}
              onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
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
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-secondary"
          >
            {product ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
