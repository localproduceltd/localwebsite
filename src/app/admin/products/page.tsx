"use client";

import { useState, useEffect, useMemo } from "react";
import { type Product, type Supplier, type Locality, type ProductStatus, ALL_LOCALITIES, getProducts, getLiveSuppliers, createProduct, updateProduct, deleteProduct, restoreProduct, permanentlyDeleteProduct, updateProductStatus, getSupplierByProductId } from "@/lib/data";
import { PRODUCT_CATEGORIES, ALLERGENS, PRODUCT_TAGS } from "@/lib/categories";
import { Plus, Pencil, Trash2, X, Search, ChevronDown, ChevronRight, MapPin, RotateCcw, Archive, Star, Filter, XCircle } from "lucide-react";
import MapPicker from "@/components/MapPicker";
import ImageUpload from "@/components/ImageUpload";

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
  
  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedLocalities, setSelectedLocalities] = useState<Set<Locality>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out">("all");
  const [imageFilter, setImageFilter] = useState<"all" | "has" | "missing">("all");
  const [locationFilter, setLocationFilter] = useState<"all" | "variable" | "fixed">("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "has" | "missing">("all");

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
    
    // Don't allow approval if product has no image
    if (status === "approved" && product && !product.image) {
      alert("Cannot approve a product without a photo. Please add an image first.");
      return;
    }
    
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

  // Josie's Picks - count and toggle
  const josiesPicksCount = productList.filter((p) => p.tags?.includes("josies-pick")).length;
  
  const toggleJosiesPick = async (product: Product) => {
    const isCurrentlyPicked = product.tags?.includes("josies-pick");
    
    // Don't allow more than 4 picks
    if (!isCurrentlyPicked && josiesPicksCount >= 4) {
      alert("You can only have 4 Josie's Top Picks. Remove one first!");
      return;
    }
    
    const newTags = isCurrentlyPicked
      ? product.tags.filter((t) => t !== "josies-pick")
      : [...(product.tags || []), "josies-pick"];
    
    const updatedProduct = { ...product, tags: newTags };
    await updateProduct(updatedProduct);
    setProductList((prev) => prev.map((p) => p.id === product.id ? updatedProduct : p));
  };

  // Separate active and archived products
  const activeProducts = productList.filter((p) => !p.archivedAt);
  const archivedProducts = productList.filter((p) => p.archivedAt);

  const filtered = activeProducts
    .filter((p) => launchSupplierIds.has(p.supplierId)) // Only show products from launch suppliers
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => {
      if (supplierFilter === "all") return true;
      if (supplierFilter === "live_only") {
        const supplier = suppliers.find((s) => s.id === p.supplierId);
        return supplier?.status === "launch_live";
      }
      if (supplierFilter === "not_live_only") {
        const supplier = suppliers.find((s) => s.id === p.supplierId);
        return supplier?.status === "launch_not_live";
      }
      return p.supplierId === supplierFilter;
    })
    // Search filter
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q);
    })
    // Category filter
    .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
    // Locality filter
    .filter((p) => selectedLocalities.size === 0 || selectedLocalities.has(p.locality))
    // Tags filter
    .filter((p) => selectedTags.size === 0 || p.tags?.some((t) => selectedTags.has(t)))
    // Stock filter
    .filter((p) => stockFilter === "all" || (stockFilter === "in" ? p.inStock : !p.inStock))
    // Image filter
    .filter((p) => imageFilter === "all" || (imageFilter === "has" ? !!p.image : !p.image))
    // Variable location filter
    .filter((p) => locationFilter === "all" || (locationFilter === "variable" ? p.variableLocation : !p.variableLocation))
    // Price filter
    .filter((p) => priceFilter === "all" || (priceFilter === "has" ? p.price > 0 : !p.price || p.price === 0));
  
  const pendingCount = activeProducts.filter((p) => launchSupplierIds.has(p.supplierId) && p.status === "pending").length;
  const totalBeforeFilters = activeProducts.filter((p) => launchSupplierIds.has(p.supplierId)).length;
  
  // Count active filters
  const activeFilterCount = [
    searchQuery.trim() ? 1 : 0,
    categoryFilter !== "all" ? 1 : 0,
    selectedLocalities.size > 0 ? 1 : 0,
    selectedTags.size > 0 ? 1 : 0,
    stockFilter !== "all" ? 1 : 0,
    imageFilter !== "all" ? 1 : 0,
    locationFilter !== "all" ? 1 : 0,
    priceFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  
  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSelectedLocalities(new Set());
    setSelectedTags(new Set());
    setStockFilter("all");
    setImageFilter("all");
    setLocationFilter("all");
    setPriceFilter("all");
    setStatusFilter("all");
    setSupplierFilter("all");
  };

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
          <p className="mt-1 text-muted">
            {filtered.length !== totalBeforeFilters ? `Showing ${filtered.length} of ${totalBeforeFilters} products` : `${filtered.length} products`}
            {pendingCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingCount} pending</span>}
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-primary">
              <Star size={10} className="fill-accent text-accent" /> {josiesPicksCount}/4 picks
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              showFilters || activeFilterCount > 0
                ? "bg-secondary text-white"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{activeFilterCount}</span>
            )}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-secondary"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
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

      {/* Collapsible Filters Panel */}
      {showFilters && (
        <div className="mt-6 rounded-xl bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-primary">Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
              >
                <XCircle size={14} /> Clear all filters
              </button>
            )}
          </div>
          
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search products, descriptions, suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-secondary"
              />
            </div>
          </div>
          
          {/* Row 1: Supplier, Category, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Supplier</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Suppliers</option>
                <option value="live_only">Live Suppliers Only</option>
                <option value="not_live_only">Not Live Suppliers Only</option>
                <optgroup label="Live">
                  {suppliers.filter((s) => s.status === "launch_live").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Not Live">
                  {suppliers.filter((s) => s.status === "launch_not_live").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Categories</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Status</label>
              <div className="flex gap-1">
                {(["all", "approved", "pending", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                      statusFilter === s
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Row 2: Locality */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted mb-1">Locality</label>
            <div className="flex flex-wrap gap-2">
              {ALL_LOCALITIES.map((loc) => (
                <button
                  key={loc}
                  onClick={() => {
                    const next = new Set(selectedLocalities);
                    if (next.has(loc)) next.delete(loc);
                    else next.add(loc);
                    setSelectedLocalities(next);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedLocalities.has(loc)
                      ? "bg-secondary text-white"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
          
          {/* Row 3: Tags */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    const next = new Set(selectedTags);
                    if (next.has(tag.id)) next.delete(tag.id);
                    else next.add(tag.id);
                    setSelectedTags(next);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedTags.has(tag.id)
                      ? "bg-accent text-white"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Row 4: Quick filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Stock</label>
              <div className="flex gap-1">
                {([["all", "All"], ["in", "In Stock"], ["out", "Out"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setStockFilter(val)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      stockFilter === val
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Image</label>
              <div className="flex gap-1">
                {([["all", "All"], ["has", "Has"], ["missing", "Missing"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setImageFilter(val)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      imageFilter === val
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Location</label>
              <div className="flex gap-1">
                {([["all", "All"], ["variable", "Variable"], ["fixed", "Fixed"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setLocationFilter(val)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      locationFilter === val
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Price</label>
              <div className="flex gap-1">
                {([["all", "All"], ["has", "Has"], ["missing", "£0"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPriceFilter(val)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      priceFilter === val
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                            <button
                              onClick={() => toggleJosiesPick(product)}
                              title={product.tags?.includes("josies-pick") ? "Remove from Josie's Picks" : "Add to Josie's Picks"}
                              className={`shrink-0 rounded p-1 transition ${
                                product.tags?.includes("josies-pick")
                                  ? "text-accent"
                                  : "text-gray-300 hover:text-accent/60"
                              }`}
                            >
                              <Star size={16} className={product.tags?.includes("josies-pick") ? "fill-accent" : ""} />
                            </button>
                            <div className="h-10 w-10 overflow-hidden rounded-lg bg-secondary/10">
                              {product.image ? (
                                <img src={product.image} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-muted text-xs">?</div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-primary">
                                {product.name}
                                {product.tags?.includes("josies-pick") && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                                    <Star size={8} className="fill-accent" /> PICK
                                  </span>
                                )}
                              </p>
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
                          <select
                            value={product.status}
                            onChange={(e) => {
                              const newStatus = e.target.value as ProductStatus;
                              if (newStatus === "rejected") {
                                setRejectingProduct(product);
                              } else {
                                handleStatusChange(product.id, newStatus);
                              }
                            }}
                            className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold border-0 outline-none ${
                              product.status === "approved" ? "bg-green-100 text-green-700" :
                              product.status === "pending" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-600"
                            }`}
                          >
                            <option value="approved">approved</option>
                            <option value="pending">pending</option>
                            <option value="rejected">rejected</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
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
      variableLocation: false,
      status: "approved" as ProductStatus,
      allergens: [],
      tags: [],
      ingredients: null,
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
            <optgroup label="Live">
              {suppliers.filter((s) => s.status === "launch_live").map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
            <optgroup label="Not Live">
              {suppliers.filter((s) => s.status === "launch_not_live").map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
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
          <ImageUpload
            currentImage={form.image}
            onImageChange={(url) => setForm({ ...form, image: url })}
          />
          <select
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value as Locality })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          >
            {ALL_LOCALITIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted">Product Location</label>
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
                onClick={() => setForm({ ...form, variableLocation: true, lat: null, lng: null })}
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
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Set coordinates</span>
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
              </>
            )}
            {form.variableLocation && (
              <p className="text-xs text-muted italic">This product&apos;s origin varies</p>
            )}
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

          {/* Ingredients */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ingredients (optional)</label>
            <textarea
              placeholder="e.g. Flour (wheat), butter (milk), sugar, eggs, salt..."
              value={form.ingredients ?? ""}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value || null })}
              className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
              rows={3}
            />
            <p className="mt-1 text-xs text-muted">List ingredients if applicable. This will be shown to customers.</p>
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
            disabled={!form.variableLocation && (!form.lat || !form.lng)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {product ? "Save Changes" : "Add Product"}
          </button>
        </div>
        {!form.variableLocation && (!form.lat || !form.lng) && (
          <p className="mt-2 text-xs text-red-500 text-right">Please set a location or select Variable Location</p>
        )}
      </div>
    </div>
  );
}
