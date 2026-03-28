// Postcode lookup via postcodes.io (free, no API key needed) + Haversine distance

export interface PostcodeLookupResult {
  postcode: string;
  lat: number;
  lng: number;
  region: string;
  admin_district: string;
}

export async function lookupPostcode(postcode: string): Promise<PostcodeLookupResult | null> {
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 200 || !data.result) return null;
    return {
      postcode: data.result.postcode,
      lat: data.result.latitude,
      lng: data.result.longitude,
      region: data.result.region ?? "",
      admin_district: data.result.admin_district ?? "",
    };
  } catch {
    return null;
  }
}

/** Haversine distance in miles between two lat/lng points */
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
