"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCart } from "@/lib/cart-context";
import { type Supplier, getActiveSuppliers, getCustomerProfile } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { ShoppingBag, Package, Layers } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type FilterMode = "both" | "products" | "suppliers";

export default function MapPage() {
  const { products, addItem, items, updateQuantity } = useCart();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState<FilterMode>("both");
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number; postcode: string } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const { user } = useUser();

  useEffect(() => {
    getActiveSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => {
    if (user?.id) {
      getCustomerProfile(user.id).then((profile) => {
        if (profile?.lat && profile?.lng && profile?.postcode) {
          setCustomerLocation({ lat: profile.lat, lng: profile.lng, postcode: profile.postcode });
        }
      }).catch(console.error);
    }
  }, [user]);

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
    const map = L.map(mapRef.current).setView([53.0356, -1.6847], 12);
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
                background:#f7f5ef;
                padding:2px 8px;
                border-radius:6px;
                font-size:11px;
                font-weight:600;
                color:#A30E4E;
                box-shadow:0 1px 4px rgba(0,0,0,0.15);
                line-height:1.3;
              ">${product.name}</span>
            </div>
          `,
          iconSize: [150, 24],
          iconAnchor: [10, 12],
        });
        const marker = L.marker([product.lat!, product.lng!], { icon }).addTo(map);
        const cartItem = items.find(i => i.productId === product.id);
        const isJustAdded = justAdded === product.id;
        
        let buttonHtml = '';
        if (!product.inStock) {
          buttonHtml = '';
        } else if (cartItem && !isJustAdded) {
          buttonHtml = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:6px 8px;background:#A30E4E15;border-radius:8px;">
              <button onclick="window.__mapUpdateQuantity__('${product.id}', -1)" style="
                width:32px;height:32px;border-radius:50%;background:#8E9F6833;border:none;
                color:#A30E4E;font-size:18px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;
              ">−</button>
              <span style="font-size:14px;font-weight:600;color:#A30E4E;">${cartItem.quantity}</span>
              <button onclick="window.__mapUpdateQuantity__('${product.id}', 1)" style="
                width:32px;height:32px;border-radius:50%;background:#8E9F6833;border:none;
                color:#A30E4E;font-size:18px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;
              ">+</button>
            </div>
          `;
        } else {
          buttonHtml = `
            <button onclick="window.__mapAddToCart__('${product.id}')" style="
              display:block;width:100%;margin-top:8px;padding:6px 0;
              background:${isJustAdded ? '#8E9F68' : '#A30E4E'};color:#fff;border:none;border-radius:8px;
              font-size:12px;font-weight:600;cursor:pointer;
            ">${isJustAdded ? '✓ Added!' : 'Add to Cart'}</button>
          `;
        }
        
        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui,sans-serif;">
            <p style="font-weight:700;font-size:14px;margin:0;color:#A30E4E;">${product.name}</p>
            <p style="font-size:12px;color:#6b7280;margin:2px 0;">${product.supplierName}</p>
            <p style="font-size:13px;font-weight:600;color:#A30E4E;margin:4px 0 2px;">
              £${product.price.toFixed(2)} <span style="font-weight:400;color:#6b7280;">/ ${product.unit}</span>
            </p>
            <span style="
              display:inline-block;padding:2px 8px;border-radius:999px;
              font-size:10px;font-weight:600;
              background:${colors.bg};color:${colors.text};margin-top:4px;
            ">${product.locality}</span>
            ${buttonHtml}
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
                background:#A30E4E;
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
                background:#A30E4E;
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
            <p style="font-weight:700;font-size:14px;margin:0;color:#A30E4E;">${supplier.name}</p>
            <p style="font-size:12px;color:#6b7280;margin:2px 0;">${supplier.location}</p>
            <span style="
              display:inline-block;padding:2px 8px;border-radius:999px;
              font-size:10px;font-weight:600;
              background:#dcfce7;color:#166534;margin-top:4px;
            ">${supplier.category}</span>
            <a href="/suppliers/${supplier.id}" style="
              display:block;width:100%;margin-top:8px;padding:6px 0;
              background:#A30E4E;color:#fff;border:none;border-radius:8px;
              font-size:12px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;
            ">View Supplier</a>
          </div>
        `);
      });
    }

    // Add customer location marker
    if (customerLocation) {
      const icon = L.divIcon({
        className: "product-map-marker",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#A30E4E" stroke="white" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      const marker = L.marker([customerLocation.lat, customerLocation.lng], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:120px;font-family:system-ui,sans-serif;text-align:center;">
          <p style="font-weight:700;font-size:13px;margin:0;color:#A30E4E;">Your Location</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0;">${customerLocation.postcode}</p>
        </div>
      `);
    }
  }, [filter, productsWithCoords, suppliersWithCoords, customerLocation, items, justAdded]);

  // Expose cart functions for popup buttons
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__mapAddToCart__ = (id: string) => {
      addItem(id);
      setJustAdded(id);
      setTimeout(() => setJustAdded(null), 1200);
    };
    (window as unknown as Record<string, unknown>).__mapUpdateQuantity__ = (id: string, delta: number) => {
      updateQuantity(id, delta);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__mapAddToCart__;
      delete (window as unknown as Record<string, unknown>).__mapUpdateQuantity__;
    };
  }, [addItem, updateQuantity]);

  const filterOptions: { mode: FilterMode; label: string; icon: typeof Layers }[] = [
    { mode: "both", label: "All", icon: Layers },
    { mode: "products", label: "Products", icon: Package },
    { mode: "suppliers", label: "Suppliers", icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">Map</h1>
          <p className="mt-1 text-sm text-secondary">See where our local suppliers are based and where their produce comes from</p>
        </div>
        <div className="flex items-center gap-2">
          {filterOptions.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                filter === mode
                  ? "bg-primary text-background"
                  : "bg-secondary/20 text-primary hover:bg-secondary/30"
              }`}
            >
              <Icon size={14} className="sm:h-4 sm:w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={mapRef}
        className="mt-6 overflow-hidden rounded-xl border border-primary/10 shadow-sm h-[400px] sm:h-[600px]"
      />

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: "#5a7a3d" }} /> Own Produce
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: "#6b7f52" }} /> Local
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: "#8E9F68" }} /> Regional
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: "#9b8a70" }} /> UK
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: "#FF9310" }} /> International
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#A30E4E] border border-white shadow-sm" /> Supplier
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#A30E4E" stroke="white" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>You on the map</span>
        </span>
      </div>
    </div>
  );
}
