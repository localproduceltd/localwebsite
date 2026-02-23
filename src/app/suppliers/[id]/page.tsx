import Link from "next/link";
import { getSupplier, getProductsBySupplier } from "@/lib/data";
import { MapPin, ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  const products = await getProductsBySupplier(id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/suppliers" className="inline-flex items-center gap-1 text-sm font-medium text-primary-light hover:underline">
        <ArrowLeft size={16} /> Back to Suppliers
      </Link>

      {/* Supplier header */}
      <div className="mt-6 overflow-hidden rounded-xl bg-surface shadow-sm">
        <div className="aspect-[3/1] overflow-hidden">
          <img src={supplier.image} alt={supplier.name} className="h-full w-full object-cover" />
        </div>
        <div className="p-6">
          <span className="inline-block rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-primary">
            {supplier.category}
          </span>
          <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">{supplier.name}</h1>
          <p className="mt-2 text-muted">{supplier.description}</p>
          <div className="mt-3 flex items-center gap-1 text-sm text-primary-light">
            <MapPin size={14} />
            <span>{supplier.location}</span>
          </div>
        </div>
      </div>

      {/* Products */}
      <h2 className="mt-10 text-xl font-bold text-primary">
        Products from {supplier.name}
      </h2>

      {products.length === 0 ? (
        <p className="mt-4 text-muted">No products listed yet.</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
