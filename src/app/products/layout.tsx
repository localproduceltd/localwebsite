import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Local Produce - Fresh Fruit, Veg & More",
  description: "Browse fresh local produce from Derbyshire suppliers - fruit, veg, eggs and more, delivered every Friday.",
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
