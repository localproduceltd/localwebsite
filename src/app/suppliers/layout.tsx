import { Metadata } from "next";

export const metadata: Metadata = {
  // A string title here would break the "%s | Local Produce" template chain
  // for the per-supplier child pages, so both are set explicitly.
  title: {
    default: "Our Suppliers - Derbyshire Farmers & Producers",
    template: "%s | Local Produce",
  },
  description: "Meet the Derbyshire farmers, growers and artisan producers behind your weekly local produce delivery.",
};

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
