"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, X, Search } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  onClose: () => void;
}

export default function MapPicker({ lat, lng, onLocationSelect, onClose }: MapPickerProps) {
  const [selectedLat, setSelectedLat] = useState(lat ?? 53.0356);
  const [selectedLng, setSelectedLng] = useState(lng ?? -1.6847);
  const [searchAddress, setSearchAddress] = useState("");
  const [searching, setSearching] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const handleAddressSearch = async () => {
    if (!searchAddress.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        
        setSelectedLat(latitude);
        setSelectedLng(longitude);

        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 12);
        }
      } else {
        alert("Address not found. Please try a different search.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      alert("Failed to search address. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const initialLat = lat ?? 53.0356;
      const initialLng = lng ?? -1.6847;
      
      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], lat ? 12 : 9);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const customIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
      });

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        setSelectedLat(lat);
        setSelectedLng(lng);
        marker.setLatLng([lat, lng]);
      });

      // Force map to recalculate size after modal is visible
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker position when coordinates change
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([selectedLat, selectedLng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([selectedLat, selectedLng]);
    }
  }, [selectedLat, selectedLng]);

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="w-full max-w-3xl rounded-xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary">Select Location on Map</h3>
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-primary">
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-muted mb-4">Search for an address or click on the map to set the location</p>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search address (e.g. Ashbourne, Co. Meath)"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddressSearch()}
            className="flex-1 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
          <button
            onClick={handleAddressSearch}
            disabled={searching || !searchAddress.trim()}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        
        <div ref={mapContainerRef} className="w-full rounded-lg mb-4 bg-primary/5" style={{ height: "384px", minHeight: "384px" }}></div>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={selectedLat}
              onChange={(e) => setSelectedLat(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={selectedLng}
              onChange={(e) => setSelectedLng(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onLocationSelect(selectedLat, selectedLng);
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <MapPin size={16} />
            Set Location
          </button>
        </div>
      </div>
    </div>
  );
}
