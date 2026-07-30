import { Metadata } from "next";
import { getSupplier } from "@/lib/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) {
    return { title: "Our Suppliers - Derbyshire Farmers & Producers" };
  }
  return {
    title: supplier.name,
    description: supplier.description,
  };
}

export default function SupplierDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
