"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLiveSuppliers } from "@/lib/data";
import type { Supplier } from "@/lib/data";
import { MapPin } from "lucide-react";
import SupplierDistance from "@/components/SupplierDistance";
import { SignedOut } from "@clerk/nextjs";

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const isLive = supplier.status === "launch_live";
  
  const cardContent = (
    <>
      {/* Diagonal banner for launch_not_live suppliers */}
      {!isLive && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute top-6 -right-16 w-64 rotate-45 bg-secondary py-3 text-center shadow-lg">
            <p className="text-base font-bold text-white leading-tight">Coming Soon</p>
          </div>
        </div>
      )}
      <div className={`aspect-[3/2] overflow-hidden ${!isLive ? "grayscale-[30%] opacity-70" : ""}`}>
        <img
          src={supplier.image || "/images/Holding Image - Supplier.png"}
          alt={supplier.name}
          className={`h-full w-full object-cover ${isLive ? "transition-transform group-hover:scale-105" : ""}`}
        />
      </div>
      <div className={`p-4 ${!isLive ? "opacity-80" : ""}`}>
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
    </>
  );

  // Live suppliers are clickable, coming soon suppliers are not
  if (isLive) {
    return (
      <Link
        href={`/suppliers/${supplier.id}`}
        className="group relative overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface shadow-sm cursor-default">
      {cardContent}
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    getLiveSuppliers().then((data) => {
      // Sort alphabetically within each status group
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(sorted);
    }).catch(console.error);
  }, []);

  const liveSuppliers = suppliers.filter((s) => s.status === "launch_live");
  const comingSoonSuppliers = suppliers.filter((s) => s.status === "launch_not_live");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Local Suppliers</h1>
      <p className="mt-1 text-secondary">Meet the farmers, producers and suppliers behind your produce</p>
      
      <SignedOut>
        <p className="mt-3 text-sm text-muted">
          <Link href="/sign-in" className="font-medium text-secondary hover:underline">Sign in</Link> to see your distance from each of our suppliers
        </p>
      </SignedOut>

      {/* Live Suppliers */}
      <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {liveSuppliers.map((supplier) => (
          <SupplierCard key={supplier.id} supplier={supplier} />
        ))}
      </div>

      {/* Coming Soon Section */}
      {comingSoonSuppliers.length > 0 && (
        <>
          <div className="mt-12 mb-6">
            <h2 className="text-xl font-bold text-secondary">Coming Soon 🤞</h2>
            <p className="mt-1 text-sm text-muted">
              Got a supplier you&apos;d love to see here? Tap Carrie the Carrot and let us know! 🥕
            </p>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {comingSoonSuppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
