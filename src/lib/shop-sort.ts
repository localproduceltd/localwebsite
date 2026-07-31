// Shop product ordering - shared by /products and /suppliers/[id].
//
// The shop sorts in two bands:
//  - Top band: anything ordered or reviewed in the last 14 days (the
//    recent_* counts from products_with_stats), plus anything a supplier has
//    featured. Round-robined one-product-per-supplier so no one floods the
//    top, with a nudge so two products of the same category don't sit next
//    to each other. Supplier turn order rotates weekly.
//  - Bottom band: everything else, interleaved by category with locality
//    priority (local first) - unchanged from the original shop sort.

import type { Product } from "./data";

// Own Produce/Local/Regional = 0, UK = 1, International = 2, TBC = 3
const LOCALITY_PRIORITY: Record<string, number> = {
  "Own Produce": 0, "Local": 0, "Regional": 0, "UK": 1, "International": 2, "TBC": 3,
};

const isFeatured = (p: Product) => p.featuredAt != null;

const hasRecentActivity = (p: Product) =>
  (p.recentOrderCount ?? 0) > 0 || (p.recentRatingCount ?? 0) > 0 || isFeatured(p);

// Changes every Monday; stable within the week so the page doesn't reshuffle
// mid-browse. Epoch day 0 (1 Jan 1970) was a Thursday, so +3 aligns the
// 7-day buckets to Monday boundaries.
function currentWeekNumber(): number {
  const days = Math.floor(Date.now() / 86_400_000);
  return Math.floor((days + 3) / 7);
}

// Deterministic per-week ordering key for a string id (djb2 hash of id+week).
function weeklyKey(id: string, week: number): number {
  let h = 5381;
  const s = `${id}:${week}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Within one supplier's queue: featured first (in the order they starred
// them), then best recent sellers, then recently reviewed, then rating.
function supplierQueueOrder(a: Product, b: Product): number {
  if (isFeatured(a) !== isFeatured(b)) return isFeatured(a) ? -1 : 1;
  if (isFeatured(a) && isFeatured(b)) {
    return (a.featuredAt ?? "").localeCompare(b.featuredAt ?? "");
  }
  const recentOrders = (b.recentOrderCount ?? 0) - (a.recentOrderCount ?? 0);
  if (recentOrders !== 0) return recentOrders;
  const recentRatings = (b.recentRatingCount ?? 0) - (a.recentRatingCount ?? 0);
  if (recentRatings !== 0) return recentRatings;
  return (b.avgRating ?? 0) - (a.avgRating ?? 0);
}

// Round-robin the top band across suppliers: one product per supplier per
// turn, supplier order rotated weekly. If a supplier's next product would
// repeat the previous card's category, take their next different-category
// product instead (falling back to the repeat when they have nothing else).
function roundRobinBySupplier(band: Product[]): Product[] {
  const week = currentWeekNumber();
  const bySupplier = new Map<string, Product[]>();
  for (const p of band) {
    if (!bySupplier.has(p.supplierId)) bySupplier.set(p.supplierId, []);
    bySupplier.get(p.supplierId)!.push(p);
  }
  for (const queue of bySupplier.values()) queue.sort(supplierQueueOrder);

  const supplierIds = Array.from(bySupplier.keys())
    .sort((a, b) => weeklyKey(a, week) - weeklyKey(b, week));

  const result: Product[] = [];
  let lastCategory: string | null = null;
  while (result.length < band.length) {
    for (const supplierId of supplierIds) {
      const queue = bySupplier.get(supplierId)!;
      if (queue.length === 0) continue;
      let pick = 0;
      if (queue[0].category === lastCategory) {
        const alt = queue.findIndex((p) => p.category !== lastCategory);
        if (alt > 0) pick = alt;
      }
      const [product] = queue.splice(pick, 1);
      result.push(product);
      lastCategory = product.category;
    }
  }
  return result;
}

// Bottom band: group by category, locality priority within each, then
// round-robin the categories so browsing shows a mix.
function interleaveByCategory(rest: Product[]): Product[] {
  const byCategory = new Map<string, Product[]>();
  for (const p of rest) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }
  for (const prods of byCategory.values()) {
    prods.sort((a, b) => {
      const localityDiff = (LOCALITY_PRIORITY[a.locality] ?? 9) - (LOCALITY_PRIORITY[b.locality] ?? 9);
      if (localityDiff !== 0) return localityDiff;
      return a.name.localeCompare(b.name);
    });
  }
  const categoryArrays = Array.from(byCategory.values());
  const interleaved: Product[] = [];
  const maxLen = Math.max(...categoryArrays.map((arr) => arr.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of categoryArrays) {
      if (i < arr.length) interleaved.push(arr[i]);
    }
  }
  return interleaved;
}

// Full shop ordering for /products (when not searching).
export function sortShopProducts(products: Product[]): Product[] {
  const topBand = products.filter(hasRecentActivity);
  const rest = products.filter((p) => !hasRecentActivity(p));
  return [...roundRobinBySupplier(topBand), ...interleaveByCategory(rest)];
}

// Ordering for one supplier's page: featured pinned first (oldest star
// first), then the same recency ranking as the shop, then all-time
// popularity as the fallback for the quiet tail.
export function sortSupplierProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const queueDiff = supplierQueueOrder(a, b);
    if (queueDiff !== 0) return queueDiff;
    const allTimeOrders = (b.orderCount ?? 0) - (a.orderCount ?? 0);
    if (allTimeOrders !== 0) return allTimeOrders;
    return a.name.localeCompare(b.name);
  });
}
