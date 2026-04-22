"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPreLaunchSuppliers, getLiveSuppliers } from "@/lib/data";
import type { Supplier } from "@/lib/data";
import { MapPin } from "lucide-react";
import SupplierDistance from "@/components/SupplierDistance";
import { SignedOut, useAuth } from "@clerk/nextjs";
import { PRE_LAUNCH } from "@/lib/pre-launch";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { isSignedIn, isLoaded } = useAuth();
  // Show pre-launch to signed-out users only; signed-in users see launch version
  // Wait for auth to load before deciding
  const showPreLaunch = PRE_LAUNCH && isLoaded && !isSignedIn;

  useEffect(() => {
    // Pre-launch: show development_live and development_coming_soon suppliers
    // Launch: show only live suppliers
    const fetchSuppliers = showPreLaunch ? getPreLaunchSuppliers : getLiveSuppliers;
    fetchSuppliers().then(setSuppliers).catch(console.error);
  }, [showPreLaunch]);

  // Card component - clickable Link for launch, non-clickable div with tooltip for development_live in pre-launch
  const CardWrapper = ({ supplier, children }: { supplier: Supplier; children: React.ReactNode }) => {
    // Development development_live cards: non-clickable with "Products coming soon" tooltip on click
    if (showPreLaunch && supplier.status === "development_live") {
      return (
        <div
          className="group relative overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md cursor-pointer"
          onClick={() => setHoveredId(hoveredId === supplier.id ? null : supplier.id)}
        >
          {children}
          {/* Products coming soon tooltip - only on click */}
          {hoveredId === supplier.id && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
              <div className="rounded-lg bg-secondary px-3 py-1.5 text-center shadow-lg">
                <p className="text-xs font-semibold text-white">Products coming soon!</p>
              </div>
            </div>
          )}
        </div>
      );
    }
    // Development development_coming_soon cards: non-clickable, no tooltip (already has banner)
    if (showPreLaunch && supplier.status === "development_coming_soon") {
      return (
        <div className="group relative overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md cursor-default">
          {children}
        </div>
      );
    }
    // Launch mode: clickable links
    return (
      <Link
        href={`/suppliers/${supplier.id}`}
        className="group relative overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Local Suppliers</h1>
      {!showPreLaunch && (
        <p className="mt-1 text-secondary">Meet the farmers, producers and suppliers behind your produce</p>
      )}
      
      {showPreLaunch ? (
        <div className="mt-3 text-sm text-muted space-y-1">
          <p>Meet the suppliers joining Local... and some that are thinking about it! 🤞</p>
          <p>Tap Carrie the Carrot on the <Link href="/home" className="font-medium text-secondary hover:underline">homepage</Link> to let us know any favourites you&apos;d love to get delivered 🥕</p>
        </div>
      ) : (
        <SignedOut>
          <p className="mt-3 text-sm text-muted">
            <Link href="/sign-in" className="font-medium text-secondary hover:underline">Sign in</Link> to see your distance from each of our suppliers
          </p>
        </SignedOut>
      )}

      <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {suppliers.map((supplier) => (
          <CardWrapper key={supplier.id} supplier={supplier}>
            {/* Diagonal banner for development_coming_soon suppliers in pre-launch */}
            {showPreLaunch && supplier.status === "development_coming_soon" && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute top-12 -right-12 w-64 rotate-45 bg-secondary py-2 text-center shadow-lg">
                  <p className="text-sm font-bold text-white leading-tight">Stay Tuned 🤞</p>
                </div>
              </div>
            )}
            {/* Diagonal banner for launch_not_live suppliers in launch mode */}
            {!showPreLaunch && supplier.status === "launch_not_live" && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute top-6 -right-20 w-72 rotate-45 bg-gray-500 py-4 text-center shadow-lg">
                  <p className="text-lg font-bold text-white leading-tight">Not Live</p>
                </div>
              </div>
            )}
            <div className={`aspect-[3/2] overflow-hidden ${(showPreLaunch && supplier.status === "development_coming_soon") || (!showPreLaunch && supplier.status === "launch_not_live") ? "grayscale-[30%] opacity-70" : ""}`}>
              <img
                src={supplier.image || "/images/Holding Image - Supplier.png"}
                alt={supplier.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div className={`p-4 ${(showPreLaunch && supplier.status === "development_coming_soon") || (!showPreLaunch && supplier.status === "launch_not_live") ? "opacity-80" : ""}`}>
              <span className="inline-block rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {supplier.category}
              </span>
              <h2 className="mt-2 font-semibold text-primary">{supplier.name}</h2>
              <p className="mt-1 text-sm text-muted line-clamp-2">{supplier.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-secondary">
                  <MapPin size={14} />
                  <span>{supplier.location}</span>
                </div>
                <SupplierDistance supplierLat={supplier.lat} supplierLng={supplier.lng} />
              </div>
            </div>
          </CardWrapper>
        ))}
      </div>
    </div>
  );
}
