"use client";

import { useState, useEffect, useMemo } from "react";
import { type Product, type Supplier, type Locality, type ProductStatus, LOCALITY_OPTIONS, getProducts, getLiveSuppliers, createProduct, updateProduct, deleteProduct, restoreProduct, permanentlyDeleteProduct, updateProductStatus, getSupplierByProductId } from "@/lib/data";
import { PRODUCT_CATEGORIES, ALLERGENS, PRODUCT_TAGS } from "@/lib/categories";
import { Plus, Pencil, Trash2, X, Check, XCircle, Search, ChevronDown, ChevronRight, MapPin, RotateCcw, Archive } from "lucide-react";
import MapPicker from "@/components/MapPicker";

export default function AdminProductsPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [collapsedSuppliers, setCollapsedSuppliers] = useState<Set<string>>(new Set());
  const [rejectingProduct, setRejectingProduct] = useState<Product | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const fetchProducts = () => getProducts().then(setProductList).catch(console.error);

  useEffect(() => {
    fetchProducts();
    getLiveSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  const handleDelete = async () => {
    if (!deletingProduct) return;
    await deleteProduct(deletingProduct.id);
    setProductList((prev) => prev.map((p) => p.id === deletingProduct.id ? { ...p, archivedAt: new Date().toISOString() } : p));
    setDeletingProduct(null);
  };

  const handleRestore = async (id: string) => {
    await restoreProduct(id);
    setProductList((prev) => prev.map((p) => p.id === id ? { ...p, archivedAt: null } : p));
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this product? This cannot be undone.")) return;
    await permanentlyDeleteProduct(id);
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

  const handleStatusChange = async (productId: string, status: ProductStatus, reason?: string) => {
    const product = productList.find((p) => p.id === productId);
    await updateProductStatus(productId, status, reason);
    setProductList((prev) => prev.map((p) => (p.id === productId ? { ...p, status, rejectionReason: status === "rejected" ? reason : null } : p)));

    // Send email notification to supplier
    if (product && (status === "approved" || status === "rejected")) {
      getSupplierByProductId(productId).then((supplier) => {
        if (supplier?.email) {
          const emailType = status === "approved" ? "product_approved" : "product_rejected";
          const emailData = status === "approved"
            ? {
                supplierEmail: supplier.email,
                supplierName: supplier.name,
                productName: product.name,
              }
            : {
                supplierEmail: supplier.email,
                supplierName: supplier.name,
                productName: product.name,
                reason: reason || "No reason provided",
              };
          
          fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: emailType, data: emailData }),
          }).catch(console.error);
        }
      }).catch(console.error);
    }
  };

  const handleReject = async () => {
    if (!rejectingProduct) return;
    await handleStatusChange(rejectingProduct.id, "rejected", rejectionReason);
    setRejectingProduct(null);
    setRejectionReason("");
  };

  // Get set of launch supplier IDs for filtering
  const launchSupplierIds = useMemo(() => new Set(suppliers.map((s) => s.id)), [suppliers]);

  // Separate active and archived products
  const activeProducts = productList.filter((p) => !p.archivedAt);
  const archivedProducts = productList.filter((p) => p.archivedAt);

  const filtered = activeProducts
    .filter((p) => launchSupplierIds.has(p.supplierId)) // Only show products from launch suppliers
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => supplierFilter === "all" || p.supplierId === supplierFilter);
  const pendingCount = activeProducts.filter((p) => launchSupplierIds.has(p.supplierId) && p.status === "pending").length;

  // Group products by supplier, sorted alphabetically
  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string, { supplierName: string; products: Product[] }>();
    
    // Sort products by supplier name, then by product name
    const sorted = [...filtered].sort((a, b) => {
      const supplierCompare = a.supplierName.localeCompare(b.supplierName);
      if (supplierCompare !== 0) return supplierCompare;
      return a.name.localeCompare(b.name);
    });
    
    for (const product of sorted) {
      if (!groups.has(product.supplierId)) {
        groups.set(product.supplierId, { supplierName: product.supplierName, products: [] });
      }
      groups.get(product.supplierId)!.products.push(product);
    }
    
    return Array.from(groups.entries()).sort((a, b) => a[1].supplierName.localeCompare(b[1].supplierName));
  }, [filtered]);

  const toggleSupplier = (supplierId: string) => {
    setCollapsedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Products</h1>
          <p className="mt-1 text-muted">{filtered.length} products{pendingCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingCount} pending</span>}</p>
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

      {/* Rejection Reason Modal */}
      {rejectingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Reject Product</h2>
              <button onClick={() => { setRejectingProduct(null); setRejectionReason(""); }} className="rounded p-1 text-muted hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted mb-4">
              Rejecting <span className="font-semibold text-primary">{rejectingProduct.name}</span> from {rejectingProduct.supplierName}
            </p>
            <textarea
              placeholder="Reason for rejection (optional but recommended)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setRejectingProduct(null); setRejectionReason(""); }}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Reject Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Archive Product</h2>
              <button onClick={() => setDeletingProduct(null)} className="rounded p-1 text-muted hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted mb-4">
              Are you sure you want to archive <span className="font-semibold text-primary">{deletingProduct.name}</span>?
            </p>
            <p className="text-xs text-muted mb-4">
              The product will be moved to the archive and can be restored later. After 30 days, archived products may be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingProduct(null)}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Archive Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {/* Supplier filter */}
        <div className="flex items-center gap-2">
          <Search size={16} className="text-muted" />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="rounded-lg border border-primary/20 bg-surface px-3 py-1.5 text-sm outline-none focus:border-secondary"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
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
            {s} {s !== "all" && `(${productList.filter((p) => launchSupplierIds.has(p.supplierId) && p.status === s).length})`}
          </button>
        ))}
        </div>
      </div>

      {/* Products grouped by supplier */}
      <div className="mt-4 space-y-4">
        {groupedBySupplier.map(([supplierId, { supplierName, products }]) => {
          const isCollapsed = collapsedSuppliers.has(supplierId);
          const pendingInGroup = products.filter((p) => p.status === "pending").length;
          
          return (
            <div key={supplierId} className="overflow-hidden rounded-xl bg-surface shadow-sm">
              {/* Supplier header - clickable to collapse */}
              <button
                onClick={() => toggleSupplier(supplierId)}
                className="flex w-full items-center justify-between bg-primary/5 px-4 py-3 text-left hover:bg-primary/10 transition"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight size={18} className="text-muted" />
                  ) : (
                    <ChevronDown size={18} className="text-muted" />
                  )}
                  <span className="font-semibold text-primary">{supplierName}</span>
                  <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-medium text-primary">
                    {products.length} product{products.length !== 1 ? "s" : ""}
                  </span>
                  {pendingInGroup > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {pendingInGroup} pending
                    </span>
                  )}
                </div>
              </button>

              {/* Products table */}
              {!isCollapsed && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/5 text-left text-xs text-muted">
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 font-medium">Category</th>
                      <th className="px-4 py-2 font-medium">Locality</th>
                      <th className="px-4 py-2 font-medium text-right">Price</th>
                      <th className="px-4 py-2 font-medium text-center">Stock</th>
                      <th className="px-4 py-2 font-medium text-center">Status</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
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
                                onClick={() => setRejectingProduct(product)}
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
                              onClick={() => setDeletingProduct(product)}
                              title="Archive"
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
              )}
            </div>
          );
        })}
      </div>

      {/* Archived Products Section */}
      {archivedProducts.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-left"
          >
            {showArchived ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
            <Archive size={18} className="text-muted" />
            <h2 className="text-lg font-semibold text-muted">Archived Products</h2>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
              {archivedProducts.length}
            </span>
          </button>
          
          {showArchived && (
            <div className="mt-4 overflow-hidden rounded-xl bg-surface shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/5 text-left text-xs text-muted bg-gray-50">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">Supplier</th>
                    <th className="px-4 py-2 font-medium">Archived</th>
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedProducts.map((product) => (
                    <tr key={product.id} className="border-b border-primary/5 last:border-0 opacity-60">
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
                      <td className="px-4 py-3 text-xs text-muted">
                        {product.archivedAt ? new Date(product.archivedAt).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRestore(product.id)}
                            title="Restore"
                            className="rounded p-1.5 text-green-600 transition hover:bg-green-50"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(product.id)}
                            title="Delete permanently"
                            className="rounded p-1.5 text-red-500 transition hover:bg-red-50"
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
          )}
        </div>
      )}
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
      allergens: [],
      tags: [],
    }
  );
  const [showMapPicker, setShowMapPicker] = useState(false);

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
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">£</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-primary/20 bg-surface pl-7 pr-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Unit</label>
              <input
                placeholder="e.g. 500g, per kg, each"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
              />
            </div>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted">Location (optional)</label>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
              >
                <MapPin size={12} />
                Pick on map
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.lat ?? ""}
                  onChange={(e) => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.lng ?? ""}
                  onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
            </div>
          </div>
          {showMapPicker && (
            <MapPicker
              lat={form.lat}
              lng={form.lng}
              onLocationSelect={(lat, lng) => setForm({ ...form, lat, lng })}
              onClose={() => setShowMapPicker(false)}
            />
          )}
          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TAGS.map((tag) => {
                const isSelected = form.tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        tags: isSelected
                          ? form.tags.filter((t) => t !== tag.id)
                          : [...form.tags, tag.id],
                      });
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      isSelected ? tag.color : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Allergens (contains)</label>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto rounded-lg border border-primary/10 p-2">
              {ALLERGENS.map((allergen) => {
                const isSelected = form.allergens.includes(allergen.id);
                return (
                  <label key={allergen.id} className="flex items-center gap-2 text-xs text-primary cursor-pointer hover:bg-primary/5 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setForm({
                          ...form,
                          allergens: isSelected
                            ? form.allergens.filter((a) => a !== allergen.id)
                            : [...form.allergens, allergen.id],
                        });
                      }}
                      className="rounded text-amber-500"
                    />
                    {allergen.label}
                  </label>
                );
              })}
            </div>
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
