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
import { Plus, Pencil, Trash2, X, MapPin, UserPlus, Link2, ChevronDown, ChevronRight } from "lucide-react";
import { type SupplierStatus } from "@/lib/data";
import ImageUpload from "@/components/ImageUpload";
import MapPicker from "@/components/MapPicker";

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

const STATUS_CONFIG: Record<SupplierStatus, { label: string; color: string; bgColor: string }> = {
  launch_live: { label: "Live", color: "text-green-700", bgColor: "bg-green-100" },
  launch_not_live: { label: "Not Live", color: "text-red-600", bgColor: "bg-red-100" },
  development_live: { label: "Development Live", color: "text-blue-700", bgColor: "bg-blue-100" },
  development_coming_soon: { label: "Development Coming Soon", color: "text-amber-700", bgColor: "bg-amber-100" },
  archived: { label: "Archived", color: "text-gray-500", bgColor: "bg-gray-100" },
};

export default function AdminSuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [supplierUsers, setSupplierUsers] = useState<(SupplierUser & { supplierName: string })[]>([]);
  const [linkingSupplierId, setLinkingSupplierId] = useState<string | null>(null);
  const [linkClerkId, setLinkClerkId] = useState("");
  
  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    main: true,
    prelaunch: false,
    archived: false,
  });
  
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Group suppliers by status
  const mainSuppliers = supplierList.filter((s) => s.status === "launch_live" || s.status === "launch_not_live");
  const developmentSuppliers = supplierList.filter((s) => s.status === "development_live" || s.status === "development_coming_soon");
  const archivedSuppliers = supplierList.filter((s) => s.status === "archived");

  const fetchSuppliers = () => getSuppliers().then(setSupplierList).catch(console.error);
  const fetchSupplierUsers = () => getSupplierUsers().then(setSupplierUsers).catch(console.error);

  useEffect(() => { fetchSuppliers(); fetchSupplierUsers(); }, []);

  const handleDelete = async (id: string) => {
    const supplier = supplierList.find((s) => s.id === id);
    if (!confirm(`Are you sure you want to delete "${supplier?.name}" and all their products? This cannot be undone.`)) return;
    
    try {
      await deleteSupplier(id);
      setSupplierList((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      alert("Cannot delete this supplier. It may have orders linked to it. Please set the supplier to 'Not Live' instead.");
      console.error("Delete failed:", error);
    }
  };

  const handleSave = async (supplier: Supplier) => {
    try {
      if (editing) {
        await updateSupplier(supplier);
        setSupplierList((prev) => prev.map((s) => (s.id === supplier.id ? supplier : s)));
      } else {
        const created = await createSupplier(supplier);
        setSupplierList((prev) => [...prev, created]);
      }
      setEditing(null);
      setShowForm(false);
    } catch (error) {
      console.error("Failed to save supplier:", error);
      alert("Failed to save supplier. Please check all required fields are filled in.");
    }
  };

  const handleStatusChange = async (supplier: Supplier, newStatus: SupplierStatus) => {
    const updated = { ...supplier, status: newStatus, active: newStatus === "launch_live" };
    await updateSupplier(updated);
    setSupplierList((prev) => prev.map((s) => (s.id === supplier.id ? updated : s)));
  };

  const handleLinkUser = async () => {
    if (!linkingSupplierId || !linkClerkId.trim()) return;
    try {
      // First, fetch the Clerk user's email
      const res = await fetch(`/api/clerk-user?userId=${encodeURIComponent(linkClerkId.trim())}`);
      if (res.ok) {
        const clerkUser = await res.json();
        if (clerkUser.email) {
          // Auto-populate supplier email if not already set
          const supplier = supplierList.find((s) => s.id === linkingSupplierId);
          if (supplier && !supplier.email) {
            const updated = { ...supplier, email: clerkUser.email };
            await updateSupplier(updated);
            setSupplierList((prev) => prev.map((s) => (s.id === linkingSupplierId ? updated : s)));
          }
        }
      }
      
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
          <p className="mt-1 text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
              {mainSuppliers.filter((s) => s.status === "launch_live").length} live
            </span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400"></span>
              {mainSuppliers.filter((s) => s.status === "launch_not_live").length} not live
            </span>
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-secondary"
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

      {/* Main Suppliers Section (Live / Not Live) */}
      <div className="mt-8">
        <button
          onClick={() => toggleSection("main")}
          className="flex w-full items-center justify-between rounded-lg bg-surface px-4 py-3 text-left shadow-sm transition hover:bg-surface/80"
        >
          <div className="flex items-center gap-3">
            {expandedSections.main ? <ChevronDown size={20} className="text-primary" /> : <ChevronRight size={20} className="text-primary" />}
            <h2 className="text-lg font-semibold text-primary">Launch</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{mainSuppliers.length}</span>
          </div>
        </button>
        
        {expandedSections.main && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mainSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                supplierUsers={supplierUsers}
                onEdit={() => { setEditing(supplier); setShowForm(true); }}
                onDelete={() => handleDelete(supplier.id)}
                onStatusChange={(status) => handleStatusChange(supplier, status)}
                onLinkUser={() => { setLinkingSupplierId(supplier.id); setLinkClerkId(""); }}
                onUnlinkUser={handleUnlinkUser}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pre-launch Suppliers Section */}
      <div className="mt-6">
        <button
          onClick={() => toggleSection("prelaunch")}
          className="flex w-full items-center justify-between rounded-lg bg-surface px-4 py-3 text-left shadow-sm transition hover:bg-surface/80"
        >
          <div className="flex items-center gap-3">
            {expandedSections.prelaunch ? <ChevronDown size={20} className="text-primary" /> : <ChevronRight size={20} className="text-primary" />}
            <h2 className="text-lg font-semibold text-primary">Pre-launch</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{developmentSuppliers.length}</span>
          </div>
        </button>
        
        {expandedSections.prelaunch && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {developmentSuppliers.length === 0 ? (
              <p className="col-span-full text-sm text-muted py-4">No pre-launch suppliers yet.</p>
            ) : (
              developmentSuppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  supplierUsers={supplierUsers}
                  onEdit={() => { setEditing(supplier); setShowForm(true); }}
                  onDelete={() => handleDelete(supplier.id)}
                  onStatusChange={(status) => handleStatusChange(supplier, status)}
                  onLinkUser={() => { setLinkingSupplierId(supplier.id); setLinkClerkId(""); }}
                  onUnlinkUser={handleUnlinkUser}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Archived Suppliers Section */}
      <div className="mt-6">
        <button
          onClick={() => toggleSection("archived")}
          className="flex w-full items-center justify-between rounded-lg bg-surface px-4 py-3 text-left shadow-sm transition hover:bg-surface/80"
        >
          <div className="flex items-center gap-3">
            {expandedSections.archived ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
            <h2 className="text-lg font-semibold text-muted">Archived</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">{archivedSuppliers.length}</span>
          </div>
        </button>
        
        {expandedSections.archived && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {archivedSuppliers.length === 0 ? (
              <p className="col-span-full text-sm text-muted py-4">No archived suppliers.</p>
            ) : (
              archivedSuppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  supplierUsers={supplierUsers}
                  onEdit={() => { setEditing(supplier); setShowForm(true); }}
                  onDelete={() => handleDelete(supplier.id)}
                  onStatusChange={(status) => handleStatusChange(supplier, status)}
                  onLinkUser={() => { setLinkingSupplierId(supplier.id); setLinkClerkId(""); }}
                  onUnlinkUser={handleUnlinkUser}
                />
              ))
            )}
          </div>
        )}
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
              className="mt-3 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm font-mono outline-none focus:border-secondary"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setLinkingSupplierId(null)} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
                Cancel
              </button>
              <button
                onClick={handleLinkUser}
                disabled={!linkClerkId.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-40"
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
      status: "launch_not_live",
      email: null,
      instagram: null,
    }
  );
  const [showMapPicker, setShowMapPicker] = useState(false);

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
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
          <input
            type="email"
            placeholder="Email address (for notifications)"
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value || null })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Instagram (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
              <input
                placeholder="username"
                value={form.instagram || ""}
                onChange={(e) => setForm({ ...form, instagram: e.target.value || null })}
                className="w-full rounded-lg border border-primary/20 bg-surface pl-7 pr-3 py-2 text-sm outline-none focus:border-secondary"
              />
            </div>
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            >
              <option value="">Select category</option>
              {SUPPLIER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <ImageUpload
            currentImage={form.image}
            onImageChange={(url) => setForm({ ...form, image: url })}
            label="Supplier Image"
          />
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as SupplierStatus })}
              className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            >
              <option value="launch_live">Live</option>
              <option value="launch_not_live">Not Live</option>
              <option value="development_live">Development Live</option>
              <option value="development_coming_soon">Development Coming Soon</option>
              <option value="archived">Archived</option>
            </select>
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
            <p className="mt-1 text-xs text-muted">Click to search for location or pin it on the map</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-secondary"
          >
            {supplier ? "Save Changes" : "Add Supplier"}
          </button>
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
    </div>
  );
}

