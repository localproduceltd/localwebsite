import Link from "next/link";
import { getSuppliers } from "@/lib/data";
import { MapPin } from "lucide-react";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Our Suppliers</h1>
      <p className="mt-1 text-muted">Meet the local farmers and producers behind your food</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((supplier) => (
          <Link
            key={supplier.id}
            href={`/suppliers/${supplier.id}`}
            className="group overflow-hidden rounded-xl bg-surface shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-[3/2] overflow-hidden">
              <img
                src={supplier.image}
                alt={supplier.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <span className="inline-block rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {supplier.category}
              </span>
              <h2 className="mt-2 text-lg font-semibold text-primary">{supplier.name}</h2>
              <p className="mt-1 text-sm text-muted line-clamp-2">{supplier.description}</p>
              <div className="mt-3 flex items-center gap-1 text-sm text-primary-light">
                <MapPin size={14} />
                <span>{supplier.location}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
