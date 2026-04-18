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
  getAverageRatings,
} from "@/lib/data";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { LOCALITY_COLORS } from "@/lib/locality";
import { Plus, Pencil, Trash2, X, Loader2, Star, Package, Filter, MapPin } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import MapPicker from "@/components/MapPicker";

export default function SupplierProductsPage() {
  const { user, isLoaded } = useUser();
  const [supplierUser, setSupplierUser] = useState<SupplierUser | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilters, setStatusFilters] = useState<Set<ProductStatus>>(new Set(["approved", "pending", "rejected"]));
  const [stockFilters, setStockFilters] = useState<Set<"in_stock" | "out_of_stock">>(new Set(["in_stock", "out_of_stock"]));

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
      const ratings = await getAverageRatings();
      setAvgRatings(ratings);
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

  const handleToggleStock = async (product: Product) => {
    if (!supplier) return;
    const updated = { ...product, inStock: !product.inStock };
    await updateProduct(updated);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  // Filter and sort products
  const filteredProducts = products
    .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
    .filter((p) => statusFilters.has(p.status))
    .filter((p) => stockFilters.has(p.inStock ? "in_stock" : "out_of_stock"))
    .sort((a, b) => {
      // First sort by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

  const pendingCount = products.filter((p) => p.status === "pending").length;
  const approvedCount = products.filter((p) => p.status === "approved").length;
  const rejectedCount = products.filter((p) => p.status === "rejected").length;
  const inStockCount = products.filter((p) => p.inStock).length;
  const outOfStockCount = products.filter((p) => !p.inStock).length;
  const categoriesInUse = Array.from(new Set(products.map((p) => p.category))).sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Your Products</h1>
                  </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            >
              <option value="all">All Categories</option>
              {categoriesInUse.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Status filter buttons */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["approved", "pending", "rejected"] as const).map((status) => {
          const count = status === "approved" ? approvedCount 
            : status === "pending" ? pendingCount 
            : rejectedCount;
          const isSelected = statusFilters.has(status);
          const toggleStatus = () => {
            setStatusFilters((prev) => {
              const next = new Set(prev);
              if (next.has(status)) next.delete(status);
              else next.add(status);
              return next;
            });
          };
          return (
            <button
              key={status}
              onClick={toggleStatus}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                isSelected
                  ? status === "approved" ? "bg-green-600 text-white"
                    : status === "pending" ? "bg-amber-500 text-white"
                    : "bg-red-500 text-white"
                  : status === "approved" ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : status === "pending" ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-red-100 text-red-600 hover:bg-red-200"
              }`}
            >
              {status} ({count})
            </button>
          );
        })}
      </div>

      {/* Stock filter buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {([
          { key: "in_stock" as const, label: "In Stock", count: inStockCount },
          { key: "out_of_stock" as const, label: "Out of Stock", count: outOfStockCount },
        ]).map(({ key, label, count }) => {
          const isSelected = stockFilters.has(key);
          const toggleStock = () => {
            setStockFilters((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          };
          return (
            <button
              key={key}
              onClick={toggleStock}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                isSelected
                  ? key === "in_stock" ? "bg-blue-600 text-white" : "bg-gray-600 text-white"
                  : key === "in_stock" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
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

      {/* Mobile card view */}
      <div className="mt-8 space-y-4 md:hidden">
        {products.length === 0 && (
          <p className="py-8 text-center text-muted">No products yet. Add your first product!</p>
        )}
        {filteredProducts.length === 0 && products.length > 0 && (
          <p className="py-8 text-center text-muted">No products match the selected category.</p>
        )}
        {filteredProducts.map((product) => {
          const localityColors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
          return (
            <div key={product.id} className={`rounded-xl bg-surface p-4 shadow-sm ${!product.inStock ? "opacity-50" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-secondary/10">
                  {product.image && <img src={product.image} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-primary">{product.name}</p>
                <p className="text-xs text-muted">{product.unit}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-medium text-primary">{product.category}</span>
                  <span 
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: localityColors.bg, color: localityColors.text, border: `1px solid ${localityColors.border}` }}
                  >
                    {product.locality ?? "—"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    product.status === "approved" ? "bg-green-100 text-green-700" :
                    product.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-600"
                  }`}>{product.status}</span>
                </div>
              </div>
            </div>
            {avgRatings[product.id] && (
              <div className="mt-2 flex items-center gap-1">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={11} className={avgRatings[product.id].avg >= s ? "fill-accent text-accent" : "text-primary/15"} />
                  ))}
                </div>
                <span className="text-[10px] text-muted">{avgRatings[product.id].avg.toFixed(1)} ({avgRatings[product.id].count})</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-primary/5 pt-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">£{product.price.toFixed(2)}</span>
                <button
                  onClick={() => handleToggleStock(product)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                    product.inStock 
                      ? "bg-green-100 text-green-700 hover:bg-green-200" 
                      : "bg-red-100 text-red-600 hover:bg-red-200"
                  }`}
                >
                  {product.inStock ? "In Stock" : "Out of Stock"}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditing(product); setShowForm(true); }}
                  className="rounded p-2 text-muted transition hover:bg-secondary/20 hover:text-primary"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="rounded p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
        })}
      </div>

      {/* Desktop table view */}
      <div className="mt-8 hidden overflow-hidden rounded-xl bg-surface shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/5 bg-primary/5 text-left">
              <th className="px-4 py-3 font-semibold text-primary">Product</th>
              <th className="px-4 py-3 font-semibold text-primary">Category</th>
              <th className="px-4 py-3 font-semibold text-primary">Locality</th>
              <th className="px-4 py-3 font-semibold text-primary text-right">Price</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Stock</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Rating</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Status</th>
              <th className="px-4 py-3 font-semibold text-primary text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">No products yet. Add your first product!</td>
              </tr>
            )}
            {filteredProducts.length === 0 && products.length > 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">No products match the selected category.</td>
              </tr>
            )}
            {filteredProducts.map((product) => {
              const localityColors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
              return (
              <tr key={product.id} className={`border-b border-primary/5 last:border-0 ${!product.inStock ? "opacity-50" : ""}`}>
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
                  <span 
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: localityColors.bg, color: localityColors.text, border: `1px solid ${localityColors.border}` }}
                  >
                    {product.locality ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-primary">£{product.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleStock(product)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                      product.inStock 
                        ? "bg-green-100 text-green-700 hover:bg-green-200" 
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                  >
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  {avgRatings[product.id] ? (
                    <div className="flex items-center justify-center gap-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12} className={avgRatings[product.id].avg >= s ? "fill-accent text-accent" : "text-primary/15"} />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted">{avgRatings[product.id].avg.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
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
            );
            })}
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
  const [showMapPicker, setShowMapPicker] = useState(false);

  return (
    <>
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
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-primary">£</span>
                <input
                  placeholder="0.00"
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
                placeholder="e.g. 500g"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Category</label>
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
          </div>
          <ImageUpload
            currentImage={form.image}
            onImageChange={(url) => setForm({ ...form, image: url })}
          />
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Locality</label>
            <select
              value={form.locality}
              onChange={(e) => setForm({ ...form, locality: e.target.value as Locality })}
              className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            >
              {LOCALITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">
              <strong>Own Produce:</strong> Produced by you • <strong>Local:</strong> Within 20 miles of you • <strong>Regional:</strong> From Derbyshire or surrounding counties • <strong>UK:</strong> From elsewhere in the UK • <strong>International:</strong> From outside the UK
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Location (optional)</label>
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm font-medium text-primary transition hover:bg-secondary/10"
            >
              <MapPin size={16} />
              {form.lat && form.lng ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : "Set location on map"}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Stock Status</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, inStock: true })}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-bold transition ${
                  form.inStock
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-primary/20 bg-surface text-muted hover:border-primary/40"
                }`}
              >
                In Stock
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, inStock: false })}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-bold transition ${
                  !form.inStock
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-primary/20 bg-surface text-muted hover:border-primary/40"
                }`}
              >
                Out of Stock
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            {product ? "Save & Submit for Approval" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
    {showMapPicker && (
      <MapPicker
        lat={form.lat}
        lng={form.lng}
        onLocationSelect={(lat, lng) => {
          setForm({ ...form, lat, lng });
          setShowMapPicker(false);
        }}
        onClose={() => setShowMapPicker(false)}
      />
    )}
    </>
  );
}
