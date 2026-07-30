import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Basket",
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
