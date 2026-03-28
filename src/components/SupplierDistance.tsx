"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getCustomerProfile } from "@/lib/data";
import { distanceMiles } from "@/lib/postcode";
import { MapPin } from "lucide-react";

interface Props {
  supplierLat: number | null;
  supplierLng: number | null;
}

export default function SupplierDistance({ supplierLat, supplierLng }: Props) {
  const { user } = useUser();
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!user || supplierLat == null || supplierLng == null) return;
    getCustomerProfile(user.id).then((profile) => {
      if (profile?.lat && profile?.lng) {
        setDistance(distanceMiles(profile.lat, profile.lng, supplierLat, supplierLng));
      }
    }).catch(console.error);
  }, [user, supplierLat, supplierLng]);

  if (distance === null) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary">
      <MapPin size={10} />
      {distance.toFixed(1)} mi
    </span>
  );
}
