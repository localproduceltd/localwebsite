"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { type Supplier, type DeliveryZone, getLiveSuppliers, getCustomerProfile, getDeliveryZones, saveCustomerPostcode } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { MapPin, CheckCircle2, Clock, HelpCircle, Loader2, Search, Truck, Store, X } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";
import { PRE_LAUNCH } from "@/lib/pre-launch";

// Dynamically import Leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

type MapView = "zones" | "suppliers";
type DeliveryStatus = "live" | "not_live" | "not_covered" | null;

// Zone colors matching admin page
const ZONE_COLOR_LIVE = "#16a34a"; // green-600
const ZONE_COLOR_LAUNCHING = "#22c55e"; // green-500 (lighter green for dated launches)
const ZONE_COLOR_TBC = "#f59e0b"; // amber-500

function getZoneColor(zone: DeliveryZone): string {
  if (zone.zoneStatus === "live") return ZONE_COLOR_LIVE;
  if (zone.launchDate) return ZONE_COLOR_LAUNCHING;
  return ZONE_COLOR_TBC;
}

function formatLaunchDate(dateStr: string | null): { text: string; shortText: string; hasTBC: boolean } {
  if (!dateStr) return { text: "Launching - Date TBC", shortText: "TBC", hasTBC: true };
  const date = new Date(dateStr + "T00:00:00");
  const formatted = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return { text: `Launching ${formatted} 🚀`, shortText: formatted, hasTBC: false };
}