function SupplierCard({
  supplier,
  supplierUsers,
  onEdit,
  onDelete,
  onStatusChange,
  onLinkUser,
  onUnlinkUser,
}: {
  supplier: Supplier;
  supplierUsers: (SupplierUser & { supplierName: string })[];
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: SupplierStatus) => void;
  onLinkUser: () => void;
  onUnlinkUser: (id: string) => void;
}) {
  const linked = supplierUsers.find((su) => su.supplierId === supplier.id);
  const statusConfig = STATUS_CONFIG[supplier.status];

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-sm">
      <div className="relative aspect-[3/2] overflow-hidden">
        <img src={supplier.image || "/images/Holding Image - Supplier.png"} alt={supplier.name} className="h-full w-full object-cover" />
        <span className={`absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusConfig.bgColor} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
      <div className="p-4">
        <span className="inline-block rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
          {supplier.category}
        </span>
        <h3 className="mt-2 font-semibold text-primary">{supplier.name}</h3>
        <p className="mt-1 text-sm text-muted line-clamp-2">{supplier.description}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-secondary">
          <MapPin size={12} />
          <span>{supplier.location}</span>
        </div>

        {/* Status dropdown */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-muted mb-1">Status</label>
          <select
            value={supplier.status}
            onChange={(e) => onStatusChange(e.target.value as SupplierStatus)}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-secondary"
          >
            <option value="launch_live">Live</option>
            <option value="launch_not_live">Not Live</option>
            <option value="development_live">Development Live</option>
            <option value="development_coming_soon">Development Coming Soon</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Linked user info */}
        <div className="mt-3 text-xs">
          {linked ? (
            <div className="flex items-center justify-between rounded-lg bg-primary/5 px-2 py-1">
              <span className="flex items-center gap-1 text-primary"><Link2 size={11} /> Linked: <span className="font-mono text-[10px]">{linked.clerkUserId.slice(0, 16)}...</span></span>
              <button onClick={() => onUnlinkUser(linked.id)} className="text-red-500 hover:text-red-700 font-medium">Unlink</button>
            </div>
          ) : (
            <button
              onClick={onLinkUser}
              className="flex items-center gap-1 text-secondary hover:underline"
            >
              <UserPlus size={11} /> Link supplier login
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 border-t border-primary/5 pt-3">
          <button
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-secondary/20 py-1.5 text-xs font-medium text-primary transition hover:bg-secondary/30"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
