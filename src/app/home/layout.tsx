import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fresh Veg Boxes & Local Food Delivery in Derbyshire",
  description: "Order fresh fruit, veg and local food from Derbyshire farmers and producers. Order by Wednesday 7pm, delivered to your door on Friday.",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
