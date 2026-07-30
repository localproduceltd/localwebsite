"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const GA_ID = "G-SL2Y5Z5VNJ";
// Admin + supplier portal usage is Josie and suppliers, not customers - keep
// it out of the analytics. The inline flag below covers direct page loads;
// this effect covers client-side navigation across the boundary.
const EXCLUDED = /^\/(admin|supplier-portal)(\/|$)/;

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = EXCLUDED.test(pathname);
  }, [pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window['ga-disable-${GA_ID}'] = /^\\/(admin|supplier-portal)(\\/|$)/.test(location.pathname);
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
