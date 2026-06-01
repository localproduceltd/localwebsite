import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/home", "/suppliers", "/products", "/map"],
        disallow: ["/admin", "/api", "/account", "/cart", "/sign-in", "/sign-up", "/checkout", "/orders", "/supplier-portal", "/auth-redirect"],
      },
    ],
    sitemap: "https://www.localproduce.ltd/sitemap.xml",
  };
}
