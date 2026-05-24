"use client";

import { useState, useEffect, useRef } from "react";
import { getDeliveryArea, saveDeliveryArea, deleteDeliveryArea, type DeliveryArea } from "@/lib/data";
import { MapPin, Save, Loader2, Trash2, Check, AlertCircle } from "lucide-react";

// Dynamically import Leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

const POLYGON_COLOR = "#16a34a"; // green-600

function normalizeGeojson(input: any): { geometry: any; error: string | null } {
  if (!input || typeof input !== "object") {
    return { geometry: null, error: "Invalid JSON" };
  }

  let geometry = input;

  // If FeatureCollection, take first feature
  if (input.type === "FeatureCollection") {
    if (!input.features || input.features.length === 0) {
      return { geometry: null, error: "FeatureCollection has no features" };
    }
    geometry = input.features[0];
  }

  // If Feature, extract geometry
  if (geometry.type === "Feature") {
    geometry = geometry.geometry;
  }

  // Validate geometry type
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
    return { geometry: null, error: `Expected Polygon or MultiPolygon, got ${geometry?.type || "unknown"}` };
  }

  return { geometry, error: null };
}

export default function AdminDeliveryPage() {
  const [area, setArea] = useState<DeliveryArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [geojsonInput, setGeojsonInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.GeoJSON | null>(null);

  // Load existing area
  useEffect(() => {
    getDeliveryArea()
      .then((a) => {
        setArea(a);
        if (a) {
          setGeojsonInput(JSON.stringify(a.polygonGeojson, null, 2));
          setPreviewGeometry(a.polygonGeojson);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Init map
  useEffect(() => {
    if (loading || !mapRef.current || !L) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([53.02, -1.6], 9);
      mapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [loading]);

  // Update polygon layer when preview changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    // Remove existing polygon layer
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }

    if (!previewGeometry) return;

    // Create GeoJSON layer
    const geojsonFeature = previewGeometry.type === "Feature" 
      ? previewGeometry 
      : { type: "Feature", geometry: previewGeometry, properties: {} };

    const layer = L.geoJSON(geojsonFeature, {
      style: {
        color: POLYGON_COLOR,
        fillColor: POLYGON_COLOR,
        fillOpacity: 0.15,
        weight: 2,
      },
    }).addTo(map);

    polygonLayerRef.current = layer;

    // Fit bounds
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [previewGeometry]);

  const handleValidate = () => {
    setParseError(null);

    let parsed;
    try {
      parsed = JSON.parse(geojsonInput);
    } catch {
      setParseError("Invalid JSON syntax");
      setPreviewGeometry(null);
      return;
    }

    const { geometry, error } = normalizeGeojson(parsed);
    if (error) {
      setParseError(error);
      setPreviewGeometry(null);
      return;
    }

    setPreviewGeometry(geometry);
  };

  const handleSave = async () => {
    if (!previewGeometry) return;
    setSaving(true);
    try {
      await saveDeliveryArea(previewGeometry);
      const updated = await getDeliveryArea();
      setArea(updated);
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save: " + (err instanceof Error ? err.message : String(err)));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete the delivery area? Customers will see 'not covered' until you set a new one.")) return;
    setSaving(true);
    try {
      await deleteDeliveryArea();
      setArea(null);
      setGeojsonInput("");
      setPreviewGeometry(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete: " + (err instanceof Error ? err.message : String(err)));
    }
    setSaving(false);
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
          <h1 className="text-2xl font-bold text-primary">Delivery Area</h1>
          <p className="text-sm text-muted">
            {area 
              ? `Delivery area set (last updated: ${new Date(area.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })})`
              : "No delivery area set — paste GeoJSON below to set one."
            }
          </p>
        </div>
      </div>

      {/* Map preview */}
      <div className="mt-6 rounded-xl bg-surface p-4 shadow-sm">
        <div
          ref={mapRef}
          className="overflow-hidden rounded-xl border border-primary/10 h-[350px] w-full bg-gray-100"
          style={{ minHeight: "350px" }}
        />
      </div>

      {/* GeoJSON input */}
      <div className="mt-6 rounded-xl bg-surface p-6 shadow-sm">
        <label className="block text-sm font-semibold text-primary">Polygon GeoJSON</label>
        <textarea
          value={geojsonInput}
          onChange={(e) => setGeojsonInput(e.target.value)}
          placeholder='{"type": "Polygon", "coordinates": [[[lng, lat], ...]]}'
          className="mt-2 w-full rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm font-mono outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20 h-48 resize-y"
        />
        <p className="mt-2 text-xs text-muted">
          Generate a drive-time polygon at{" "}
          <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
            Mapbox Isochrone API
          </a>
          , or draw one at{" "}
          <a href="https://geojson.io" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
            geojson.io
          </a>
          {" "}and paste the result here. Accepts Polygon or MultiPolygon.
        </p>

        {parseError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={16} />
            {parseError}
          </div>
        )}

        {previewGeometry && !parseError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <Check size={16} />
            Valid {previewGeometry.type} — preview updated on map
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleValidate}
            disabled={!geojsonInput.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            Validate & preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !previewGeometry}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save area
          </button>
          {area && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete area
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
