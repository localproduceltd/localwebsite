"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Product } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";

interface ProductMapProps {
  products: Product[];
  onAddToCart?: (productId: string) => void;
}

export default function ProductMap({ products, onAddToCart }: ProductMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const productsWithCoords = products.filter((p) => p.lat != null && p.lng != null);

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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    // Add markers with labels
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
              font-size:12px;
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

      const popupContent = `
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
          ${onAddToCart && product.inStock ? `<button onclick="window.__addToCart__('${product.id}')" style="
            display:block;width:100%;margin-top:8px;padding:6px 0;
            background:#829461;color:#f6f5f3;border:none;border-radius:8px;
            font-size:12px;font-weight:600;cursor:pointer;
          ">Add to Cart</button>` : ""}
        </div>
      `;

      marker.bindPopup(popupContent);
    });
  }, [productsWithCoords, onAddToCart]);

  // Expose addToCart for popup buttons
  useEffect(() => {
    if (onAddToCart) {
      (window as unknown as Record<string, unknown>).__addToCart__ = onAddToCart;
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__addToCart__;
    };
  }, [onAddToCart]);

  return (
    <div
      ref={mapRef}
      className="overflow-hidden rounded-xl border border-primary/10 shadow-sm"
      style={{ height: "500px", width: "100%" }}
    />
  );
}
