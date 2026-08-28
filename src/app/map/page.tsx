"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { type Supplier, type DeliveryArea, getLiveSuppliers, getCustomerProfile, getDeliveryArea, saveCustomerPostcode, submitExpansionRequest } from "@/lib/data";
import { LOCALITY_COLORS } from "@/lib/locality";
import { MapPin, CheckCircle2, HelpCircle, Loader2, Search, Truck, Store } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";

// Dynamically import Leaflet to avoid SSR issues
import type * as LType from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

let L: typeof LType | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
  require("leaflet.markercluster");
}

type MapView = "zones" | "suppliers";
type DeliveryStatus = "live" | "not_covered" | null;

const POLYGON_COLOR = "#16a34a"; // green-600

function MapPageContent() {
  const searchParams = useSearchParams();
  const { products, addItem, items, updateQuantity } = useCart();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveryArea, setDeliveryArea] = useState<DeliveryArea | null>(null);
  const initialView = searchParams.get("view") === "suppliers" ? "suppliers" : "zones";
  const [mapView, setMapView] = useState<MapView>(initialView);
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number; postcode: string } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(null);
  
  // Postcode checker state
  const [postcodeInput, setPostcodeInput] = useState("");
  const [checkingPostcode, setCheckingPostcode] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [expansionEmail, setExpansionEmail] = useState("");
  const [submittingExpansion, setSubmittingExpansion] = useState(false);
  const [expansionSubmitted, setExpansionSubmitted] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<LType.MarkerClusterGroup | null>(null);
  const customerMarkerRef = useRef<L.LayerGroup | null>(null);
  const { user } = useUser();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    Promise.all([getLiveSuppliers(), getDeliveryArea()])
      .then(([s, a]) => {
        setSuppliers(s);
        setDeliveryArea(a);
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

  // Check delivery status when customer location or delivery area changes
  useEffect(() => {
    if (!customerLocation) {
      setDeliveryStatus(null);
      return;
    }

    if (!deliveryArea) {
      setDeliveryStatus("not_covered");
      return;
    }

    // Check if customer is inside the polygon
    const customerPoint = turfPoint([customerLocation.lng, customerLocation.lat]);
    const geom = deliveryArea.polygonGeojson.type === "Feature"
      ? deliveryArea.polygonGeojson
      : { type: "Feature", geometry: deliveryArea.polygonGeojson, properties: {} };
    const inside = booleanPointInPolygon(customerPoint, geom);
    setDeliveryStatus(inside ? "live" : "not_covered");
  }, [customerLocation, deliveryArea]);

  // Postcode lookup using postcodes.io
  const checkPostcode = async () => {
    if (!postcodeInput.trim()) return;
    setCheckingPostcode(true);
    setPostcodeError("");
    setExpansionSubmitted(false);

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

  const handleExpansionRequest = async () => {
    if (!customerLocation?.postcode) return;
    setSubmittingExpansion(true);
    try {
      const email = expansionEmail.trim() || user?.primaryEmailAddress?.emailAddress || undefined;
      await submitExpansionRequest(customerLocation.postcode, email);
      setExpansionSubmitted(true);
    } catch (e) {
      console.error("Failed to submit expansion request:", e);
    }
    setSubmittingExpansion(false);
  };

  // Out-of-stock products are hidden here too (Aug 2026), matching the shop
  // and supplier pages - otherwise items a supplier had parked behind the
  // stock toggle stayed findable on the map, which was the one place they
  // could still be seen.
  const productsWithCoords = useMemo(
    () => products.filter((p) => p.inStock && p.lat != null && p.lng != null),
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
    
    // Create marker cluster group for suppliers/products
    markersLayerRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background: #A30E4E;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">${count}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    }).addTo(map);
    
    // Create separate layer for customer marker (not clustered)
    customerMarkerRef.current = L.layerGroup().addTo(map);
    
    // Force map to recalculate size after a short delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      zonesLayerRef.current = null;
      markersLayerRef.current = null;
      customerMarkerRef.current = null;
    };
  }, []);

  // Draw delivery area polygon
  useEffect(() => {
    const zonesLayer = zonesLayerRef.current;
    if (!zonesLayer || !L) return;

    zonesLayer.clearLayers();

    if (!deliveryArea) return;

    // Create GeoJSON layer for the polygon
    const geojsonFeature = deliveryArea.polygonGeojson.type === "Feature"
      ? deliveryArea.polygonGeojson
      : { type: "Feature", geometry: deliveryArea.polygonGeojson, properties: {} };

    const polygonLayer = L.geoJSON(geojsonFeature, {
      style: {
        color: POLYGON_COLOR,
        fillColor: POLYGON_COLOR,
        fillOpacity: 0.15,
        weight: 2,
      },
    });
    polygonLayer.addTo(zonesLayer);

    // Fit map to polygon bounds when in zones view
    if (mapView === "zones" && mapInstanceRef.current) {
      const bounds = polygonLayer.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [deliveryArea, mapView]);

  // Show/hide layers based on view
  useEffect(() => {
    const zonesLayer = zonesLayerRef.current;
    const markersLayer = markersLayerRef.current;
    const map = mapInstanceRef.current;
    if (!zonesLayer || !markersLayer || !map) return;

    if (mapView === "zones") {
      if (!map.hasLayer(zonesLayer)) zonesLayer.addTo(map);
      if (map.hasLayer(markersLayer)) map.removeLayer(markersLayer);
    } else {
      if (map.hasLayer(zonesLayer)) map.removeLayer(zonesLayer);
      if (!map.hasLayer(markersLayer)) markersLayer.addTo(map);
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
        if (cartItem && !isJustAdded) {
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

  }, [mapView, productsWithCoords, suppliersWithCoords, items, justAdded]);

  // Customer location marker (separate layer, always visible)
  useEffect(() => {
    const customerLayer = customerMarkerRef.current;
    if (!customerLayer || !L) return;

    customerLayer.clearLayers();

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
      const marker = L.marker([customerLocation.lat, customerLocation.lng], { icon }).addTo(customerLayer);
      marker.bindPopup(`
        <div style="min-width:140px;font-family:system-ui,sans-serif;text-align:center;">
          <p style="font-weight:700;font-size:14px;margin:0;color:#A30E4E;">Your Location</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0;">${customerLocation.postcode}</p>
        </div>
      `);
    }
  }, [customerLocation]);

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
                className="flex-1 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-base sm:text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
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
                  {customerLocation?.postcode} is within our delivery area.
                </p>
              </div>
            </div>
          </div>
        )}

        {deliveryStatus === "not_covered" && (
          <div className="mt-4 rounded-xl bg-gray-50 border-2 border-gray-200 px-5 py-4">
            <div className="flex items-start gap-3">
              <HelpCircle size={24} className="text-gray-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-gray-800">Not in our delivery area yet</p>
                {expansionSubmitted ? (
                  <div className="mt-2 flex items-center gap-2 text-green-700">
                    <CheckCircle2 size={16} className="flex-shrink-0" />
                    <p className="text-sm font-medium">Thanks! We&apos;ve noted your interest in {customerLocation?.postcode} - we&apos;ll email you the moment we deliver to your area.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      {customerLocation?.postcode} isn&apos;t covered yet, but we&apos;re expanding. Leave your email and we&apos;ll let you know the moment we reach you.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="email"
                        placeholder="Your email (optional)"
                        value={expansionEmail}
                        onChange={(e) => setExpansionEmail(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm outline-none focus:border-secondary"
                      />
                      <button
                        onClick={handleExpansionRequest}
                        disabled={submittingExpansion}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {submittingExpansion ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                        Notify me
                      </button>
                    </div>
                  </>
                )}
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
            onClick={() => setMapView("suppliers")}
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
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ background: POLYGON_COLOR }} /> Delivery Area
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

    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <MapPageContent />
    </Suspense>
  );
}
