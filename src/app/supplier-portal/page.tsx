"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type Supplier,
  type SupplierUser,
  type Product,
  getSupplierUser,
  getSupplier,
  getProductsBySupplier,
  getAverageRatings,
  updateSupplier,
} from "@/lib/data";
import { MapPin, Loader2, Pencil, Save, X } from "lucide-react";
import SupplierDistance from "@/components/SupplierDistance";
import { LOCALITY_COLORS } from "@/lib/locality";
import { Star } from "lucide-react";
import MapPicker from "@/components/MapPicker";
import ImageUpload from "@/components/ImageUpload";

const SUPPLIER_CATEGORIES = [
  "Greengrocer",
  "Farm Shop",
  "Bakery",
  "Cheesemonger",
  "Butcher",
  "Fishmonger",
  "Deli",
  "Brewery",
  "Winery",
  "Other",
];

export default function YourPageView() {
  const { user, isLoaded } = useUser();
  const [supplierUser, setSupplierUser] = useState<SupplierUser | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    (async () => {
      const su = await getSupplierUser(user.id);
      setSupplierUser(su);
      if (su) {
        const s = await getSupplier(su.supplierId);
        setSupplier(s);
        setForm(s);
        const prods = await getProductsBySupplier(su.supplierId);
        setProducts(prods);
        const ratings = await getAverageRatings();
        setAvgRatings(ratings);
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
    // If supplier was launch_live, set to launch_not_live (requires admin re-approval)
    const updatedForm = form.status === "launch_live" 
      ? { ...form, status: "launch_not_live" as const }
      : form;
    await updateSupplier(updatedForm);
    setSupplier(updatedForm);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Live Status Banner */}
      {(() => {
        const isLive = supplier.status === "launch_live";
        return (
          <div className={`mb-6 rounded-lg px-4 py-3 ${isLive ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-bold ${isLive ? "text-green-800" : "text-red-800"}`}>
                  {isLive ? "✓ Your page is LIVE" : "⚠ Your page is NOT LIVE"}
                </p>
                <p className={`mt-0.5 text-xs ${isLive ? "text-green-700" : "text-red-700"}`}>
                  {isLive 
                    ? "Customers can see your page and products" 
                    : supplier.status === "launch_not_live"
                      ? "Your changes are pending admin approval."
                      : "Your page is hidden from customers. Contact admin to go live."}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isLive ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                {isLive ? "LIVE" : "NOT LIVE"}
              </span>
            </div>
          </div>
        );
      })()}

      {!editing && (
        <div className="mb-4">
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            <Pencil size={16} /> Edit Your Details
          </button>
        </div>
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Your Customer Page</h1>
        <p className="mt-1 text-sm text-muted">This is how customers see your page</p>
      </div>

      {saved && (
        <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Your details have been saved successfully!
        </div>
      )}

      {/* Edit Form Modal */}
      {editing && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Edit Your Details</h2>
              <button onClick={handleCancel} className="rounded p-1 text-muted hover:text-primary">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Supplier Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Ashbourne, Co. Meath"
                    className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                  >
                    <option value="">Select category</option>
                    {SUPPLIER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Supplier Image</label>
                <ImageUpload
                  currentImage={form.image}
                  onImageChange={(url) => setForm({ ...form, image: url })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Location on Map</label>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm font-medium text-primary transition hover:bg-secondary/10"
                >
                  <MapPin size={16} />
                  {form.lat && form.lng ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : "Set location on map"}
                </button>
                <p className="mt-1 text-xs text-muted">Click to search for your location or pin it on the map</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
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
        </div>
      )}

      {/* Supplier header - matching customer view */}
      <div className="overflow-hidden rounded-xl bg-surface shadow-sm">
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
          {/* Supplier Image - smaller and centered/left-aligned */}
          <div className="w-48 flex-shrink-0 overflow-hidden rounded-xl">
            <img src={supplier.image || "/images/Holding Image - Supplier.png"} alt={supplier.name} className="aspect-square w-full object-cover" />
          </div>
          
          {/* Supplier Info */}
          <div className="flex-1 text-center sm:text-left">
            <span className="inline-block rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-primary">
              {supplier.category}
            </span>
            <h2 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">{supplier.name}</h2>
            <p className="mt-2 text-muted">{supplier.description}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-center gap-1 text-sm text-secondary sm:justify-start">
                <MapPin size={14} />
                <span>{supplier.location}</span>
              </div>
              <SupplierDistance supplierLat={supplier.lat} supplierLng={supplier.lng} />
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <h2 className="mt-10 text-xl font-bold text-primary">
        Your Products
      </h2>

      {products.length === 0 ? (
        <p className="mt-4 text-muted">No products listed yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => {
            const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
            return (
              <div
                key={product.id}
                className={`group flex flex-col overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md ${
                  !product.inStock ? "opacity-60 grayscale" : ""
                }`}
              >
                <div className="relative aspect-square overflow-hidden bg-secondary/10">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted text-sm">No image</div>
                  )}
                  {/* Locality badge and stars overlay */}
                  <div className="absolute left-2.5 top-2 flex flex-col gap-1 items-start">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm text-center min-w-[60px]"
                      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      {product.locality}
                    </span>
                    {/* Stars overlay */}
                    {avgRatings[product.id] && (
                      <div className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 backdrop-blur-[2px] ml-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={9} className={avgRatings[product.id].avg >= s ? "fill-accent text-accent" : avgRatings[product.id].avg >= s - 0.5 ? "fill-accent/50 text-accent" : "text-white/40"} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                          ))}
                        </div>
                        <span className="text-[9px] font-semibold text-white ml-0.5">({avgRatings[product.id].count})</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-secondary">{product.supplierName}</p>
                    {!product.inStock && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Out of Stock
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-primary sm:text-base">
                    {product.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted line-clamp-2 sm:text-sm">
                    {product.description}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between sm:mt-2">
                    <span className="text-sm font-bold text-primary sm:text-lg">£{product.price.toFixed(2)}</span>
                    <span className="text-[10px] text-muted sm:text-xs">{product.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
