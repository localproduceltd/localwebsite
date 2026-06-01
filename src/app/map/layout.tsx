import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delivery Areas - Check If We Deliver to You",
  description: "Check whether we deliver fresh local produce to your area across Derbyshire. Enter your postcode to see.",
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
