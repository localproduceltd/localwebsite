import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { CartProvider } from "@/lib/cart-context";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.localproduce.ltd"),
  title: {
    default: "Local Produce - Fresh Veg Boxes & Local Food Delivery in Derbyshire",
    template: "%s | Local Produce",
  },
  description: "Order fresh fruit, veg and local food from Derbyshire farmers and producers. Order by Wednesday 7pm, delivered to your door on Friday.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Local Produce",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleAnalytics />
      </head>
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
