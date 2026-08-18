// Shop product ordering - shared by /products and /suppliers/[id].
//
// The shop sorts in two bands:
//  - Top band: anything ordered or reviewed in the last 14 days (the
//    recent_* counts from products_with_stats), anything added in the last
//    14 days, plus anything a supplier has featured. Round-robined
//    one-product-per-supplier so no one floods the top, with a nudge so two
//    products of the same category don't sit next to each other. Both the
//    supplier turn order and which of a supplier's products leads rotate
//    weekly, so the first screen genuinely changes Monday to Monday.
//  - Bottom band: everything else, interleaved by category with locality
//    priority (local first) - unchanged from the original shop sort.

import type { Product } from "./data";

// Own Produce/Local/Regional = 0, UK = 1, International = 2, TBC = 3
const LOCALITY_PRIORITY: Record<string, number> = {
  "Own Produce": 0, "Local": 0, "Regional": 0, "UK": 1, "International": 2, "TBC": 3,
};

// Matches the recent_* window in products_with_stats.
const RECENT_DAYS = 14;

// How many of a supplier's best products take turns at leading their queue.
const ROTATION_WINDOW = 5;

const isFeatured = (p: Product) => p.featuredAt != null;

// Added in the last fortnight - joins the top band on its own, so a brand
// new product is seen before it has any orders or reviews behind it.
const isNewArrival = (p: Product) =>
  p.createdAt != null &&
  Date.now() - new Date(p.createdAt).getTime() < RECENT_DAYS * 86_400_000;

const belongsInTopBand = (p: Product) =>
  (p.recentOrderCount ?? 0) > 0 || (p.recentRatingCount ?? 0) > 0 ||
  isFeatured(p) || isNewArrival(p);

// Changes every Monday; stable within the week so the page doesn't reshuffle
// mid-browse. Epoch day 0 (1 Jan 1970) was a Thursday, so +3 aligns the
// 7-day buckets to Monday boundaries.
function currentWeekNumber(): number {
  const days = Math.floor(Date.now() / 86_400_000);
  return Math.floor((days + 3) / 7);
}

// Deterministic per-week ordering key for a string id (djb2 hash of week+id).
// The week has to lead: djb2 only avalanches forward, so a trailing week
// number moved the key by 1 or 2 out of 2^32 and left the order identical
// week after week.
function weeklyKey(id: string, week: number): number {
  let h = 5381;
  const s = `${week}:${id}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Rotate an array left by n (used to give each product in a supplier's top
// slice its turn at the front, a different one each week).
function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length < 2) return arr;
  const n = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
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

// One supplier's queue on the shop: their stars first, then new arrivals and
// proven sellers alternating so neither buries the other, and finally a
// weekly rotation of the head so a different one of their best products
// leads each week instead of the same card sitting there forever.
function shopQueue(products: Product[], week: number): Product[] {
  const featured = rotate(
    products.filter(isFeatured)
      .sort((a, b) => (a.featuredAt ?? "").localeCompare(b.featuredAt ?? "")),
    week,
  );
  const others = products.filter((p) => !isFeatured(p));
  const fresh = others.filter(isNewArrival)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const proven = others.filter((p) => !isNewArrival(p)).sort(supplierQueueOrder);

  const body: Product[] = [];
  for (let i = 0; i < Math.max(fresh.length, proven.length); i++) {
    if (i < fresh.length) body.push(fresh[i]);
    if (i < proven.length) body.push(proven[i]);
  }
  const head = Math.min(ROTATION_WINDOW, body.length);
  return [...featured, ...rotate(body.slice(0, head), week), ...body.slice(head)];
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
  for (const [supplierId, queue] of bySupplier) {
    bySupplier.set(supplierId, shopQueue(queue, week));
  }

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
  const topBand = products.filter(belongsInTopBand);
  const rest = products.filter((p) => !belongsInTopBand(p));
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
