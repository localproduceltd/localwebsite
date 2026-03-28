import Link from "next/link";
import { getActiveSuppliers } from "@/lib/data";
import { MapPin } from "lucide-react";
import SupplierDistance from "@/components/SupplierDistance";
import { SignedOut } from "@clerk/nextjs";

export default async function SuppliersPage() {
  const suppliers = await getActiveSuppliers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Local Suppliers</h1>
      <p className="mt-1 text-secondary">Meet the farmers, producers and suppliers behind your produce</p>
      
      <SignedOut>
        <p className="mt-3 text-sm text-muted">
          <Link href="/sign-in" className="font-medium text-secondary hover:underline">Sign in</Link> to see your distance from each of our suppliers
        </p>
      </SignedOut>

      <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {suppliers.map((supplier) => (
          <Link
            key={supplier.id}
            href={`/suppliers/${supplier.id}`}
            className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-[3/2] overflow-hidden">
              <img
                src={supplier.image || "/images/Holding Image - Supplier.png"}
                alt={supplier.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-4">
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
          </Link>
        ))}
      </div>
    </div>
  );
}