// Haversine distance in miles
function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapPage() {
  const { products, addItem, items, updateQuantity } = useCart();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [mapView, setMapView] = useState<MapView>("zones");
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number; postcode: string } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(null);
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);
  
  // Postcode checker state
  const [postcodeInput, setPostcodeInput] = useState("");
  const [checkingPostcode, setCheckingPostcode] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const { user } = useUser();
  const { isSignedIn, isLoaded } = useAuth();
  // Show pre-launch to signed-out users only; signed-in users see launch version
  const showPreLaunch = PRE_LAUNCH && isLoaded && !isSignedIn;

  useEffect(() => {
    Promise.all([getLiveSuppliers(), getDeliveryZones()])
      .then(([s, z]) => {
        setSuppliers(s);
        setZones(z);
      })
      .catch(console.error);
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

  // Check delivery status when customer location or zones change
  useEffect(() => {
    if (!customerLocation || zones.length === 0) {
      setDeliveryStatus(null);
      setMatchedZone(null);
      return;
    }

    // Check if customer is in any zone
    for (const zone of zones) {
      const distance = getDistanceMiles(customerLocation.lat, customerLocation.lng, zone.centreLat, zone.centreLng);
      if (distance <= zone.radiusMiles) {
        setMatchedZone(zone);
        setDeliveryStatus(zone.zoneStatus === "live" ? "live" : "not_live");
        return;
      }
    }

    // Not in any zone
    setMatchedZone(null);
    setDeliveryStatus("not_covered");
  }, [customerLocation, zones]);

  // Postcode lookup using postcodes.io
  const checkPostcode = async () => {
    if (!postcodeInput.trim()) return;
    setCheckingPostcode(true);
    setPostcodeError("");

    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeInput.trim())}`);
      const data = await res.json();

      if (data.status !== 200 || !data.result) {
        setPostcodeError("Postcode not found. Please check and try again.");
        setCheckingPostcode(false);
        return;
      }

      const { latitude, longitude, postcode } = data.result;
      setCustomerLocation({ lat: latitude, lng: longitude, postcode });

      // Save to profile if logged in
      if (user?.id) {
        await saveCustomerPostcode(user.id, postcode, latitude, longitude);
      }

      // Center map on location
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([latitude, longitude], 12);
      }
    } catch {
      setPostcodeError("Failed to check postcode. Please try again.");
    }

    setCheckingPostcode(false);
  };

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
    if (!mapRef.current || mapInstanceRef.current || !L) return;
    const map = L.map(mapRef.current).setView([53.0356, -1.6847], 10);
    mapInstanceRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    
    // Create zones layer (added first so it's behind markers)
    zonesLayerRef.current = L.layerGroup().addTo(map);
    
    // Force map to recalculate size after a short delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      zonesLayerRef.current = null;
    };
  }, []);

  // Draw delivery zones
  useEffect(() => {
    const zonesLayer = zonesLayerRef.current;
    if (!zonesLayer || !L || zones.length === 0) return;

    zonesLayer.clearLayers();

    zones.forEach((zone) => {
      const color = getZoneColor(zone);
      const radiusMetres = zone.radiusMiles * 1609.34;

      const circle = L.circle([zone.centreLat, zone.centreLng], {
        radius: radiusMetres,
        color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2,
        dashArray: zone.zoneStatus === "not_live" ? "8, 8" : undefined,
      });
      circle.addTo(zonesLayer);

      // Zone label - two lines if launching
      const launchText = zone.zoneStatus === "not_live" ? formatLaunchDate(zone.launchDate).text : "";
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          background:${color};
          color:white;
          padding:6px 12px;
          border-radius:12px;
          font-size:11px;
          font-weight:600;
          text-align:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.2);
          line-height:1.3;
        ">
          <div>${zone.name}</div>
          ${launchText ? `<div style="font-size:10px;opacity:0.9;margin-top:2px;">${launchText}</div>` : ""}
        </div>`,
        iconSize: [140, launchText ? 44 : 28],
        iconAnchor: [70, launchText ? 22 : 14],
      });
      L.marker([zone.centreLat, zone.centreLng], { icon, interactive: false }).addTo(zonesLayer);
    });
  }, [zones]);

  // Create markers layer after map init
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !L || markersLayerRef.current) return;
    markersLayerRef.current = L.layerGroup().addTo(map);
  }, [zones]); // Run after zones effect

  // Show/hide zones layer based on view
  useEffect(() => {
    const zonesLayer = zonesLayerRef.current;
    const map = mapInstanceRef.current;
    if (!zonesLayer || !map) return;

    if (mapView === "zones") {
      if (!map.hasLayer(zonesLayer)) zonesLayer.addTo(map);
    } else {
      if (map.hasLayer(zonesLayer)) map.removeLayer(zonesLayer);
    }
  }, [mapView]);

  // Update markers when view or data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !L || !markersLayer) return;

    // Clear existing markers
    markersLayer.clearLayers();

    // Only show suppliers/products when in suppliers view
    if (mapView === "suppliers") {
      // Add product markers (on-brand styling)
      productsWithCoords.forEach((product) => {
        const colors = LOCALITY_COLORS[product.locality] ?? LOCALITY_COLORS["Local"];
        const icon = L.divIcon({
          className: "product-map-marker",
          html: `
            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
              <div style="
                width:24px;height:24px;min-width:24px;
                background:#A9B67C;
                border:3px solid white;
                border-radius:50%;
                box-shadow:0 2px 6px rgba(0,0,0,0.25);
                display:flex;align-items:center;justify-content:center;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                </svg>
              </div>
              <span style="
                background:#F2EFE3;
                padding:3px 10px;
                border-radius:8px;
                font-size:11px;
                font-weight:600;
                color:#A30E4E;
                box-shadow:0 2px 6px rgba(0,0,0,0.15);
                border:1px solid #A30E4E20;
              ">${product.name}</span>
            </div>
          `,
          iconSize: [180, 28],
          iconAnchor: [12, 14],
        });
        const marker = L.marker([product.lat!, product.lng!], { icon }).addTo(markersLayer);
        const cartItem = items.find(i => i.productId === product.id);
        const isJustAdded = justAdded === product.id;
        
        let buttonHtml = '';
        if (!product.inStock) {
          buttonHtml = '<p style="margin-top:8px;font-size:11px;color:#9ca3af;font-style:italic;">Out of stock</p>';
        } else if (cartItem && !isJustAdded) {
          buttonHtml = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:6px 10px;background:#A9B67C20;border-radius:10px;">
              <button onclick="window.__mapUpdateQuantity__('${product.id}', -1)" style="
                width:30px;height:30px;border-radius:50%;background:#A9B67C;border:none;
                color:white;font-size:16px;font-weight:700;cursor:pointer;
              ">−</button>
              <span style="font-size:15px;font-weight:700;color:#A30E4E;">${cartItem.quantity}</span>
              <button onclick="window.__mapUpdateQuantity__('${product.id}', 1)" style="
                width:30px;height:30px;border-radius:50%;background:#A9B67C;border:none;
                color:white;font-size:16px;font-weight:700;cursor:pointer;
              ">+</button>
            </div>
          `;
        } else {
          buttonHtml = `
            <button onclick="window.__mapAddToCart__('${product.id}')" style="
              display:block;width:100%;margin-top:10px;padding:8px 0;
              background:${isJustAdded ? '#A9B67C' : '#A30E4E'};color:#fff;border:none;border-radius:10px;
              font-size:13px;font-weight:600;cursor:pointer;
            ">${isJustAdded ? '✓ Added!' : 'Add to Cart'}</button>
          `;
        }
        
        marker.bindPopup(`
          <div style="min-width:200px;font-family:system-ui,sans-serif;">
            <p style="font-weight:700;font-size:15px;margin:0;color:#A30E4E;">${product.name}</p>
            <p style="font-size:12px;color:#6b7280;margin:3px 0;">${product.supplierName}</p>
            <p style="font-size:14px;font-weight:700;color:#A30E4E;margin:6px 0 4px;">
              £${product.price.toFixed(2)} <span style="font-weight:400;color:#6b7280;font-size:12px;">/ ${product.unit}</span>
            </p>
            <span style="
              display:inline-block;padding:3px 10px;border-radius:999px;
              font-size:10px;font-weight:600;
              background:${colors.bg};color:${colors.text};
            ">${product.locality}</span>
            ${buttonHtml}
          </div>
        `);
      });

      // Add supplier markers (on-brand styling)
      suppliersWithCoords.forEach((supplier) => {
        const icon = L.divIcon({
          className: "product-map-marker",
          html: `
            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
              <div style="
                width:26px;height:26px;min-width:26px;
                background:#A30E4E;
                border:3px solid white;
                border-radius:8px;
                box-shadow:0 2px 6px rgba(0,0,0,0.25);
                display:flex;align-items:center;justify-content:center;
              ">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <span style="
                background:#A30E4E;
                padding:3px 10px;
                border-radius:8px;
                font-size:11px;
                font-weight:600;
                color:white;
                box-shadow:0 2px 6px rgba(0,0,0,0.2);
              ">${supplier.name}</span>
            </div>
          `,
          iconSize: [180, 30],
          iconAnchor: [13, 15],
        });
        const marker = L.marker([supplier.lat!, supplier.lng!], { icon }).addTo(markersLayer);
        marker.bindPopup(`
          <div style="min-width:200px;font-family:system-ui,sans-serif;">
            <p style="font-weight:700;font-size:15px;margin:0;color:#A30E4E;">${supplier.name}</p>
            <p style="font-size:12px;color:#6b7280;margin:3px 0;">${supplier.location}</p>
            <span style="
              display:inline-block;padding:3px 10px;border-radius:999px;
              font-size:10px;font-weight:600;
              background:#A9B67C20;color:#5a6b3f;margin-top:4px;
            ">${supplier.category}</span>
            <a href="/suppliers/${supplier.id}" style="
              display:block;width:100%;margin-top:10px;padding:8px 0;
              background:#A30E4E;color:#fff;border:none;border-radius:10px;
              font-size:13px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;
            ">View Supplier</a>
          </div>
        `);
      });
    }

    // Always show customer location marker if set (in both views)
    if (customerLocation) {
      const icon = L.divIcon({
        className: "product-map-marker",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="
              width:36px;height:36px;
              background:#A30E4E;
              border:3px solid white;
              border-radius:50%;
              box-shadow:0 3px 8px rgba(0,0,0,0.3);
              display:flex;align-items:center;justify-content:center;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const marker = L.marker([customerLocation.lat, customerLocation.lng], { icon }).addTo(markersLayer);
      marker.bindPopup(`
        <div style="min-width:140px;font-family:system-ui,sans-serif;text-align:center;">
          <p style="font-weight:700;font-size:14px;margin:0;color:#A30E4E;">Your Location</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0;">${customerLocation.postcode}</p>
        </div>
      `);
    }
  }, [mapView, productsWithCoords, suppliersWithCoords, customerLocation, items, justAdded]);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Postcode Checker */}
      <div className="rounded-xl bg-surface p-6 shadow-sm mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-primary mb-1.5">
              <MapPin size={16} className="inline mr-1.5" />
              Check if we deliver to your area
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter your postcode (e.g. DE6 1AB)"
                value={postcodeInput}
                onChange={(e) => setPostcodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && checkPostcode()}
                className="flex-1 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
              <button
                onClick={checkPostcode}
                disabled={checkingPostcode || !postcodeInput.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {checkingPostcode ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Check
              </button>
            </div>
            {postcodeError && (
              <p className="mt-2 text-sm text-red-600">{postcodeError}</p>
            )}
          </div>
        </div>

        {/* Delivery Status Banner */}
        {deliveryStatus === "live" && (
          <div className="mt-4 rounded-xl bg-green-50 border-2 border-green-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-800">Great news! We deliver to your area</p>
                <p className="text-sm text-green-700">
                  {customerLocation?.postcode} is within our {matchedZone?.name} delivery zone.
                </p>
              </div>
            </div>
          </div>
        )}

        {deliveryStatus === "not_live" && (() => {
          const launchInfo = formatLaunchDate(matchedZone?.launchDate ?? null);
          return launchInfo.hasTBC ? (
            <div className="mt-4 rounded-xl bg-amber-50 border-2 border-amber-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <Clock size={24} className="text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-800">Launching - Date TBC</p>
                  <p className="text-sm text-amber-700">
                    {customerLocation?.postcode} is in our {matchedZone?.name} zone — we're expanding here soon!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-green-50 border-2 border-green-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <Clock size={24} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-green-800">{launchInfo.text}</p>
                  <p className="text-sm text-green-700">
                    {customerLocation?.postcode} is in our {matchedZone?.name} zone — deliveries start {launchInfo.shortText}.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {deliveryStatus === "not_covered" && (
          <div className="mt-4 rounded-xl bg-gray-50 border-2 border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <HelpCircle size={24} className="text-gray-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-gray-800">Not in our delivery area yet</p>
                <p className="text-sm text-gray-600">
                  {customerLocation?.postcode} isn't covered yet, but we're expanding! 
                  <Link href="/" className="ml-1 font-semibold text-secondary hover:underline">
                    Leave a message with Carrie on the homepage
                  </Link>
                  {" "}to request delivery to your postcode.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">
            {mapView === "zones" ? "Delivery Areas" : "Suppliers & Products"}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {mapView === "zones" 
              ? "See where we deliver and check if your area is covered" 
              : "Explore our local suppliers and their products on the map"}
          </p>
        </div>
        <div className="flex items-center rounded-xl bg-surface p-1 shadow-sm">
          <button
            onClick={() => setMapView("zones")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              mapView === "zones"
                ? "bg-primary text-white shadow-sm"
                : "text-primary hover:bg-primary/10"
            }`}
          >
            <Truck size={16} />
            Delivery Areas
          </button>
          <button
            onClick={() => {
              if (showPreLaunch) {
                setShowComingSoonModal(true);
              } else {
                setMapView("suppliers");
              }
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              mapView === "suppliers"
                ? "bg-primary text-white shadow-sm"
                : "text-primary hover:bg-primary/10"
            }`}
          >
            <Store size={16} />
            Suppliers & Products
          </button>
        </div>
      </div>

      <div
        ref={mapRef}
        className="mt-6 overflow-hidden rounded-xl border border-primary/10 shadow-sm h-[400px] sm:h-[600px] w-full bg-gray-100"
        style={{ minHeight: '400px' }}
      />

      {/* Legend - changes based on view */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        {mapView === "zones" ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ background: ZONE_COLOR_LIVE }} /> Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ background: ZONE_COLOR_LAUNCHING }} /> Launching Soon
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ background: ZONE_COLOR_TBC }} /> Date TBC
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: "#A9B67C" }} /> Product
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-md border-2 border-white shadow-sm" style={{ background: "#A30E4E" }} /> Supplier
            </span>
          </>
        )}
        {customerLocation && (
          <span className="border-l border-muted/30 pl-4 flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#A30E4E" }} />
            <span>You ({customerLocation.postcode})</span>
          </span>
        )}
      </div>

      {/* Coming Soon Modal (Pre-launch) */}
      {showComingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowComingSoonModal(false)}
              className="absolute right-4 top-4 text-muted hover:text-primary transition"
            >
              <X size={20} />
            </button>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20">
                <Store size={32} className="text-secondary" />
              </div>
              <h3 className="text-xl font-bold text-primary">Coming Soon!</h3>
              <p className="mt-2 text-sm text-muted">
                Our suppliers and products will be available to browse once we launch. Check back soon!
              </p>
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
