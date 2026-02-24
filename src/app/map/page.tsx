"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCart } from "@/lib/cart-context";
import { type Supplier, getActiveSuppliers } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { ShoppingBag, Package, Layers } from "lucide-react";

type FilterMode = "both" | "products" | "suppliers";

export default function MapPage() {
  const { products, addItem } = useCart();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState<FilterMode>("both");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    getActiveSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  const productsWithCoords = useMemo(
    () => products.filter((p) => p.lat != null && p.lng != null),
    [products]
  );
  const suppliersWithCoords = useMemo(
    () => suppliers.filter((s) => s.lat != null && s.lng != null),
    [suppliers]
  );

  // Initialise map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current).setView([53.0167, -1.7333], 10);
    mapInstanceRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when filter or data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    // Add product markers
    if (filter === "both" || filter === "products") {
      productsWithCoords.forEach((product) => {
        const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
        const icon = L.divIcon({
          className: "product-map-marker",
          html: `
            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
              <div style="
                width:20px;height:20px;min-width:20px;
                background:${colors.dot};
                border:2px solid white;
                border-radius:50%;
                box-shadow:0 2px 4px rgba(0,0,0,0.3);
              "></div>
              <span style="
                background:white;
                padding:2px 8px;
                border-radius:6px;
                font-size:11px;
                font-weight:600;
                color:#829461;
                box-shadow:0 1px 4px rgba(0,0,0,0.15);
                line-height:1.3;
              ">${product.name}</span>
            </div>
          `,
          iconSize: [150, 24],
          iconAnchor: [10, 12],
        });
        const marker = L.marker([product.lat!, product.lng!], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui,sans-serif;">
            <p style="font-weight:700;font-size:14px;margin:0;color:#829461;">${product.name}</p>
            <p style="font-size:12px;color:#6b7280;margin:2px 0;">${product.supplierName}</p>
            <p style="font-size:13px;font-weight:600;color:#829461;margin:4px 0 2px;">
              £${product.price.toFixed(2)} <span style="font-weight:400;color:#6b7280;">/ ${product.unit}</span>
            </p>
            <span style="
              display:inline-block;padding:2px 8px;border-radius:999px;
              font-size:10px;font-weight:600;
              background:${colors.bg};color:${colors.text};margin-top:4px;
            ">${product.locality}</span>
            ${product.inStock ? `<button onclick="window.__mapAddToCart__('${product.id}')" style="
              display:block;width:100%;margin-top:8px;padding:6px 0;
              background:#829461;color:#f6f5f3;border:none;border-radius:8px;
              font-size:12px;font-weight:600;cursor:pointer;
            ">Add to Cart</button>` : ""}
          </div>
        `);
      });
    }

    // Add supplier markers
    if (filter === "both" || filter === "suppliers") {
      suppliersWithCoords.forEach((supplier) => {
        const icon = L.divIcon({
          className: "product-map-marker",
          html: `
            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
              <div style="
                width:22px;height:22px;min-width:22px;
                background:#829461;
                border:2px solid white;
                border-radius:6px;
                box-shadow:0 2px 4px rgba(0,0,0,0.3);
                display:flex;align-items:center;justify-content:center;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                </svg>
              </div>
              <span style="
                background:#829461;
                padding:2px 8px;
                border-radius:6px;
                font-size:11px;
                font-weight:600;
                color:white;
                box-shadow:0 1px 4px rgba(0,0,0,0.15);
                line-height:1.3;
              ">${supplier.name}</span>
            </div>
          `,
          iconSize: [160, 26],
          iconAnchor: [11, 13],
        });
        const marker = L.marker([supplier.lat!, supplier.lng!], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui,sans-serif;">
            <p style="font-weight:700;font-size:14px;margin:0;color:#829461;">${supplier.name}</p>
            <p style="font-size:12px;color:#6b7280;margin:2px 0;">${supplier.location}</p>
            <span style="
              display:inline-block;padding:2px 8px;border-radius:999px;
              font-size:10px;font-weight:600;
              background:#dcfce7;color:#166534;margin-top:4px;
            ">${supplier.category}</span>
            <a href="/suppliers/${supplier.id}" style="
              display:block;width:100%;margin-top:8px;padding:6px 0;
              background:#829461;color:#f6f5f3;border:none;border-radius:8px;
              font-size:12px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;
            ">View Supplier</a>
          </div>
        `);
      });
    }
  }, [filter, productsWithCoords, suppliersWithCoords]);

  // Expose addToCart for popup buttons
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__mapAddToCart__ = (id: string) => addItem(id);
    return () => {
      delete (window as unknown as Record<string, unknown>).__mapAddToCart__;
    };
  }, [addItem]);

  const filterOptions: { mode: FilterMode; label: string; icon: typeof Layers }[] = [
    { mode: "both", label: "All", icon: Layers },
    { mode: "products", label: "Products", icon: Package },
    { mode: "suppliers", label: "Suppliers", icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Map</h1>
          <p className="mt-1 text-muted">Explore local products and suppliers across Derbyshire</p>
        </div>
        <div className="flex items-center gap-2">
          {filterOptions.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filter === mode
                  ? "bg-primary text-background"
                  : "bg-secondary/20 text-primary hover:bg-secondary/30"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={mapRef}
        className="mt-6 overflow-hidden rounded-xl border border-primary/10 shadow-sm"
        style={{ height: "600px", width: "100%" }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-[#22c55e] border border-white shadow-sm" /> Own Produce
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-[#3b82f6] border border-white shadow-sm" /> Local
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-[#f59e0b] border border-white shadow-sm" /> Regional
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#829461] border border-white shadow-sm" /> Supplier
        </span>
      </div>
    </div>
  );
}
