"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { getSupplierUser } from "@/lib/data";

export default function AuthRedirectPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.replace("/home");
      return;
    }

    const redirect = async () => {
      // Check if admin
      const role = user.publicMetadata?.role as string | undefined;
      if (role === "admin") {
        router.replace("/admin");
        return;
      }

      // Check if supplier
      const supplierUser = await getSupplierUser(user.id);
      if (supplierUser) {
        router.replace("/supplier-portal");
        return;
      }

      // Default: customer goes to home
      router.replace("/home");
    };

    redirect();
  }, [user, isLoaded, router]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-muted">Redirecting...</p>
      </div>
    </div>
  );
}
