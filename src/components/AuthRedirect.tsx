"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getSupplierUser } from "@/lib/data";

export function AuthRedirect() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const handleRedirect = async () => {
      // Check if user is admin
      const role = (user.publicMetadata as { role?: string })?.role;
      if (role === "admin") {
        router.push("/admin");
        return;
      }

      // Check if user is a supplier
      try {
        const supplierUser = await getSupplierUser(user.id);
        if (supplierUser) {
          router.push("/supplier-portal");
          return;
        }
      } catch (error) {
        console.error("Error checking supplier user:", error);
      }

      // Default: customer - stay on homepage or go to products
      // Already on homepage, no redirect needed
    };

    handleRedirect();
  }, [isLoaded, user, router]);

  return null;
}
