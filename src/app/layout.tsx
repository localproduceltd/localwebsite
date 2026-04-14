import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Produce Ltd",
  description: "Fresh local produce delivered to your door from trusted local suppliers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${raleway.variable} antialiased bg-surface text-foreground`}>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#8E9F68",
            },
          }}
        >
          <CartProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
          </CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
