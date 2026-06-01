import { MetadataRoute } from "next";
import { getSuppliers, getProducts } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.localproduce.ltd";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/home`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/suppliers`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Dynamic supplier pages
  let supplierPages: MetadataRoute.Sitemap = [];
  try {
    const suppliers = await getSuppliers();
    supplierPages = suppliers
      .filter((s) => s.status === "launch_live")
      .map((supplier) => ({
        url: `${baseUrl}/suppliers/${supplier.id}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch (error) {
    console.error("Failed to fetch suppliers for sitemap:", error);
  }

  return [...staticPages, ...supplierPages];
}
