"use client";

import { useState, useEffect, useRef } from "react";
import {
  type DeliveryZone,
  type ZoneStatus,
  getDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
} from "@/lib/data";
import { MapPin, Save, Loader2, Plus, Trash2, Pencil, X } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import Leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

const ZONE_COLOR_LIVE = "#16a34a"; // green-600
const ZONE_COLOR_LAUNCHING = "#22c55e"; // green-500 (lighter green for dated launches)
const ZONE_COLOR_TBC = "#f59e0b"; // amber-500

function getZoneColor(zone: DeliveryZone): string {
  if (zone.zoneStatus === "live") return ZONE_COLOR_LIVE;
  if (zone.launchDate) return ZONE_COLOR_LAUNCHING;
  return ZONE_COLOR_TBC;
}

function formatLaunchDate(dateStr: string | null): { text: string; hasTBC: boolean } {
  if (!dateStr) return { text: "Launching - Date TBC", hasTBC: true };
  const date = new Date(dateStr + "T00:00:00");
  const formatted = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return { text: `Launching ${formatted} 🚀`, hasTBC: false };
}

export default function AdminDeliveryPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/edit form state
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [formName, setFormName] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formRadius, setFormRadius] = useState("5");
  const [formStatus, setFormStatus] = useState<ZoneStatus>("live");
  const [formLaunchDate, setFormLaunchDate] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Load zones
  useEffect(() => {
    getDeliveryZones()
      .then(setZones)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Init map + draw zones (re-runs when loading finishes or zones change)
  useEffect(() => {
    console.log('Map init check:', { loading, hasMapRef: !!mapRef.current, hasL: !!L });
    if (loading || !mapRef.current || !L) return;

    // Create map if it doesn't exist yet
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([53.02, -1.6], 10);
      mapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layersRef.current = L.layerGroup().addTo(map);
      
      // Force map to recalculate size after a short delay
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }

    const map = mapInstanceRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    // Clear and redraw all zones
    layers.clearLayers();

    if (zones.length === 0) return;

    const bounds = L.latLngBounds([]);

    zones.forEach((zone) => {
      const color = getZoneColor(zone);
      const radiusMetres = zone.radiusMiles * 1609.34;

      const circle = L.circle([zone.centreLat, zone.centreLng], {
        radius: radiusMetres,
        color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 2,
      });
      circle.addTo(layers);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([zone.centreLat, zone.centreLng], { icon })
        .bindTooltip(zone.name, { permanent: true, direction: "top", offset: [0, -10], className: "font-semibold" })
        .addTo(layers);

      bounds.extend(circle.getBounds());
    });

    map.fitBounds(bounds, { padding: [30, 30] });
  }, [loading, zones]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setEditing(null);
    setFormName("");
    setFormLat("");
    setFormLng("");
    setFormRadius("5");
    setFormStatus("live");
    setFormLaunchDate("");
    setShowForm(false);
  };

  const startEdit = (zone: DeliveryZone) => {
    setEditing(zone);
    setFormName(zone.name);
    setFormLat(zone.centreLat.toString());
    setFormLng(zone.centreLng.toString());
    setFormRadius(zone.radiusMiles.toString());
    setFormStatus(zone.zoneStatus);
    setFormLaunchDate(zone.launchDate ?? "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formLat || !formLng || !formRadius) return;
    setFormSaving(true);
    try {
      const data = {
        name: formName.trim(),
        centreLat: parseFloat(formLat),
        centreLng: parseFloat(formLng),
        radiusMiles: parseFloat(formRadius),
        zoneStatus: formStatus,
        launchDate: formStatus === "not_live" && formLaunchDate ? formLaunchDate : null,
      };

      if (editing) {
        await updateDeliveryZone({ id: editing.id, ...data });
        setZones((prev) => prev.map((z) => (z.id === editing.id ? { id: editing.id, ...data } : z)));
      } else {
        const created = await createDeliveryZone(data);
        setZones((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      console.error("Zone save error:", err);
      alert("Failed to save zone: " + (err instanceof Error ? err.message : String(err)));
    }
    setFormSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this delivery zone?")) return;
    try {
      await deleteDeliveryZone(id);
      setZones((prev) => prev.filter((z) => z.id !== id));
      if (editing?.id === id) resetForm();
    } catch (err) {
      console.error(err);
      alert("Failed to delete zone");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MapPin size={24} className="text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-primary">Delivery Zones</h1>
          <p className="text-sm text-secondary">Manage your delivery areas — customers in any zone will see &quot;We deliver to your area&quot;</p>
        </div>
      </div>

      {/* Map */}
      <div className="mt-6 rounded-xl bg-surface p-4 shadow-sm">
        <div
          ref={mapRef}
          className="overflow-hidden rounded-xl border border-primary/10 h-[400px] w-full bg-gray-100"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Zone list */}
      <div className="mt-6 space-y-3">
        {zones.map((zone, i) => (
          <div
            key={zone.id}
            className="flex items-center justify-between rounded-xl bg-surface px-5 py-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-4 w-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: getZoneColor(zone) }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-primary">{zone.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    zone.zoneStatus === "live" 
                      ? "bg-green-600 text-white" 
                      : formatLaunchDate(zone.launchDate).hasTBC
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                  }`}>
                    {zone.zoneStatus === "live" ? "Live" : formatLaunchDate(zone.launchDate).text}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {zone.radiusMiles} mile radius · {zone.centreLat.toFixed(4)}, {zone.centreLng.toFixed(4)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startEdit(zone)}
                className="rounded-lg p-2 text-muted transition hover:bg-secondary/10 hover:text-primary"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(zone.id)}
                className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {zones.length === 0 && !showForm && (
          <p className="text-center text-sm text-muted py-8">No delivery zones yet. Add your first zone below.</p>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm ? (
        <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">
              {editing ? `Edit ${editing.name}` : "Add Delivery Zone"}
            </h2>
            <button onClick={resetForm} className="text-muted hover:text-primary transition">
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary">Zone Name</label>
              <input
                type="text"
                placeholder="e.g. Ashbourne"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary">Radius (miles)</label>
              <input
                type="number"
                step="0.5"
                value={formRadius}
                onChange={(e) => setFormRadius(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary">Centre Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary">Centre Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary">Status</label>
              <div className="mt-1.5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormStatus("live")}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    formStatus === "live"
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setFormStatus("not_live")}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    formStatus === "not_live"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  Not Live
                </button>
              </div>
            </div>
            {formStatus === "not_live" && (
              <div>
                <label className="block text-sm font-medium text-primary">Launch Date</label>
                <input
                  type="date"
                  value={formLaunchDate}
                  onChange={(e) => setFormLaunchDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
                <p className="mt-1 text-xs text-muted">When will deliveries start in this zone? Leave blank for TBC.</p>
              </div>
            )}
            <p className="text-xs text-muted">
              Right-click a location in Google Maps and copy the coordinates.
            </p>
            <button
              onClick={handleSave}
              disabled={formSaving || !formName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {formSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editing ? "Update Zone" : "Add Zone"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/90"
        >
          <Plus size={16} /> Add Delivery Zone
        </button>
      )}
    </div>
  );
}
