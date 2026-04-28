"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type Product,
  type Supplier,
  type SupplierUser,
  type Locality,
  type ProductStatus,
  ALL_LOCALITIES,
  getSupplierUser,
  getSupplier,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getAverageRatings,
} from "@/lib/data";
import { PRODUCT_CATEGORIES, ALLERGENS, PRODUCT_TAGS } from "@/lib/categories";
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
    const product = products.find((p) => p.id === id);
    if (!confirm(`Are you sure you want to delete "${product?.name}"? This cannot be undone.`)) return;
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

  const categoriesInUse = Array.from(new Set(products.map((p) => p.category))).sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Your Products</h1>
          <p className="text-sm text-muted">{products.length} product{products.length !== 1 ? "s" : ""} total</p>
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
            {product.status === "rejected" && product.rejectionReason && (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                <span className="font-semibold">Rejection reason:</span> {product.rejectionReason}
              </div>
            )}
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
              <th className="px-4 py-3 font-semibold text-primary text-center">
                <select
                  value={stockFilters.size === 2 ? "all" : stockFilters.has("in_stock") ? "in_stock" : "out_of_stock"}
                  onChange={(e) => {
                    if (e.target.value === "all") setStockFilters(new Set(["in_stock", "out_of_stock"]));
                    else setStockFilters(new Set([e.target.value as "in_stock" | "out_of_stock"]));
                  }}
                  className="rounded border border-primary/20 bg-transparent px-1 py-0.5 text-xs font-semibold outline-none focus:border-secondary"
                >
                  <option value="all">All Stock</option>
                  <option value="in_stock">In Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </th>
              <th className="px-4 py-3 font-semibold text-primary text-center">Rating</th>
              <th className="px-4 py-3 font-semibold text-primary text-center">
                <select
                  value={statusFilters.size === 3 ? "all" : statusFilters.size === 1 ? Array.from(statusFilters)[0] : "all"}
                  onChange={(e) => {
                    if (e.target.value === "all") setStatusFilters(new Set(["approved", "pending", "rejected"]));
                    else setStatusFilters(new Set([e.target.value as ProductStatus]));
                  }}
                  className="rounded border border-primary/20 bg-transparent px-1 py-0.5 text-xs font-semibold outline-none focus:border-secondary"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </th>
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
                  <div className="flex flex-col items-center gap-1">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      product.status === "approved" ? "bg-green-100 text-green-700" :
                      product.status === "pending" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-600"
                    }`}>
                      {product.status}
                    </span>
                    {product.status === "rejected" && product.rejectionReason && (
                      <span className="max-w-[150px] truncate text-[10px] text-red-500" title={product.rejectionReason}>
                        {product.rejectionReason}
                      </span>
                    )}
                  </div>
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
      variableLocation: false,
      status: "pending" as ProductStatus,
      allergens: [],
      tags: [],
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
              {ALL_LOCALITIES.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">
              <strong>Own Produce:</strong> Produced by you • <strong>Local:</strong> Within 20 miles of you • <strong>Regional:</strong> From Derbyshire or surrounding counties • <strong>UK:</strong> From elsewhere in the UK • <strong>International:</strong> From outside the UK
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Product Location</label>
            <div className="flex gap-3 mb-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, variableLocation: false })}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
                  !form.variableLocation
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-primary/20 bg-surface text-muted hover:border-primary/40"
                }`}
              >
                Fixed Location
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!form.variableLocation && window.confirm("Are you sure? Some customers prefer to only buy products they can see on the map.")) {
                    setForm({ ...form, variableLocation: true, lat: null, lng: null });
                  }
                }}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
                  form.variableLocation
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-primary/20 bg-surface text-muted hover:border-primary/40"
                }`}
              >
                Variable Location
              </button>
            </div>
            {!form.variableLocation && (
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm font-medium text-primary transition hover:bg-secondary/10"
              >
                <MapPin size={16} />
                {form.lat && form.lng ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : "Set location on map"}
              </button>
            )}
            {form.variableLocation && (
              <p className="text-xs text-muted italic">This product&apos;s origin varies (e.g. sourced from different farms)</p>
            )}
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
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.variableLocation && (!form.lat || !form.lng)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {product ? "Save & Submit for Approval" : "Add Product"}
          </button>
        </div>
        {!form.variableLocation && (!form.lat || !form.lng) && (
          <p className="mt-2 text-xs text-red-500 text-right">Please set a location on the map or select Variable Location</p>
        )}
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
