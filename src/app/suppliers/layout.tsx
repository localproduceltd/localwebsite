import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Suppliers - Derbyshire Farmers & Producers",
  description: "Meet the Derbyshire farmers, growers and artisan producers behind your weekly local produce delivery.",
};

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
