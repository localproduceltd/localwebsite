import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BOX_DEPOSIT } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupplierStatus = "launch_live" | "launch_not_live" | "onboarding" | "archived";

export interface Supplier {
  id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  category: string;
  lat: number | null;
  lng: number | null;
  status: SupplierStatus;
  email: string | null;
  instagram: string | null;
  featured: boolean;
  onHoliday: boolean;
  holidayUntil: string | null;
  holidayMessage: string | null;
  // Admin-only toggle: weekly stock limits only apply to this supplier's
  // products when true. Off by default - untracked suppliers behave as before.
  stockTracking: boolean;
}

export function isOnHoliday(supplier: Supplier): boolean {
  if (!supplier.onHoliday || supplier.status !== "launch_live") return false;
  if (!supplier.holidayUntil) return true;
  const today = new Date().toISOString().split("T")[0];
  return supplier.holidayUntil >= today;
}

export interface SupplierHolidayInfo {
  id: string;
  name: string;
  onHoliday: boolean;
  holidayUntil: string | null;
  holidayMessage: string | null;
  status: SupplierStatus;
}

export interface SupplierUser {
  id: string;
  clerkUserId: string;
  supplierId: string;
}

// "Mixed" replaced the old admin-only "TBC" in Aug 2026. TBC meant "we
// haven't worked this out yet" and leaked onto the shop as a grey badge;
// Mixed is a real answer for things whose origin genuinely varies batch to
// batch (a fish counter, a refill bin). It is a customer-facing filter
// option like any other, and it always implies a variable location - see
// applyLocalityRules below.
export type Locality = "Own Produce" | "Local" | "Regional" | "UK" | "International" | "Mixed";

export const LOCALITY_OPTIONS: Locality[] = ["Own Produce", "Local", "Regional", "UK", "International", "Mixed"];

// Kept as a separate export for the admin/supplier dropdowns. Identical to
// LOCALITY_OPTIONS now that TBC is gone, but the two had different meanings
// and callers still distinguish "what customers can filter by" from "what an
// editor can pick".
export const ALL_LOCALITIES: Locality[] = [...LOCALITY_OPTIONS];

// Two localities derive their own location rather than trusting the caller:
//
//  - Mixed has no single place to pin, so the flag goes on and the
//    coordinates come off.
//  - Own Produce is by definition made at the supplier's own site, so it
//    takes the supplier's coordinates. Suppliers were re-pinning their own
//    farm by hand for every product they added, which was busywork that
//    drifted (Aug 2026).
//
// This half is synchronous so the edit forms can apply it as the user picks;
// Own Produce needs the supplier row, so it lives in resolveProductLocation.
export function applyLocalityRules<T extends { locality: Locality; lat: number | null; lng: number | null; variableLocation: boolean }>(product: T): T {
  if (product.locality !== "Mixed") return product;
  return { ...product, variableLocation: true, lat: null, lng: null };
}

// Full location rules, applied on every write in createProduct/updateProduct
// so no form, API route or bulk import can save a product whose pin
// contradicts its locality. Falls back to whatever the caller supplied if the
// supplier has no coordinates of its own.
export async function resolveProductLocation<T extends { supplierId: string; locality: Locality; lat: number | null; lng: number | null; variableLocation: boolean }>(
  product: T,
  client: SupabaseClient = supabase,
): Promise<T> {
  const withRules = applyLocalityRules(product);
  if (withRules.locality !== "Own Produce") return withRules;
  const { data } = await client.from("suppliers").select("lat, lng").eq("id", withRules.supplierId).single();
  if (data?.lat == null || data?.lng == null) return withRules;
  return { ...withRules, variableLocation: false, lat: data.lat, lng: data.lng };
}

export type ProductStatus = "pending" | "approved" | "rejected";

export interface Product {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  image: string;
  category: string;
  inStock: boolean;
  // Cap for one delivery week; null = not tracked. Only enforced when the
  // supplier's stockTracking toggle is on.
  weeklyStock: number | null;
  // Populated where the supplier row is joined (shop + supplier queries).
  supplierStockTracking?: boolean;
  refrigerated: boolean;
  locality: Locality;
  lat: number | null;
  lng: number | null;
  variableLocation: boolean;
  status: ProductStatus;
  rejectionReason?: string | null;
  archivedAt?: string | null;
  allergens: string[];
  tags: string[];
  ingredients?: string | null;
  avgRating?: number;
  ratingCount?: number;
  orderCount?: number;
  // Last-14-days activity (from products_with_stats) - drives shop ordering.
  recentOrderCount?: number;
  recentRatingCount?: number;
  // Supplier-starred (max 3 per supplier); pins to the top of their page and
  // joins the "recent activity" band on the shop. Null = not featured.
  featuredAt?: string | null;
  // When the product was added - new arrivals join the shop's top band.
  createdAt?: string;
}

export type SupplierOrderStatus = "order_placed" | "prepping" | "dropped_at_depot" | "delivered" | "cancelled";

export interface OrderItem {
  productId: string;
  productName: string;
  unit: string; // e.g. "100g", "1kg", "x6", or "" if no unit
  quantity: number;
  price: number;
  supplierId?: string;
  supplierName?: string;
  supplierStatus?: SupplierOrderStatus;
}

export type DeliveryWindow = "morning" | "afternoon" | "any";

// Three options since Jul 2026 ("in but don't disturb" and "out with own
// cool bag" merged - same driver job). DB values migrated in
// 20260716_merge_delivery_options.sql.
export type DeliveryOption = "in" | "own_coolbag" | "local_coolbox";

export const DELIVERY_OPTION_LABELS: Record<DeliveryOption, string> = {
  in: "I'll be in - knock",
  own_coolbag: "Own cool bag/box out - don't knock",
  local_coolbox: "Local cool box (borrowed)",
};

export interface Order {
  id: string;
  orderNumber: number;
  boxNumber: number | null;
  userId: string;
  customerEmail: string | null;
  customerName: string | null;
  items: OrderItem[];
  total: number;
  status: "ordered" | "prepped" | "next_hour" | "delivered" | "cancelled";
  createdAt: string;
  deliveryDay: string;
  deliveryWindow: DeliveryWindow | null;
  willBeIn: boolean;
  deliveryOption: DeliveryOption | null;
  safePlace: string | null;
  boxDepositPaid: boolean;
  bottleDepositPaid: boolean;
  bottleDepositQty: number;
  // Box outcome recorded by the driver at delivery (null = not recorded)
  boxLeft: boolean | null;
  boxCollected: boolean | null;
  address: OrderAddress | null;
  phone: string | null;
  stripeSessionId: string | null;
  discountCode: string | null;
  couponName: string | null;
  discountAmount: number | null;
  instructions: string | null;
  pinLat: number | null;
  pinLng: number | null;
}

export interface DeliveryDay {
  id: string;
  deliveryDate: string;
  cutoffDate: string;
  cutoffTime: string;
}

// ─── Order Revenue Helpers ────────────────────────────────────────────────────

export function orderRevenue(o: Order): number {
  // Products + delivery fee. Excludes the refundable box deposit.
  // NOTE: bottle deposits (£1 per bottle) aren't deducted because qty
  // isn't stored on the order. The impact is small.
  const boxDep = o.boxDepositPaid ? BOX_DEPOSIT : 0;
  return o.total - boxDep;
}

export function orderBasket(o: Order): number {
  // Products only. Excludes delivery fee and deposits.
  return o.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

// ─── Data access functions (powered by Supabase) ─────────────────────────────

export async function getSuppliers(client: SupabaseClient = supabase): Promise<Supplier[]> {
  const { data, error } = await client
    .from("suppliers")
    .select("*")
    .order("name");
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    image: s.image,
    location: s.location,
    category: s.category,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    status: s.status ?? "launch_live",
    email: s.email ?? null,
    instagram: s.instagram ?? null,
    featured: s.featured ?? false,
    onHoliday: s.on_holiday ?? false,
    holidayUntil: s.holiday_until ?? null,
    holidayMessage: s.holiday_message ?? null,
    stockTracking: s.stock_tracking ?? false,
  }));
}

// Get suppliers with launch_live or launch_not_live status
export async function getLiveSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .in("status", ["launch_live", "launch_not_live"])
    .order("name");
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    image: s.image,
    location: s.location,
    category: s.category,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    status: s.status ?? "launch_live",
    email: s.email ?? null,
    instagram: s.instagram ?? null,
    featured: s.featured ?? false,
    onHoliday: s.on_holiday ?? false,
    holidayUntil: s.holiday_until ?? null,
    holidayMessage: s.holiday_message ?? null,
    stockTracking: s.stock_tracking ?? false,
  }));
}

// Get only launch_live suppliers (for homepage carousel etc.)
// Featured suppliers come first, then alphabetically by name
export async function getActiveSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("status", "launch_live")
    .order("featured", { ascending: false })
    .order("name");
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    image: s.image,
    location: s.location,
    category: s.category,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    status: "launch_live" as const,
    email: s.email ?? null,
    instagram: s.instagram ?? null,
    featured: s.featured ?? false,
    onHoliday: s.on_holiday ?? false,
    holidayUntil: s.holiday_until ?? null,
    holidayMessage: s.holiday_message ?? null,
    stockTracking: s.stock_tracking ?? false,
  }));
}

export async function getSupplier(id: string, client: SupabaseClient = supabase): Promise<Supplier | null> {
  const { data, error } = await client
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    image: data.image,
    location: data.location,
    category: data.category,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    status: data.status ?? "launch_live",
    email: data.email ?? null,
    instagram: data.instagram ?? null,
    featured: data.featured ?? false,
    onHoliday: data.on_holiday ?? false,
    holidayUntil: data.holiday_until ?? null,
    holidayMessage: data.holiday_message ?? null,
    stockTracking: data.stock_tracking ?? false,
  };
}

export async function getSuppliersHolidayInfo(supplierIds: string[]): Promise<SupplierHolidayInfo[]> {
  if (supplierIds.length === 0) return [];
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, on_holiday, holiday_until, holiday_message, status")
    .in("id", supplierIds);
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    onHoliday: s.on_holiday ?? false,
    holidayUntil: s.holiday_until ?? null,
    holidayMessage: s.holiday_message ?? null,
    status: s.status ?? "launch_live",
  }));
}

export function isSupplierOnHoliday(info: SupplierHolidayInfo): boolean {
  if (!info.onHoliday || info.status !== "launch_live") return false;
  if (!info.holidayUntil) return true;
  const today = new Date().toISOString().split("T")[0];
  return info.holidayUntil >= today;
}

// Supabase caps a single select at 1,000 rows; fetch in batches until one comes back short.
// Queries passed in must have a fully deterministic order (tie-break on id) so rows
// can't shuffle between batches and get duplicated or skipped.
const FETCH_BATCH_SIZE = 1000;
async function fetchAllRows<Row>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += FETCH_BATCH_SIZE) {
    const { data, error } = await buildQuery(from, from + FETCH_BATCH_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < FETCH_BATCH_SIZE) return rows;
  }
}

export async function getProducts(client: SupabaseClient = supabase): Promise<Product[]> {
  const data = await fetchAllRows((from, to) =>
    client
      .from("products")
      .select("*, suppliers(name)")
      .is("archived_at", null)
      .order("name")
      .order("id")
      .range(from, to)
  );
  return data.map((p) => ({
    id: p.id,
    supplierId: p.supplier_id,
    supplierName: (p.suppliers as { name: string })?.name ?? "",
    name: p.name,
    description: p.description,
    price: Number(p.price),
    unit: p.unit,
    image: p.image,
    category: p.category,
    inStock: p.in_stock,
    weeklyStock: p.weekly_stock ?? null,
    refrigerated: p.refrigerated ?? false,
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    variableLocation: p.variable_location ?? false,
    status: (p.status as ProductStatus) ?? "approved",
    rejectionReason: p.rejection_reason ?? null,
    archivedAt: p.archived_at ?? null,
    allergens: p.allergens ?? [],
    tags: p.tags ?? [],
    ingredients: p.ingredients ?? null,
  }));
}

// Get approved products from launch_live suppliers only (for launch mode)
// Uses products_with_stats view for pre-computed ratings and order counts
export async function getApprovedProducts(): Promise<Product[]> {
  const data = await fetchAllRows((from, to) =>
    supabase
      .from("products_with_stats")
      .select("*, suppliers!inner(name, status, stock_tracking)")
      .eq("status", "approved")
      .eq("suppliers.status", "launch_live")
      .is("archived_at", null)
      .order("name")
      .order("id")
      .range(from, to)
  );
  return data.map((p) => ({
    id: p.id,
    supplierId: p.supplier_id,
    supplierName: (p.suppliers as { name: string })?.name ?? "",
    name: p.name,
    description: p.description,
    price: Number(p.price),
    unit: p.unit,
    image: p.image,
    category: p.category,
    inStock: p.in_stock,
    weeklyStock: p.weekly_stock ?? null,
    supplierStockTracking: (p.suppliers as { stock_tracking?: boolean })?.stock_tracking ?? false,
    refrigerated: p.refrigerated ?? false,
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    variableLocation: p.variable_location ?? false,
    status: "approved" as ProductStatus,
    allergens: p.allergens ?? [],
    tags: p.tags ?? [],
    ingredients: p.ingredients ?? null,
    avgRating: Number(p.avg_rating) || 0,
    ratingCount: p.rating_count ?? 0,
    orderCount: p.order_count ?? 0,
    recentOrderCount: p.recent_order_count ?? 0,
    recentRatingCount: p.recent_rating_count ?? 0,
    featuredAt: p.featured_at ?? null,
    createdAt: p.created_at ?? undefined,
  }));
}

export async function getProductsBySupplier(supplierId: string, client: SupabaseClient = supabase): Promise<Product[]> {
  const { data, error } = await client
    .from("products_with_stats")
    .select("*, suppliers(name, stock_tracking)")
    .eq("supplier_id", supplierId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    supplierId: p.supplier_id,
    supplierName: (p.suppliers as { name: string })?.name ?? "",
    name: p.name,
    description: p.description,
    price: Number(p.price),
    unit: p.unit,
    image: p.image,
    category: p.category,
    inStock: p.in_stock,
    weeklyStock: p.weekly_stock ?? null,
    refrigerated: p.refrigerated ?? false,
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    variableLocation: p.variable_location ?? false,
    status: (p.status as ProductStatus) ?? "approved",
    rejectionReason: p.rejection_reason ?? null,
    archivedAt: p.archived_at ?? null,
    allergens: p.allergens ?? [],
    tags: p.tags ?? [],
    ingredients: p.ingredients ?? null,
    supplierStockTracking: (p.suppliers as { stock_tracking?: boolean })?.stock_tracking ?? false,
    avgRating: Number(p.avg_rating) || 0,
    ratingCount: p.rating_count ?? 0,
    orderCount: p.order_count ?? 0,
    recentOrderCount: p.recent_order_count ?? 0,
    recentRatingCount: p.recent_rating_count ?? 0,
    featuredAt: p.featured_at ?? null,
    createdAt: p.created_at ?? undefined,
  }));
}

export async function getProduct(id: string, client: SupabaseClient = supabase): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select("*, suppliers(name)")
    .eq("id", id)
    .is("archived_at", null)
    .single();
  if (error) return null;
  return {
    id: data.id,
    supplierId: data.supplier_id,
    supplierName: (data.suppliers as { name: string })?.name ?? "",
    name: data.name,
    description: data.description,
    price: Number(data.price),
    unit: data.unit,
    image: data.image,
    category: data.category,
    inStock: data.in_stock,
    weeklyStock: data.weekly_stock ?? null,
    refrigerated: data.refrigerated ?? false,
    locality: (data.locality as Locality) ?? "Local",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    variableLocation: data.variable_location ?? false,
    status: (data.status as ProductStatus) ?? "approved",
    rejectionReason: data.rejection_reason ?? null,
    archivedAt: data.archived_at ?? null,
    allergens: data.allergens ?? [],
    tags: data.tags ?? [],
    ingredients: data.ingredients ?? null,
  };
}

export async function getArchivedProducts(client: SupabaseClient = supabase): Promise<Product[]> {
  const data = await fetchAllRows((from, to) =>
    client
      .from("products")
      .select("*, suppliers(name)")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .order("id")
      .range(from, to)
  );
  return data.map((p) => ({
    id: p.id,
    supplierId: p.supplier_id,
    supplierName: (p.suppliers as { name: string })?.name ?? "",
    name: p.name,
    description: p.description,
    price: Number(p.price),
    unit: p.unit,
    image: p.image,
    category: p.category,
    inStock: p.in_stock,
    weeklyStock: p.weekly_stock ?? null,
    refrigerated: p.refrigerated ?? false,
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    variableLocation: p.variable_location ?? false,
    status: (p.status as ProductStatus) ?? "approved",
    rejectionReason: p.rejection_reason ?? null,
    archivedAt: p.archived_at ?? null,
    allergens: p.allergens ?? [],
    tags: p.tags ?? [],
    ingredients: p.ingredients ?? null,
  }));
}

export async function getOrders(userId?: string): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*, suppliers(name))")
    .order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    boxNumber: o.box_number ?? null,
    userId: o.user_id,
    customerEmail: o.customer_email ?? null,
    customerName: o.customer_name ?? null,
    items: (o.order_items as Array<{ product_id: string; product_name: string; unit: string; quantity: number; price: number; supplier_id?: string; supplier_status?: string; suppliers?: { name: string } | null }>).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unit: item.unit ?? "",
      quantity: item.quantity,
      price: Number(item.price),
      supplierId: item.supplier_id ?? undefined,
      supplierName: item.suppliers?.name ?? undefined,
      supplierStatus: (item.supplier_status as SupplierOrderStatus) ?? "order_placed",
    })),
    total: Number(o.total),
    status: o.status as Order["status"],
    createdAt: new Date(o.created_at).toISOString().split("T")[0],
    deliveryDay: o.delivery_day,
    deliveryWindow: o.delivery_window as DeliveryWindow | null,
    willBeIn: o.will_be_in ?? true,
    deliveryOption: (o.delivery_option as DeliveryOption) ?? null,
    safePlace: o.safe_place ?? null,
    boxDepositPaid: o.box_deposit_paid ?? false,
    bottleDepositPaid: o.bottle_deposit_paid ?? false,
    bottleDepositQty: o.bottle_deposit_qty ?? 0,
    boxLeft: o.box_left ?? null,
    boxCollected: o.box_collected ?? null,
    address: o.address_line1 ? {
      addressLine1: o.address_line1,
      addressLine2: o.address_line2 ?? undefined,
      city: o.city,
      postcode: o.postcode,
    } : null,
    stripeSessionId: o.stripe_session_id ?? null,
    discountCode: o.discount_code ?? null,
    couponName: o.coupon_name ?? null,
    discountAmount: o.discount_amount != null ? Number(o.discount_amount) : null,
    phone: o.phone ?? null,
    instructions: o.instructions ?? null,
    pinLat: o.pin_lat != null ? Number(o.pin_lat) : null,
    pinLng: o.pin_lng != null ? Number(o.pin_lng) : null,
  }));
}

export async function getUserOrderedProductIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_items(product_id)")
    .eq("user_id", userId);
  if (error) throw error;
  const productIds = new Set<string>();
  for (const order of data ?? []) {
    for (const item of (order.order_items as Array<{ product_id: string }>) ?? []) {
      productIds.add(item.product_id);
    }
  }
  return productIds;
}

export async function getDeliveryDay(id: string, client: SupabaseClient = supabase): Promise<DeliveryDay | null> {
  const { data, error } = await client
    .from("delivery_days")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return {
    id: data.id,
    deliveryDate: data.delivery_date,
    cutoffDate: data.cutoff_date,
    cutoffTime: data.cutoff_time,
  };
}

export async function getDeliveryDays(client: SupabaseClient = supabase): Promise<DeliveryDay[]> {
  const { data, error } = await client
    .from("delivery_days")
    .select("*")
    .order("delivery_date");
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    deliveryDate: d.delivery_date,
    cutoffDate: d.cutoff_date,
    cutoffTime: d.cutoff_time,
  }));
}

export async function getActiveDeliveryDays(): Promise<DeliveryDay[]> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);

  const { data, error } = await supabase
    .from("delivery_days")
    .select("*")
    .gte("delivery_date", today)
    .order("delivery_date");
  if (error) throw error;

  return data
    .map((d) => ({
      id: d.id,
      deliveryDate: d.delivery_date,
      cutoffDate: d.cutoff_date,
      cutoffTime: d.cutoff_time,
    }))
    .filter((d) => {
      if (d.cutoffDate > today) return true;
      if (d.cutoffDate === today && d.cutoffTime > currentTime) return true;
      return false;
    });
}

// ─── Weekly stock ────────────────────────────────────────────────────────────
// Remaining stock is never stored: it's weekly_stock minus what's already been
// ordered for a delivery day (cancelled lines excluded), read live from the
// product_ordered_quantities view. Baskets reserve nothing - only paid orders
// count - so the checkout API re-checks at payment time.

// Units already ordered per product for one delivery day, keyed by product id.
export async function getOrderedQuantities(
  deliveryDay: string,
  productIds?: string[],
  client: SupabaseClient = supabase
): Promise<Record<string, number>> {
  let query = client
    .from("product_ordered_quantities")
    .select("product_id, quantity_ordered")
    .eq("delivery_day", deliveryDay);
  if (productIds && productIds.length > 0) query = query.in("product_id", productIds);
  const { data, error } = await query;
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) result[row.product_id] = row.quantity_ordered;
  return result;
}

export interface StockViolation {
  productId: string;
  productName: string;
  // Units still available for that delivery day (0 = sold out or out of stock)
  remaining: number;
}

// Server-side checkout gate. A line violates if the product is manually out of
// stock, or (supplier stock_tracking on + weekly_stock set) the requested
// quantity exceeds what's left for that delivery day.
export async function checkStockForItems(
  items: Array<{ productId: string; quantity: number }>,
  deliveryDay: string,
  client: SupabaseClient = supabase
): Promise<StockViolation[]> {
  const productIds = items.map((i) => i.productId);
  if (productIds.length === 0) return [];
  const { data, error } = await client
    .from("products")
    .select("id, name, in_stock, weekly_stock, suppliers(stock_tracking)")
    .in("id", productIds);
  if (error) throw error;
  const ordered = await getOrderedQuantities(deliveryDay, productIds, client);
  const violations: StockViolation[] = [];
  for (const item of items) {
    const p = data?.find((row) => row.id === item.productId);
    if (!p) continue;
    if (!p.in_stock) {
      violations.push({ productId: p.id, productName: p.name, remaining: 0 });
      continue;
    }
    const tracking = (p.suppliers as unknown as { stock_tracking?: boolean } | null)?.stock_tracking ?? false;
    if (!tracking || p.weekly_stock == null) continue;
    const remaining = Math.max(0, p.weekly_stock - (ordered[p.id] ?? 0));
    if (item.quantity > remaining) {
      violations.push({ productId: p.id, productName: p.name, remaining });
    }
  }
  return violations;
}

// ─── Write functions ─────────────────────────────────────────────────────────

export async function createProduct(rawProduct: Omit<Product, "id" | "supplierName">, client: SupabaseClient = supabase): Promise<Product> {
  const product = await resolveProductLocation(rawProduct, client);
  const { data, error } = await client.from("products").insert({
    name: product.name,
    description: product.description,
    price: product.price,
    unit: product.unit,
    image: product.image,
    category: product.category,
    in_stock: product.inStock,
    weekly_stock: product.weeklyStock ?? null,
    refrigerated: product.refrigerated ?? false,
    supplier_id: product.supplierId,
    locality: product.locality,
    lat: product.lat,
    lng: product.lng,
    variable_location: product.variableLocation,
    status: product.status ?? "approved",
    allergens: product.allergens ?? [],
    tags: product.tags ?? [],
    ingredients: product.ingredients ?? null,
  }).select("*, suppliers(name)").single();
  if (error) throw error;
  return {
    id: data.id,
    supplierId: data.supplier_id,
    supplierName: (data.suppliers as { name: string })?.name ?? "",
    name: data.name,
    description: data.description,
    price: Number(data.price),
    unit: data.unit,
    image: data.image,
    category: data.category,
    inStock: data.in_stock,
    weeklyStock: data.weekly_stock ?? null,
    refrigerated: data.refrigerated ?? false,
    locality: (data.locality as Locality) ?? "Local",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    variableLocation: data.variable_location ?? false,
    status: (data.status as ProductStatus) ?? "approved",
    rejectionReason: data.rejection_reason ?? null,
    archivedAt: data.archived_at ?? null,
    allergens: data.allergens ?? [],
    tags: data.tags ?? [],
    ingredients: data.ingredients ?? null,
  };
}

export async function updateProduct(rawProduct: Product, client: SupabaseClient = supabase): Promise<void> {
  const product = await resolveProductLocation(rawProduct, client);
  const { error } = await client.from("products").update({
    name: product.name,
    description: product.description,
    price: product.price,
    unit: product.unit,
    image: product.image,
    category: product.category,
    in_stock: product.inStock,
    weekly_stock: product.weeklyStock ?? null,
    refrigerated: product.refrigerated ?? false,
    supplier_id: product.supplierId,
    locality: product.locality,
    lat: product.lat,
    lng: product.lng,
    variable_location: product.variableLocation,
    status: product.status,
    allergens: product.allergens ?? [],
    tags: product.tags ?? [],
    ingredients: product.ingredients ?? null,
  }).eq("id", product.id);
  if (error) throw error;
}

export const MAX_FEATURED_PER_SUPPLIER = 3;

export type SetFeaturedResult = { ok: true } | { ok: false; reason: "limit_reached" };

// Star/unstar a product on the supplier's page. featured_at doubles as the
// display order (oldest star shows first). Re-checks the per-supplier limit
// here, not just in the UI, so two tabs can't star a fourth.
export async function setProductFeatured(product: Product, featured: boolean, client: SupabaseClient = supabase): Promise<SetFeaturedResult> {
  if (featured) {
    const { count, error: countError } = await client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", product.supplierId)
      .not("featured_at", "is", null)
      .is("archived_at", null);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_FEATURED_PER_SUPPLIER) return { ok: false, reason: "limit_reached" };
  }
  const { error } = await client
    .from("products")
    .update({ featured_at: featured ? new Date().toISOString() : null })
    .eq("id", product.id);
  if (error) throw error;
  return { ok: true };
}

export type DeleteProductResult =
  | { deleted: true }
  | { deleted: false; reason: "has_outstanding_orders" };

export async function deleteProduct(id: string, client: SupabaseClient = supabase): Promise<DeleteProductResult> {
  // Check for outstanding order items (not delivered or cancelled)
  const { data: outstandingItems, error: checkError } = await client
    .from("order_items")
    .select("id")
    .eq("product_id", id)
    .not("supplier_status", "in", "(delivered,cancelled)")
    .limit(1);
  
  if (checkError) throw checkError;
  
  if (outstandingItems && outstandingItems.length > 0) {
    // Has outstanding orders - mark out of stock instead
    const { error: updateError } = await client
      .from("products")
      .update({ in_stock: false })
      .eq("id", id);
    if (updateError) throw updateError;
    return { deleted: false, reason: "has_outstanding_orders" };
  }
  
  // No outstanding orders - hard delete
  const { error } = await client.from("products").delete().eq("id", id);
  if (error) throw error;
  return { deleted: true };
}

export async function archiveProduct(id: string, client: SupabaseClient = supabase): Promise<void> {
  // Soft delete - set archived_at timestamp (admin use)
  const { error } = await client.from("products").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreProduct(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("products").update({ archived_at: null }).eq("id", id);
  if (error) throw error;
}

export async function permanentlyDeleteProduct(id: string, client: SupabaseClient = supabase): Promise<DeleteProductResult> {
  // Check for outstanding order items (not delivered or cancelled)
  const { data: outstandingItems, error: checkError } = await client
    .from("order_items")
    .select("id")
    .eq("product_id", id)
    .not("supplier_status", "in", "(delivered,cancelled)")
    .limit(1);
  
  if (checkError) throw checkError;
  
  if (outstandingItems && outstandingItems.length > 0) {
    // Has outstanding orders - mark out of stock instead
    const { error: updateError } = await client
      .from("products")
      .update({ in_stock: false })
      .eq("id", id);
    if (updateError) throw updateError;
    return { deleted: false, reason: "has_outstanding_orders" };
  }
  
  // No outstanding orders - hard delete
  const { error } = await client.from("products").delete().eq("id", id);
  if (error) throw error;
  return { deleted: true };
}

export async function createSupplier(supplier: Omit<Supplier, "id">, client: SupabaseClient = supabase): Promise<Supplier> {
  const { data, error } = await client.from("suppliers").insert({
    name: supplier.name,
    description: supplier.description,
    image: supplier.image,
    location: supplier.location,
    category: supplier.category,
    lat: supplier.lat,
    lng: supplier.lng,
    status: supplier.status,
    email: supplier.email,
    instagram: supplier.instagram,
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, description: data.description, image: data.image, location: data.location, category: data.category, lat: data.lat ?? null, lng: data.lng ?? null, status: data.status ?? "launch_live", email: data.email ?? null, instagram: data.instagram ?? null, featured: data.featured ?? false, onHoliday: data.on_holiday ?? false, holidayUntil: data.holiday_until ?? null, holidayMessage: data.holiday_message ?? null, stockTracking: data.stock_tracking ?? false };
}

export async function updateSupplier(supplier: Supplier, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("suppliers").update({
    name: supplier.name,
    description: supplier.description,
    image: supplier.image,
    location: supplier.location,
    category: supplier.category,
    lat: supplier.lat,
    lng: supplier.lng,
    status: supplier.status,
    email: supplier.email,
    instagram: supplier.instagram,
    featured: supplier.featured,
    on_holiday: supplier.onHoliday,
    holiday_until: supplier.holidayUntil,
    holiday_message: supplier.holidayMessage,
    stock_tracking: supplier.stockTracking,
  }).eq("id", supplier.id);
  if (error) throw error;
}

export async function getSupplierByProductId(productId: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from("products")
    .select("supplier_id, suppliers(*)")
    .eq("id", productId)
    .single();
  if (error || !data?.suppliers) return null;
  const s = data.suppliers as unknown as { id: string; name: string; description: string; image: string; location: string; category: string; lat: number | null; lng: number | null; status: string; email: string | null; instagram: string | null; on_holiday: boolean; holiday_until: string | null; holiday_message: string | null; stock_tracking: boolean | null };
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    image: s.image,
    location: s.location,
    category: s.category,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    status: (s.status as SupplierStatus) ?? "launch_live",
    email: s.email ?? null,
    instagram: s.instagram ?? null,
    featured: false,
    onHoliday: s.on_holiday ?? false,
    holidayUntil: s.holiday_until ?? null,
    holidayMessage: s.holiday_message ?? null,
    stockTracking: s.stock_tracking ?? false,
  };
}

export async function deleteSupplier(id: string, client: SupabaseClient = supabase): Promise<void> {
  // Delete supplier user links
  await client.from("supplier_users").delete().eq("supplier_id", id);

  // Get all product IDs for this supplier
  const { data: products } = await client.from("products").select("id").eq("supplier_id", id);
  const productIds = products?.map((p) => p.id) ?? [];

  if (productIds.length > 0) {
    // Delete order items for these products
    await client.from("order_items").delete().in("product_id", productIds);
    // Delete ratings for these products
    await client.from("ratings").delete().in("product_id", productIds);
    // Delete the products
    await client.from("products").delete().eq("supplier_id", id);
  }

  // Delete supplier order items
  await client.from("supplier_order_items").delete().eq("supplier_id", id);

  // Finally delete the supplier
  const { error } = await client.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateOrderStatus(orderId: string, status: Order["status"], client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
  // Delivered/cancelled cascade is handled by a DB trigger (cascade_order_status)
}

// Atomically move an order to "next_hour", but only from a pre-delivery state.
// Returns true only if THIS call actually performed the transition. The
// `.not("status", "in", ...)` clause makes the update a no-op when the order is
// already on its way (or delivered/cancelled), and Postgres re-checks it under a
// row lock - so if the driver taps "Start Run" several times, exactly one call
// changes the row and the "on our way" email is sent exactly once. Idempotent by
// construction, so it no longer relies on the client's in-memory snapshot.
export async function markOrderOnWay(orderId: string, client: SupabaseClient = supabase): Promise<boolean> {
  const { data, error } = await client
    .from("orders")
    .update({ status: "next_hour" })
    .eq("id", orderId)
    .not("status", "in", "(next_hour,delivered,cancelled)")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Atomically mark an order delivered, only from a not-yet-delivered state.
// Returns true only if THIS call performed the transition, so the "delivered"
// email fires exactly once even if the button is pressed twice.
export async function markOrderDelivered(orderId: string, client: SupabaseClient = supabase): Promise<boolean> {
  const { data, error } = await client
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId)
    .not("status", "in", "(delivered,cancelled)")
    .select("id");
  if (error) throw error;
  // Delivered/cancelled cascade is handled by a DB trigger (cascade_order_status)
  return (data?.length ?? 0) > 0;
}

export async function createDeliveryDay(day: Omit<DeliveryDay, "id">, client: SupabaseClient = supabase): Promise<DeliveryDay> {
  const { data, error } = await client.from("delivery_days").insert({
    delivery_date: day.deliveryDate,
    cutoff_date: day.cutoffDate,
    cutoff_time: day.cutoffTime,
  }).select().single();
  if (error) throw error;
  return {
    id: data.id,
    deliveryDate: data.delivery_date,
    cutoffDate: data.cutoff_date,
    cutoffTime: data.cutoff_time,
  };
}

export async function updateDeliveryDay(day: DeliveryDay, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("delivery_days").update({
    delivery_date: day.deliveryDate,
    cutoff_date: day.cutoffDate,
    cutoff_time: day.cutoffTime,
  }).eq("id", day.id);
  if (error) throw error;
}

export async function deleteDeliveryDay(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("delivery_days").delete().eq("id", id);
  if (error) throw error;
}

export async function getOrdersByDeliveryDay(deliveryDate: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, suppliers(name))")
    .eq("delivery_day", deliveryDate)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    boxNumber: o.box_number ?? null,
    userId: o.user_id,
    customerEmail: o.customer_email ?? null,
    customerName: o.customer_name ?? null,
    items: (o.order_items as Array<{ product_id: string; product_name: string; unit: string; quantity: number; price: number; supplier_id?: string; supplier_status?: string; suppliers?: { name: string } | null }>).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unit: item.unit ?? "",
      quantity: item.quantity,
      price: Number(item.price),
      supplierId: item.supplier_id ?? undefined,
      supplierName: item.suppliers?.name ?? undefined,
      supplierStatus: (item.supplier_status as SupplierOrderStatus) ?? "order_placed",
    })),
    total: Number(o.total),
    status: o.status as Order["status"],
    createdAt: new Date(o.created_at).toISOString().split("T")[0],
    deliveryDay: o.delivery_day,
    deliveryWindow: o.delivery_window as DeliveryWindow | null,
    willBeIn: o.will_be_in ?? true,
    deliveryOption: (o.delivery_option as DeliveryOption) ?? null,
    safePlace: o.safe_place ?? null,
    boxDepositPaid: o.box_deposit_paid ?? false,
    bottleDepositPaid: o.bottle_deposit_paid ?? false,
    bottleDepositQty: o.bottle_deposit_qty ?? 0,
    boxLeft: o.box_left ?? null,
    boxCollected: o.box_collected ?? null,
    address: o.address_line1 ? {
      addressLine1: o.address_line1,
      addressLine2: o.address_line2 ?? undefined,
      city: o.city,
      postcode: o.postcode,
    } : null,
    stripeSessionId: o.stripe_session_id ?? null,
    discountCode: o.discount_code ?? null,
    couponName: o.coupon_name ?? null,
    discountAmount: o.discount_amount != null ? Number(o.discount_amount) : null,
    phone: o.phone ?? null,
    instructions: o.instructions ?? null,
    pinLat: o.pin_lat != null ? Number(o.pin_lat) : null,
    pinLng: o.pin_lng != null ? Number(o.pin_lng) : null,
  }));
}

export interface OrderAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  instructions?: string;
  pinLat?: number;
  pinLng?: number;
}

export interface CreateOrderOptions {
  userId: string;
  customerEmail: string;
  customerName?: string;
  total: number;
  deliveryDay: string;
  items: OrderItem[];
  deliveryWindow: DeliveryWindow;
  willBeIn: boolean;
  deliveryOption: DeliveryOption;
  safePlace?: string;
  boxDepositPaid: boolean;
  bottleDepositPaid: boolean;
  bottleDepositQty?: number;
  stripeSessionId?: string;
  discountCode?: string;
  couponName?: string;
  discountAmount?: number;
  address?: OrderAddress;
  phone?: string;
  instructions?: string;
  pinLat?: number;
  pinLng?: number;
}

export async function getOrderByStripeSession(sessionId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, suppliers(name))")
    .eq("stripe_session_id", sessionId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    orderNumber: data.order_number,
    boxNumber: data.box_number ?? null,
    userId: data.user_id,
    customerEmail: data.customer_email ?? null,
    customerName: data.customer_name ?? null,
    items: (data.order_items as Array<{ product_id: string; product_name: string; unit: string; quantity: number; price: number; supplier_id?: string; supplier_status?: string; suppliers?: { name: string } | null }>).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unit: item.unit ?? "",
      quantity: item.quantity,
      price: Number(item.price),
      supplierId: item.supplier_id ?? undefined,
      supplierStatus: (item.supplier_status as OrderItem["supplierStatus"]) ?? "order_placed",
      supplierName: item.suppliers?.name,
    })),
    total: Number(data.total),
    status: data.status as Order["status"],
    createdAt: new Date(data.created_at).toISOString().split("T")[0],
    deliveryDay: data.delivery_day,
    deliveryWindow: data.delivery_window as DeliveryWindow,
    willBeIn: data.will_be_in ?? true,
    deliveryOption: (data.delivery_option as DeliveryOption) ?? null,
    safePlace: data.safe_place ?? null,
    boxDepositPaid: data.box_deposit_paid ?? false,
    bottleDepositPaid: data.bottle_deposit_paid ?? false,
    bottleDepositQty: data.bottle_deposit_qty ?? 0,
    boxLeft: data.box_left ?? null,
    boxCollected: data.box_collected ?? null,
    address: data.address_line1 ? {
      addressLine1: data.address_line1,
      addressLine2: data.address_line2 ?? undefined,
      city: data.city,
      postcode: data.postcode,
    } : null,
    stripeSessionId: data.stripe_session_id ?? null,
    discountCode: data.discount_code ?? null,
    couponName: data.coupon_name ?? null,
    discountAmount: data.discount_amount != null ? Number(data.discount_amount) : null,
    phone: data.phone ?? null,
    instructions: data.instructions ?? null,
    pinLat: data.pin_lat != null ? Number(data.pin_lat) : null,
    pinLng: data.pin_lng != null ? Number(data.pin_lng) : null,
  };
}

export async function createOrder(options: CreateOrderOptions): Promise<Order> {
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: options.userId,
      customer_email: options.customerEmail,
      customer_name: options.customerName ?? null,
      total: options.total,
      status: "ordered",
      delivery_day: options.deliveryDay,
      delivery_window: options.deliveryWindow,
      will_be_in: options.willBeIn,
      delivery_option: options.deliveryOption,
      safe_place: options.safePlace ?? null,
      box_deposit_paid: options.boxDepositPaid,
      bottle_deposit_paid: options.bottleDepositPaid,
      bottle_deposit_qty: options.bottleDepositQty ?? 0,
      stripe_session_id: options.stripeSessionId ?? null,
      discount_code: options.discountCode ?? null,
      coupon_name: options.couponName ?? null,
      discount_amount: options.discountAmount ?? null,
      address_line1: options.address?.addressLine1 ?? null,
      address_line2: options.address?.addressLine2 ?? null,
      city: options.address?.city ?? null,
      postcode: options.address?.postcode ?? null,
      phone: options.phone ?? null,
      instructions: options.instructions ?? null,
      pin_lat: options.pinLat ?? null,
      pin_lng: options.pinLng ?? null,
    })
    .select()
    .single();
  if (error || !order) throw error ?? new Error("Failed to create order");

  const { error: itemsError } = await supabase.from("order_items").insert(
    options.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      unit: item.unit ?? "",
      quantity: item.quantity,
      price: item.price,
      supplier_id: item.supplierId ?? null,
      supplier_status: "order_placed",
    }))
  );
  
  // If items insert fails, delete the orphaned order to maintain consistency
  if (itemsError) {
    console.error("Failed to insert order items, rolling back order:", itemsError);
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error(`Failed to create order items: ${itemsError.message}`);
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    boxNumber: order.box_number ?? null,
    userId: order.user_id,
    customerEmail: order.customer_email ?? null,
    customerName: order.customer_name ?? null,
    items: options.items,
    total: Number(order.total),
    status: order.status as Order["status"],
    createdAt: new Date(order.created_at).toISOString().split("T")[0],
    deliveryDay: order.delivery_day,
    deliveryWindow: order.delivery_window as DeliveryWindow,
    willBeIn: order.will_be_in ?? true,
    deliveryOption: options.deliveryOption,
    safePlace: order.safe_place ?? null,
    boxDepositPaid: order.box_deposit_paid ?? false,
    bottleDepositPaid: order.bottle_deposit_paid ?? false,
    bottleDepositQty: order.bottle_deposit_qty ?? 0,
    boxLeft: order.box_left ?? null,
    boxCollected: order.box_collected ?? null,
    address: options.address ?? null,
    stripeSessionId: order.stripe_session_id ?? null,
    discountCode: order.discount_code ?? null,
    couponName: order.coupon_name ?? null,
    discountAmount: order.discount_amount != null ? Number(order.discount_amount) : null,
    phone: order.phone ?? null,
    instructions: order.instructions ?? null,
    pinLat: order.pin_lat != null ? Number(order.pin_lat) : null,
    pinLng: order.pin_lng != null ? Number(order.pin_lng) : null,
  };
}

export async function canModifyOrder(orderId: string, client: SupabaseClient = supabase): Promise<boolean> {
  // Get the order's delivery day
  const { data: order, error: orderError } = await client
    .from("orders")
    .select("delivery_day, status")
    .eq("id", orderId)
    .single();
  
  if (orderError || !order) return false;
  
  // Can't modify if already delivered or cancelled
  if (order.status === "delivered" || order.status === "cancelled") return false;
  
  // Get the cutoff for this delivery day
  const { data: deliveryDay, error: ddError } = await client
    .from("delivery_days")
    .select("cutoff_date, cutoff_time")
    .eq("delivery_date", order.delivery_day)
    .single();
  
  if (ddError || !deliveryDay) return false;
  
  // Check if we're before the cutoff
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);
  
  if (deliveryDay.cutoff_date > today) return true;
  if (deliveryDay.cutoff_date === today && deliveryDay.cutoff_time > currentTime) return true;
  
  return false;
}

export async function cancelOrder(orderId: string, client: SupabaseClient = supabase): Promise<void> {
  const canModify = await canModifyOrder(orderId, client);
  if (!canModify) throw new Error("Order cannot be cancelled after cutoff");
  
  const { error } = await client
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);
  
  if (error) throw error;
}

export async function updateOrderItems(orderId: string, items: OrderItem[], client: SupabaseClient = supabase): Promise<void> {
  const canModify = await canModifyOrder(orderId, client);
  if (!canModify) throw new Error("Order cannot be modified after cutoff");
  
  // Delete existing items
  await client.from("order_items").delete().eq("order_id", orderId);
  
  // Insert new items
  if (items.length > 0) {
    const { error: itemsError } = await client.from("order_items").insert(
      items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        unit: item.unit ?? "",
        quantity: item.quantity,
        price: item.price,
        supplier_id: item.supplierId,
      }))
    );
    if (itemsError) throw itemsError;
  }
  
  // Update order total
  const newTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { error: totalError } = await client
    .from("orders")
    .update({ total: newTotal })
    .eq("id", orderId);
  
  if (totalError) throw totalError;
}

export async function getOrder(orderId: string, client: SupabaseClient = supabase): Promise<Order | null> {
  const { data, error } = await client
    .from("orders")
    .select("*, order_items(*, suppliers(name))")
    .eq("id", orderId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    orderNumber: data.order_number,
    boxNumber: data.box_number ?? null,
    userId: data.user_id,
    customerEmail: data.customer_email ?? null,
    customerName: data.customer_name ?? null,
    items: (data.order_items as Array<{ product_id: string; product_name: string; unit: string; quantity: number; price: number; supplier_id?: string; supplier_status?: string; suppliers?: { name: string } | null }>).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unit: item.unit ?? "",
      quantity: item.quantity,
      price: Number(item.price),
      supplierId: item.supplier_id ?? undefined,
      supplierStatus: (item.supplier_status as OrderItem["supplierStatus"]) ?? "order_placed",
      supplierName: item.suppliers?.name,
    })),
    total: Number(data.total),
    status: data.status as Order["status"],
    createdAt: new Date(data.created_at).toISOString().split("T")[0],
    deliveryDay: data.delivery_day,
    deliveryWindow: data.delivery_window as DeliveryWindow,
    willBeIn: data.will_be_in ?? true,
    deliveryOption: (data.delivery_option as DeliveryOption) ?? null,
    safePlace: data.safe_place ?? null,
    boxDepositPaid: data.box_deposit_paid ?? false,
    bottleDepositPaid: data.bottle_deposit_paid ?? false,
    bottleDepositQty: data.bottle_deposit_qty ?? 0,
    boxLeft: data.box_left ?? null,
    boxCollected: data.box_collected ?? null,
    address: data.address_line1 ? {
      addressLine1: data.address_line1,
      addressLine2: data.address_line2 ?? undefined,
      city: data.city,
      postcode: data.postcode,
    } : null,
    stripeSessionId: data.stripe_session_id ?? null,
    discountCode: data.discount_code ?? null,
    couponName: data.coupon_name ?? null,
    discountAmount: data.discount_amount != null ? Number(data.discount_amount) : null,
    phone: data.phone ?? null,
    instructions: data.instructions ?? null,
    pinLat: data.pin_lat != null ? Number(data.pin_lat) : null,
    pinLng: data.pin_lng != null ? Number(data.pin_lng) : null,
  };
}

export async function addItemsToOrder(orderId: string, items: OrderItem[], additionalTotal: number, client: SupabaseClient = supabase): Promise<void> {
  const canModify = await canModifyOrder(orderId, client);
  if (!canModify) throw new Error("Order cannot be modified after cutoff");
  
  // Insert new items
  if (items.length > 0) {
    const { error: itemsError } = await client.from("order_items").insert(
      items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        unit: item.unit ?? "",
        quantity: item.quantity,
        price: item.price,
        supplier_id: item.supplierId ?? null,
        supplier_status: "order_placed",
      }))
    );
    if (itemsError) throw itemsError;
  }
  
  // Get current order total and add to it
  const { data: order, error: orderError } = await client
    .from("orders")
    .select("total")
    .eq("id", orderId)
    .single();
  
  if (orderError || !order) throw orderError ?? new Error("Order not found");
  
  const newTotal = Number(order.total) + additionalTotal;
  const { error: totalError } = await client
    .from("orders")
    .update({ total: newTotal })
    .eq("id", orderId);
  
  if (totalError) throw totalError;
}

// ─── Supplier User functions ────────────────────────────────────────────────

export async function getSupplierUser(clerkUserId: string): Promise<SupplierUser | null> {
  const { data, error } = await supabase
    .from("supplier_users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (error) return null;
  return {
    id: data.id,
    clerkUserId: data.clerk_user_id,
    supplierId: data.supplier_id,
  };
}

export async function getSupplierUsers(client: SupabaseClient = supabase): Promise<(SupplierUser & { supplierName: string })[]> {
  const { data, error } = await client
    .from("supplier_users")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((su) => ({
    id: su.id,
    clerkUserId: su.clerk_user_id,
    supplierId: su.supplier_id,
    supplierName: (su.suppliers as { name: string })?.name ?? "",
  }));
}

export async function createSupplierUser(clerkUserId: string, supplierId: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("supplier_users").insert({
    clerk_user_id: clerkUserId,
    supplier_id: supplierId,
  });
  if (error) throw error;
}

export async function deleteSupplierUser(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from("supplier_users").delete().eq("id", id);
  if (error) throw error;
}

// ─── Product status functions ───────────────────────────────────────────────

export async function updateProductStatus(productId: string, status: ProductStatus, rejectionReason?: string, client: SupabaseClient = supabase): Promise<void> {
  const update: { status: ProductStatus; rejection_reason?: string | null } = { status };
  if (status === "rejected" && rejectionReason) {
    update.rejection_reason = rejectionReason;
  } else if (status !== "rejected") {
    update.rejection_reason = null; // Clear rejection reason when approving
  }
  const { error } = await client.from("products").update(update).eq("id", productId);
  if (error) throw error;
}

// ─── Supplier Order functions ───────────────────────────────────────────────

export interface SupplierOrderItem {
  id: string;
  orderId: string;
  orderNumber: number;
  boxNumber: number | null;
  productId: string;
  productName: string;
  refrigerated: boolean;
  unit: string;
  quantity: number;
  price: number;
  supplierStatus: SupplierOrderStatus;
  deliveryDay: string;
  orderCreatedAt: string;
  orderStatus: Order["status"];
  userId: string;
  customerName: string | null;
  customerEmail: string | null;
}

export async function getSupplierOrders(supplierId: string): Promise<SupplierOrderItem[]> {
  // PostgREST caps a single request at 1000 rows, so page through the supplier's
  // whole history. Busy suppliers pass 1000 line items and were silently losing
  // their newest orders. Ordered by id so paging is stable; the pages that use
  // this sort by delivery day themselves, and both need the full history (the
  // dashboard shows all-time totals, the orders page the "Nth order with you"
  // count and its loyalty milestones).
  const PAGE_SIZE = 1000;
  const fetchPage = (from: number) =>
    supabase
      .from("order_items")
      .select("*, orders(delivery_day, created_at, status, order_number, box_number, user_id, customer_name, customer_email), products(refrigerated)")
      .eq("supplier_id", supplierId)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

  type Row = NonNullable<Awaited<ReturnType<typeof fetchPage>>["data"]>[number];
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows.map((item) => {
    const order = item.orders as { delivery_day: string; created_at: string; status: string; order_number: number; box_number: number | null; user_id: string; customer_name: string | null; customer_email: string | null };
    const product = item.products as { refrigerated: boolean } | null;
    return {
      id: item.id,
      orderId: item.order_id,
      orderNumber: order?.order_number ?? 0,
      boxNumber: order?.box_number ?? null,
      productId: item.product_id,
      productName: item.product_name,
      refrigerated: product?.refrigerated ?? false,
      unit: item.unit ?? "",
      quantity: item.quantity,
      price: Number(item.price),
      supplierStatus: (item.supplier_status as SupplierOrderStatus) ?? "order_placed",
      deliveryDay: order?.delivery_day ?? "",
      orderCreatedAt: order ? new Date(order.created_at).toISOString().split("T")[0] : "",
      orderStatus: (order?.status as Order["status"]) ?? "ordered",
      userId: order?.user_id ?? "",
      customerName: order?.customer_name ?? null,
      customerEmail: order?.customer_email ?? null,
    };
  });
}

export async function updateSupplierOrderItemStatus(
  orderId: string,
  supplierId: string,
  status: SupplierOrderStatus
): Promise<void> {
  const { error } = await supabase
    .from("order_items")
    .update({ supplier_status: status })
    .eq("order_id", orderId)
    .eq("supplier_id", supplierId);
  if (error) throw error;
}

export async function getSupplierOrderCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("order_items")
    .select("supplier_id, quantity");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const item of data) {
    if (item.supplier_id) {
      counts[item.supplier_id] = (counts[item.supplier_id] || 0) + item.quantity;
    }
  }
  return counts;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function submitFeedback(name: string, message: string, source: "carrie" | "order_review" | "expansion" = "carrie", orderNumber?: number, postcode?: string, pageUrl?: string, email?: string): Promise<void> {
  const { error } = await supabase
    .from("feedback")
    .insert({ name: name || null, message, source, order_number: orderNumber ?? null, postcode: postcode ?? null, page_url: pageUrl ?? null, email: email ?? null });
  if (error) throw error;
}

export async function submitExpansionRequest(postcode: string, email?: string, name?: string): Promise<void> {
  const message = email 
    ? `Expansion request for postcode ${postcode}. Contact: ${email}`
    : `Expansion request for postcode ${postcode}`;
  await submitFeedback(name || "", message, "expansion", undefined, postcode, undefined, email);
}

export async function getFeedback(): Promise<{ id: string; name: string | null; message: string; created_at: string; source: string; orderNumber: number | null; postcode: string | null; pageUrl: string | null; email: string | null; featured: boolean }[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    message: f.message,
    created_at: f.created_at,
    source: f.source ?? "carrie",
    orderNumber: f.order_number ?? null,
    postcode: f.postcode ?? null,
    pageUrl: f.page_url ?? null,
    email: f.email ?? null,
    featured: f.featured ?? false,
  }));
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

export async function submitRating(userId: string, productId: string, orderId: string, stars: number, comment?: string): Promise<void> {
  const { error } = await supabase
    .from("ratings")
    .upsert({ user_id: userId, product_id: productId, order_id: orderId, stars, comment: comment || null }, { onConflict: "user_id,product_id,order_id" });
  if (error) throw error;
}

export async function submitOrderRatings(userId: string, orderId: string, ratings: Array<{ productId: string; stars: number | null; comment?: string }>): Promise<void> {
  const records = ratings.map((r) => ({
    user_id: userId,
    product_id: r.productId,
    order_id: orderId,
    stars: r.stars,
    comment: r.comment || null,
  }));
  const { error } = await supabase
    .from("ratings")
    .upsert(records, { onConflict: "user_id,product_id,order_id" });
  if (error) throw error;
}

export async function getRatingsByOrder(userId: string, orderId: string): Promise<Record<string, { stars: number; comment?: string }>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("product_id, stars, comment")
    .eq("user_id", userId)
    .eq("order_id", orderId);
  if (error) throw error;
  const map: Record<string, { stars: number; comment?: string }> = {};
  for (const r of data ?? []) map[r.product_id] = { stars: r.stars, comment: r.comment ?? undefined };
  return map;
}

export async function getProductRatings(productId: string): Promise<Array<{ stars: number; comment?: string; createdAt: string }>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("stars, comment, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ stars: r.stars, comment: r.comment ?? undefined, createdAt: r.created_at }));
}

export async function getSupplierReviews(supplierId: string): Promise<Array<{ productId: string; productName: string; stars: number | null; comment: string | null; createdAt: string }>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("product_id, stars, comment, created_at, products!inner(name, supplier_id)")
    .eq("products.supplier_id", supplierId)
    .or("stars.gt.0,comment.neq.")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Filter client-side to ensure we have either stars > 0 or non-empty comment
  return (data ?? [])
    .filter((r) => (r.stars && r.stars > 0) || (r.comment && r.comment.trim() !== ""))
    .map((r) => ({
      productId: r.product_id,
      productName: (r.products as any).name,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.created_at,
    }));
}

export async function getAllReviews(): Promise<Array<{ id: string; kind: "product_review" | "order_review"; productName: string | null; stars: number | null; comment: string; createdAt: string; customerName: string | null; isOverall: boolean; featured: boolean }>> {
  // Get product reviews
  const { data: productReviews, error: productError } = await supabase
    .from("ratings")
    .select("id, stars, comment, created_at, featured, products!inner(name)")
    .not("comment", "is", null)
    .neq("comment", "")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (productError) throw productError;

  // Get overall order reviews from feedback
  const { data: orderReviews, error: orderError } = await supabase
    .from("feedback")
    .select("id, name, message, created_at, featured")
    .eq("source", "order_review")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (orderError) throw orderError;

  // Combine and sort by featured first, then date descending
  const combined = [
    ...(productReviews ?? []).map((r) => ({
      id: r.id,
      kind: "product_review" as const,
      productName: (r.products as any).name as string,
      stars: r.stars as number,
      comment: r.comment!,
      createdAt: r.created_at,
      customerName: null,
      isOverall: false,
      featured: r.featured ?? false,
    })),
    ...(orderReviews ?? []).map((f) => ({
      id: f.id,
      kind: "order_review" as const,
      productName: null,
      stars: null,
      comment: f.message,
      createdAt: f.created_at,
      customerName: f.name,
      isOverall: true,
      featured: f.featured ?? false,
    })),
  ];

  // Sort by featured first, then by date descending within each group
  combined.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return combined.slice(0, 10);
}

// ─── Customer Profiles ──────────────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  clerkUserId: string;
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  hasOutstandingBox: boolean;
  // Standing delivery details - the profile is the home, orders snapshot them weekly
  phone: string | null;
  deliveryInstructions: string | null;
  pinLat: number | null;
  pinLng: number | null;
  // Saved for prefill: the window default and their usual safe place. The
  // in/out delivery option is deliberately NOT saved - it's a weekly decision.
  defaultDeliveryWindow: DeliveryWindow | null;
  defaultSafePlace: string | null;
  // Admin-only ("gate code 1234") - never shown to the customer
  adminNotes: string | null;
}

export async function getCustomerProfile(clerkUserId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (error) return null;
  return {
    id: data.id,
    clerkUserId: data.clerk_user_id,
    name: data.name ?? null,
    addressLine1: data.address_line1 ?? null,
    addressLine2: data.address_line2 ?? null,
    city: data.city ?? null,
    postcode: data.postcode ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    hasOutstandingBox: data.has_outstanding_box ?? false,
    phone: data.phone ?? null,
    deliveryInstructions: data.delivery_instructions ?? null,
    pinLat: data.pin_lat != null ? Number(data.pin_lat) : null,
    pinLng: data.pin_lng != null ? Number(data.pin_lng) : null,
    defaultDeliveryWindow: (data.default_delivery_window as DeliveryWindow) ?? null,
    defaultSafePlace: data.default_safe_place ?? null,
    adminNotes: data.admin_notes ?? null,
  };
}

// The customer's standing delivery details, editable from their account page.
// Only the fields provided are written; orders already placed are unaffected
// (they carry their own snapshot) - changes apply from the next order.
export interface CustomerDeliveryDetails {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  phone?: string | null;
  deliveryInstructions?: string | null;
  pinLat?: number | null;
  pinLng?: number | null;
  defaultDeliveryWindow?: string | null;
  defaultSafePlace?: string | null;
}

export async function updateCustomerDeliveryDetails(
  clerkUserId: string,
  details: CustomerDeliveryDetails,
  client: SupabaseClient = supabase,
): Promise<void> {
  const row: Record<string, unknown> = {
    clerk_user_id: clerkUserId,
    updated_at: new Date().toISOString(),
  };
  if (details.name !== undefined) row.name = details.name;
  if (details.addressLine1 !== undefined) row.address_line1 = details.addressLine1;
  if (details.addressLine2 !== undefined) row.address_line2 = details.addressLine2;
  if (details.city !== undefined) row.city = details.city;
  if (details.postcode !== undefined) row.postcode = details.postcode;
  if (details.phone !== undefined) row.phone = details.phone;
  if (details.deliveryInstructions !== undefined) row.delivery_instructions = details.deliveryInstructions;
  if (details.pinLat !== undefined) row.pin_lat = details.pinLat;
  if (details.pinLng !== undefined) row.pin_lng = details.pinLng;
  if (details.defaultDeliveryWindow !== undefined) row.default_delivery_window = details.defaultDeliveryWindow;
  if (details.defaultSafePlace !== undefined) row.default_safe_place = details.defaultSafePlace;

  const { error } = await client
    .from("customer_profiles")
    .upsert(row, { onConflict: "clerk_user_id" });
  if (error) throw error;
}

export async function updateCustomerAdminNotes(clerkUserId: string, notes: string | null): Promise<void> {
  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      { clerk_user_id: clerkUserId, admin_notes: notes, updated_at: new Date().toISOString() },
      { onConflict: "clerk_user_id" },
    );
  if (error) throw error;
}

// Segment thresholds (weeks since last order). Named so they're easy to tune
// as the business ages - with only a few months of trading, "churned" is a
// soft signal, not a verdict.
export const SEGMENT_CURRENT_WEEKS = 4;   // ordered within this = current
export const SEGMENT_CHURNED_WEEKS = 8;   // quiet for longer than this = churned
export const SEGMENT_NEW_DAYS = 28;       // first order within this = new
export const TOP_CUSTOMER_FRACTION = 0.1; // top 10% by lifetime spend get the star

export type CustomerSegment = "new" | "current" | "lapsing" | "churned";

export interface CustomerSummary {
  clerkUserId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  deliveryInstructions: string | null;
  defaultSafePlace: string | null;
  adminNotes: string | null;
  hasOutstandingBox: boolean;
  totalOrders: number;
  totalSpent: number; // kept for the top-10% calculation; not displayed as a figure
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  avgGapDays: number | null; // average days between orders (null with <2 orders)
  segment: CustomerSegment;
  isTopCustomer: boolean;
  boxDepositOrders: number;
}

function customerSegment(firstOrder: string, lastOrder: string): CustomerSegment {
  const now = Date.now();
  const daysSinceLast = (now - new Date(lastOrder).getTime()) / 86400000;
  const daysSinceFirst = (now - new Date(firstOrder).getTime()) / 86400000;
  if (daysSinceLast > SEGMENT_CHURNED_WEEKS * 7) return "churned";
  if (daysSinceLast > SEGMENT_CURRENT_WEEKS * 7) return "lapsing";
  if (daysSinceFirst <= SEGMENT_NEW_DAYS) return "new";
  return "current";
}

export async function getAllCustomers(): Promise<CustomerSummary[]> {
  // Get all orders grouped by user
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("user_id, customer_email, customer_name, total, created_at, box_deposit_paid, status")
    .neq("status", "cancelled");
  if (ordersError) throw ordersError;

  // Get all customer profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("customer_profiles")
    .select("clerk_user_id, name, phone, address_line1, address_line2, city, postcode, delivery_instructions, default_safe_place, admin_notes, has_outstanding_box");
  if (profilesError) throw profilesError;

  const profileMap = new Map(profiles?.map(p => [p.clerk_user_id, p]) ?? []);

  // Group orders by user
  interface Grouped {
    email: string | null;
    orderName: string | null;
    totalOrders: number;
    totalSpent: number;
    firstOrderDate: string;
    lastOrderDate: string;
    orderDates: string[];
    boxDepositOrders: number;
  }
  const grouped = new Map<string, Grouped>();

  for (const order of orders ?? []) {
    if (!order.user_id) continue;
    const g = grouped.get(order.user_id);
    if (g) {
      g.totalOrders += 1;
      g.totalSpent += Number(order.total);
      g.orderDates.push(order.created_at);
      if (order.box_deposit_paid) g.boxDepositOrders += 1;
      if (order.created_at > g.lastOrderDate) g.lastOrderDate = order.created_at;
      if (order.created_at < g.firstOrderDate) g.firstOrderDate = order.created_at;
      if (!g.email && order.customer_email) g.email = order.customer_email;
      if (!g.orderName && order.customer_name) g.orderName = order.customer_name;
    } else {
      grouped.set(order.user_id, {
        email: order.customer_email ?? null,
        orderName: order.customer_name ?? null,
        totalOrders: 1,
        totalSpent: Number(order.total),
        firstOrderDate: order.created_at,
        lastOrderDate: order.created_at,
        orderDates: [order.created_at],
        boxDepositOrders: order.box_deposit_paid ? 1 : 0,
      });
    }
  }

  const summaries: CustomerSummary[] = [];
  for (const [userId, g] of grouped) {
    const profile = profileMap.get(userId);
    // Average days between orders, from the span first->last
    const avgGapDays = g.totalOrders >= 2
      ? Math.round((new Date(g.lastOrderDate).getTime() - new Date(g.firstOrderDate).getTime()) / 86400000 / (g.totalOrders - 1))
      : null;
    summaries.push({
      clerkUserId: userId,
      name: profile?.name ?? g.orderName ?? null,
      email: g.email,
      phone: profile?.phone ?? null,
      addressLine1: profile?.address_line1 ?? null,
      addressLine2: profile?.address_line2 ?? null,
      city: profile?.city ?? null,
      postcode: profile?.postcode ?? null,
      deliveryInstructions: profile?.delivery_instructions ?? null,
      defaultSafePlace: profile?.default_safe_place ?? null,
      adminNotes: profile?.admin_notes ?? null,
      hasOutstandingBox: profile?.has_outstanding_box ?? false,
      totalOrders: g.totalOrders,
      totalSpent: g.totalSpent,
      firstOrderDate: g.firstOrderDate,
      lastOrderDate: g.lastOrderDate,
      avgGapDays,
      segment: customerSegment(g.firstOrderDate, g.lastOrderDate),
      isTopCustomer: false, // filled in below once all totals are known
      boxDepositOrders: g.boxDepositOrders,
    });
  }

  // Top N% by lifetime spend get the star
  const topCount = Math.max(1, Math.ceil(summaries.length * TOP_CUSTOMER_FRACTION));
  const bySpend = [...summaries].sort((a, b) => b.totalSpent - a.totalSpent);
  const topIds = new Set(bySpend.slice(0, topCount).map(s => s.clerkUserId));
  for (const s of summaries) s.isTopCustomer = topIds.has(s.clerkUserId);

  // Alphabetical by name (no-name customers last, by email)
  return summaries.sort((a, b) => {
    if (a.name && b.name) return a.name.localeCompare(b.name);
    if (a.name) return -1;
    if (b.name) return 1;
    return (a.email ?? "").localeCompare(b.email ?? "");
  });
}

// Lightweight per-customer info for the Driver Run stop cards: the
// outstanding-box flag plus the admin-only notes ("gate code 1234").
export async function getCustomerDriverInfo(userIds: string[]): Promise<Map<string, { hasOutstandingBox: boolean; adminNotes: string | null }>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("clerk_user_id, has_outstanding_box, admin_notes")
    .in("clerk_user_id", userIds);
  if (error) throw error;
  const map = new Map<string, { hasOutstandingBox: boolean; adminNotes: string | null }>();
  for (const row of data ?? []) {
    map.set(row.clerk_user_id, {
      hasOutstandingBox: row.has_outstanding_box ?? false,
      adminNotes: row.admin_notes ?? null,
    });
  }
  return map;
}

export async function saveCustomerAddress(
  clerkUserId: string,
  address: { addressLine1: string; addressLine2?: string; city: string; postcode: string },
  lat: number,
  lng: number
): Promise<void> {
  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      {
        clerk_user_id: clerkUserId,
        address_line1: address.addressLine1,
        address_line2: address.addressLine2 || null,
        city: address.city,
        postcode: address.postcode,
        lat,
        lng,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );
  if (error) throw error;
}

export async function clearCustomerAddress(clerkUserId: string): Promise<void> {
  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      {
        clerk_user_id: clerkUserId,
        address_line1: null,
        address_line2: null,
        city: null,
        postcode: null,
        lat: null,
        lng: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );
  if (error) throw error;
}

export async function setCustomerOutstandingBox(clerkUserId: string, hasBox: boolean, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client
    .from("customer_profiles")
    .upsert(
      {
        clerk_user_id: clerkUserId,
        has_outstanding_box: hasBox,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );
  if (error) throw error;
}

export async function toggleBoxReturned(orderId: string, returned: boolean): Promise<void> {
  // Get the order to find the user
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("user_id, box_deposit_paid")
    .eq("id", orderId)
    .single();
  
  if (orderError || !order) throw orderError ?? new Error("Order not found");
  if (!order.box_deposit_paid) return; // No deposit to track
  
  // Toggle customer's outstanding box status
  // returned = true means box is back, so hasOutstandingBox = false
  // returned = false means box is still out, so hasOutstandingBox = true
  const { error } = await supabase
    .from("customer_profiles")
    .update({ has_outstanding_box: !returned, updated_at: new Date().toISOString() })
    .eq("clerk_user_id", order.user_id);
  
  if (error) throw error;
}

// Save just postcode (used by map page postcode checker)
export async function saveCustomerPostcode(
  clerkUserId: string,
  postcode: string,
  lat: number,
  lng: number
): Promise<void> {
  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      { clerk_user_id: clerkUserId, postcode, lat, lng, updated_at: new Date().toISOString() },
      { onConflict: "clerk_user_id" }
    );
  if (error) throw error;
}

export async function getCustomerBoxStatuses(userIds: string[]): Promise<Map<string, boolean>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("clerk_user_id, has_outstanding_box")
    .in("clerk_user_id", userIds);
  if (error) throw error;
  const map = new Map<string, boolean>();
  for (const row of data ?? []) {
    map.set(row.clerk_user_id, row.has_outstanding_box ?? false);
  }
  return map;
}

// ─── Delivery Area (Polygon) ─────────────────────────────────────────────────

// polygon_geojson is a GeoJSON Feature or Geometry of type Polygon or MultiPolygon
export interface DeliveryArea {
  polygonGeojson: any;  // keep as any — we pass it straight to turf
  updatedAt: string;
}

export async function getDeliveryArea(client: SupabaseClient = supabase): Promise<DeliveryArea | null> {
  const { data, error } = await client
    .from("delivery_area")
    .select("polygon_geojson, updated_at")
    .eq("id", "current")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    polygonGeojson: data.polygon_geojson,
    updatedAt: data.updated_at,
  };
}

export async function saveDeliveryArea(polygonGeojson: any, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client
    .from("delivery_area")
    .upsert(
      { id: "current", polygon_geojson: polygonGeojson, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw error;
}

export async function deleteDeliveryArea(client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client
    .from("delivery_area")
    .delete()
    .eq("id", "current");
  if (error) throw error;
}

export async function getAverageRatings(): Promise<Record<string, { avg: number; count: number }>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("product_id, stars");
  if (error) throw error;
  const map: Record<string, { total: number; count: number }> = {};
  for (const r of data ?? []) {
    if (!map[r.product_id]) map[r.product_id] = { total: 0, count: 0 };
    map[r.product_id].total += r.stars;
    map[r.product_id].count += 1;
  }
  const result: Record<string, { avg: number; count: number }> = {};
  for (const [id, { total, count }] of Object.entries(map)) {
    result[id] = { avg: total / count, count };
  }
  return result;
}

export async function getProductRatingAverages(): Promise<Array<{ productId: string; productName: string; avgStars: number; ratingCount: number }>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("product_id, stars, products!inner(name)");
  if (error) throw error;
  
  const map: Record<string, { productName: string; total: number; count: number }> = {};
  for (const r of data ?? []) {
    const productName = (r.products as unknown as { name: string })?.name ?? "";
    if (!map[r.product_id]) map[r.product_id] = { productName, total: 0, count: 0 };
    map[r.product_id].total += r.stars;
    map[r.product_id].count += 1;
  }
  
  return Object.entries(map).map(([productId, { productName, total, count }]) => ({
    productId,
    productName,
    avgStars: total / count,
    ratingCount: count,
  }));
}

export async function getProductOrderCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id, quantity");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const item of data ?? []) {
    counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
  }
  return counts;
}

// ─── Top-up Session Tracking (Idempotency) ───────────────────────────────────

export async function isTopUpSessionProcessed(sessionId: string): Promise<{ orderId: string } | null> {
  const { data, error } = await supabase
    .from("topup_sessions")
    .select("order_id")
    .eq("stripe_session_id", sessionId)
    .single();
  if (error || !data) return null;
  return { orderId: data.order_id };
}

export async function markTopUpSessionProcessed(sessionId: string, orderId: string): Promise<void> {
  const { error } = await supabase
    .from("topup_sessions")
    .insert({ stripe_session_id: sessionId, order_id: orderId });
  if (error && error.code !== "23505") throw error; // Ignore duplicate key errors
}

export async function getOrdersWithTopUps(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("topup_sessions")
    .select("order_id");
  if (error || !data) return new Set();
  return new Set(data.map((row) => row.order_id));
}

// ─── Shared Checkout Helpers ─────────────────────────────────────────────────

/**
 * Parse order items from Stripe metadata.
 * Items are stored as "productId:quantity:supplierId" strings, split across items0, items1, etc.
 * Also handles legacy format where items were JSON in a single "items" field.
 */
export async function parseItemsFromMetadata(metadata: Record<string, string>): Promise<OrderItem[]> {
  // Collect item chunks from items0, items1, etc.
  let allItemsStr = "";
  for (let i = 0; ; i++) {
    const chunk = metadata[`items${i}`];
    if (!chunk) break;
    allItemsStr = allItemsStr ? `${allItemsStr},${chunk}` : chunk;
  }

  // Handle legacy format with single "items" JSON field
  if (!allItemsStr && metadata.items) {
    try {
      const oldItems = JSON.parse(metadata.items);
      const parsedItems = await Promise.all(
        oldItems.map(async (item: { p: string; q: number; s: string } | { productId: string; productName: string; quantity: number; price: number; supplierId: string }) => {
          if ("p" in item) {
            const product = await getProduct(item.p);
            return { 
              productId: item.p, 
              productName: product?.name || "Unknown Product", 
              unit: product?.unit || "",
              quantity: item.q, 
              price: product?.price || 0, 
              supplierId: item.s 
            };
          } else {
            const product = await getProduct(item.productId);
            return { 
              productId: item.productId, 
              productName: item.productName, 
              unit: product?.unit || "",
              quantity: item.quantity, 
              price: item.price, 
              supplierId: item.supplierId 
            };
          }
        })
      );
      return parsedItems;
    } catch {
      return [];
    }
  }

  // Parse current format: "productId:quantity:supplierId,productId:quantity:supplierId,..."
  if (!allItemsStr) return [];
  
  const items: OrderItem[] = await Promise.all(
    allItemsStr.split(",").filter(Boolean).map(async (itemStr) => {
      const [productId, quantityStr, supplierId] = itemStr.split(":");
      const product = await getProduct(productId);
      return {
        productId,
        productName: product?.name || "Unknown Product",
        unit: product?.unit || "",
        quantity: parseInt(quantityStr, 10),
        price: product?.price || 0,
        supplierId,
        supplierName: product?.supplierName,
      };
    })
  );
  
  return items;
}

/**
 * Rollback a processed top-up session if adding items fails.
 * This allows the session to be retried.
 */
export async function rollbackTopUpSession(sessionId: string): Promise<void> {
  await supabase
    .from("topup_sessions")
    .delete()
    .eq("stripe_session_id", sessionId);
}

// ─── Email Signups ───────────────────────────────────────────────────────────

export async function submitEmailSignup(email: string): Promise<void> {
  const { error } = await supabase
    .from("email_signups")
    .insert({ email: email.toLowerCase().trim() });
  if (error) {
    if (error.code === "23505") {
      // Duplicate email - that's fine, just ignore
      return;
    }
    throw error;
  }
}

// ─── Delivery Tracking ──────────────────────────────────────────────────────

export interface OrderItemCheckin {
  id: string;
  orderId: string;
  supplierId: string;
  productName: string;
  quantity: number;
  checkedInAt: string;
}

export type RefundPaidBy = "local" | "supplier" | "50-50";
export type RefundReasonType = "didnt_arrive" | "quality" | "damaged" | "missing_from_box" | "other";

// Shared refund reason config (stock + deliveries pages).
// itemArrived drives the payout maths: false = the item never reached the
// warehouse (supplier simply isn't paid for it - no separate deduction);
// true = it arrived and was paid for, so a supplier/50-50 refund is deducted
// from the payout. "Missing from box" is the post-delivery case: stock was
// checked in but the customer didn't get it - usually a packing slip, so
// Local pays by default, but who-pays stays selectable.
export const refundReasonConfig: Record<RefundReasonType, { label: string; itemArrived: boolean; defaultPaidBy: RefundPaidBy }> = {
  didnt_arrive: { label: "Didn't arrive", itemArrived: false, defaultPaidBy: "supplier" },
  quality: { label: "Quality issue", itemArrived: true, defaultPaidBy: "supplier" },
  damaged: { label: "Damaged in transit", itemArrived: true, defaultPaidBy: "50-50" },
  missing_from_box: { label: "Missing from box", itemArrived: true, defaultPaidBy: "local" },
  other: { label: "Other", itemArrived: true, defaultPaidBy: "local" },
};

export interface OrderItemRefund {
  id: string;
  orderId: string;
  productName: string;
  quantityRefunded: number;
  refundAmount: number;
  reasonType: RefundReasonType;
  refundReason: string | null;
  itemArrived: boolean;
  refundedAt: string;
  paidBy: RefundPaidBy;
  supplierId: string | null;
  // Explicit £ the supplier bears for this refund (retail value, pre-commission).
  // Null on older rows = legacy behaviour (see supplierPayoutAdjustment).
  supplierDeduction: number | null;
}

// The £ to subtract from the supplier's arrived total for one refund.
// Didn't-arrive units are already excluded from the arrived total (never
// ticked in), so an explicit deduction there nets against the units' value -
// a deduction below full value comes out as a credit back (negative), e.g.
// when the supplier substituted the item and shouldn't lose the whole line.
// unitPrice is the order line's unit price for the refunded product.
export function supplierPayoutAdjustment(refund: OrderItemRefund, unitPrice: number): number {
  if (refund.supplierDeduction !== null) {
    if (refund.itemArrived) return refund.supplierDeduction;
    return refund.supplierDeduction - refund.quantityRefunded * unitPrice;
  }
  // Legacy rows: didn't-arrive is fully docked via the ticks (no adjustment);
  // arrived refunds deduct the who-pays share.
  if (!refund.itemArrived || refund.paidBy === "local") return 0;
  return refund.paidBy === "supplier" ? refund.refundAmount : refund.refundAmount / 2;
}

// ─── Order Item Check-ins ───────────────────────────────────────────────────
// The ticks in order_item_checkins are the single source of truth for what
// arrived: per-product totals are summed from them client-side.

export async function getOrderItemCheckins(deliveryDay: string): Promise<OrderItemCheckin[]> {
  // Get check-ins for all orders on this delivery day
  const { data, error } = await supabase
    .from("order_item_checkins")
    .select("*, orders!inner(delivery_day)")
    .eq("orders.delivery_day", deliveryDay);
  
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    orderId: d.order_id,
    supplierId: d.supplier_id,
    productName: d.product_name,
    quantity: d.quantity,
    checkedInAt: d.checked_in_at,
  }));
}

// Idempotent set (not a toggle): safe against double-taps and out-of-order
// responses - the row ends up matching the checkbox the user last saw.
export async function setOrderItemCheckin(
  orderId: string,
  supplierId: string,
  productName: string,
  quantity: number,
  checked: boolean
): Promise<void> {
  if (checked) {
    const { error } = await supabase
      .from("order_item_checkins")
      .upsert({
        order_id: orderId,
        supplier_id: supplierId,
        product_name: productName,
        quantity: quantity,
      }, { onConflict: "order_id,supplier_id,product_name" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("order_item_checkins")
      .delete()
      .eq("order_id", orderId)
      .eq("supplier_id", supplierId)
      .eq("product_name", productName);
    if (error) throw error;
  }
}

export async function getOrderItemRefunds(orderId: string): Promise<OrderItemRefund[]> {
  const { data, error } = await supabase
    .from("order_item_refunds")
    .select("*")
    .eq("order_id", orderId);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    orderId: d.order_id,
    productName: d.product_name,
    quantityRefunded: d.quantity_refunded,
    refundAmount: Number(d.refund_amount),
    reasonType: (d.reason_type as RefundReasonType) || "other",
    refundReason: d.refund_reason,
    itemArrived: d.item_arrived ?? true,
    refundedAt: d.refunded_at,
    paidBy: (d.paid_by as RefundPaidBy) || "local",
    supplierId: d.supplier_id,
    supplierDeduction: d.supplier_deduction === null || d.supplier_deduction === undefined ? null : Number(d.supplier_deduction),
  }));
}

export async function getRefundsForDeliveryDay(deliveryDay: string): Promise<OrderItemRefund[]> {
  // Get all orders for this delivery day, then get their refunds
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("delivery_day", deliveryDay);
  if (ordersError) throw ordersError;
  if (!orders || orders.length === 0) return [];
  
  const orderIds = orders.map(o => o.id);
  const { data, error } = await supabase
    .from("order_item_refunds")
    .select("*")
    .in("order_id", orderIds);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    orderId: d.order_id,
    productName: d.product_name,
    quantityRefunded: d.quantity_refunded,
    refundAmount: Number(d.refund_amount),
    reasonType: (d.reason_type as RefundReasonType) || "other",
    refundReason: d.refund_reason,
    itemArrived: d.item_arrived ?? true,
    refundedAt: d.refunded_at,
    paidBy: (d.paid_by as RefundPaidBy) || "local",
    supplierId: d.supplier_id,
    supplierDeduction: d.supplier_deduction === null || d.supplier_deduction === undefined ? null : Number(d.supplier_deduction),
  }));
}

export async function createOrderItemRefund(
  orderId: string,
  productName: string,
  quantityRefunded: number,
  refundAmount: number,
  reasonType: RefundReasonType,
  refundReason: string | null,
  itemArrived: boolean,
  paidBy: RefundPaidBy,
  supplierId: string | null,
  supplierDeduction: number | null = null
): Promise<void> {
  const { error } = await supabase
    .from("order_item_refunds")
    .insert({
      order_id: orderId,
      product_name: productName,
      quantity_refunded: quantityRefunded,
      refund_amount: refundAmount,
      reason_type: reasonType,
      refund_reason: refundReason,
      item_arrived: itemArrived,
      paid_by: paidBy,
      supplier_id: supplierId,
      supplier_deduction: supplierDeduction,
    });
  if (error) throw error;
}

export async function deleteOrderItemRefund(refundId: string): Promise<void> {
  const { error } = await supabase
    .from("order_item_refunds")
    .delete()
    .eq("id", refundId);
  if (error) throw error;
}

// ─── Supplier Product Flags (can't supply this week) ─────────────────────────

export interface SupplierProductFlag {
  id: string;
  deliveryDay: string;
  supplierId: string;
  productName: string;
  quantityUnavailable: number | null; // null = whole line can't be supplied
  flaggedAt: string;
  flaggedBy: "supplier" | "admin";
  resolved: boolean;
  resolvedAt: string | null;
}

export async function getSupplierProductFlags(deliveryDay: string): Promise<SupplierProductFlag[]> {
  const { data, error } = await supabase
    .from("supplier_product_flags")
    .select("*")
    .eq("delivery_day", deliveryDay);
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    deliveryDay: f.delivery_day,
    supplierId: f.supplier_id,
    productName: f.product_name,
    quantityUnavailable: f.quantity_unavailable ?? null,
    flaggedAt: f.flagged_at,
    flaggedBy: f.flagged_by as "supplier" | "admin",
    resolved: f.resolved ?? false,
    resolvedAt: f.resolved_at,
  }));
}

export async function createSupplierProductFlag(
  deliveryDay: string,
  supplierId: string,
  productName: string,
  flaggedBy: "supplier" | "admin",
  quantityUnavailable: number | null = null
): Promise<void> {
  const { error } = await supabase
    .from("supplier_product_flags")
    .upsert({
      delivery_day: deliveryDay,
      supplier_id: supplierId,
      product_name: productName,
      quantity_unavailable: quantityUnavailable,
      flagged_by: flaggedBy,
      flagged_at: new Date().toISOString(),
      resolved: false,
    }, { onConflict: "delivery_day,supplier_id,product_name" });
  if (error) throw error;
}

export async function resolveSupplierProductFlag(
  deliveryDay: string,
  supplierId: string,
  productName: string
): Promise<void> {
  const { error } = await supabase
    .from("supplier_product_flags")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("delivery_day", deliveryDay)
    .eq("supplier_id", supplierId)
    .eq("product_name", productName);
  if (error) throw error;
}

export async function removeSupplierProductFlag(
  deliveryDay: string,
  supplierId: string,
  productName: string
): Promise<void> {
  const { error } = await supabase
    .from("supplier_product_flags")
    .delete()
    .eq("delivery_day", deliveryDay)
    .eq("supplier_id", supplierId)
    .eq("product_name", productName);
  if (error) throw error;
}

// ─── Supplier Check-in Completion ────────────────────────────────────────────
// A supplier's check-in is "complete" for a delivery day when a row exists.
// Until then, under-counts are still "in progress" (not treated as shortages).

export async function getCompletedCheckins(deliveryDay: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("supplier_checkin_status")
    .select("supplier_id")
    .eq("delivery_day", deliveryDay);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.supplier_id as string));
}

export async function setCheckinComplete(deliveryDay: string, supplierId: string): Promise<void> {
  const { error } = await supabase
    .from("supplier_checkin_status")
    .upsert({
      delivery_day: deliveryDay,
      supplier_id: supplierId,
      completed_at: new Date().toISOString(),
    }, { onConflict: "delivery_day,supplier_id" });
  if (error) throw error;
}

export async function reopenCheckin(deliveryDay: string, supplierId: string): Promise<void> {
  const { error } = await supabase
    .from("supplier_checkin_status")
    .delete()
    .eq("delivery_day", deliveryDay)
    .eq("supplier_id", supplierId);
  if (error) throw error;
}

// ─── Admin Product Reviews ────────────────────────────────────────────────────

export interface AdminProductReview {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  stars: number | null;
  comment: string | null;
  userId: string;
  orderId: string;
  createdAt: string;
  featured: boolean;
}

export async function getAllProductReviewsForAdmin(): Promise<AdminProductReview[]> {
  const { data, error } = await supabase
    .from("ratings")
    .select("id, product_id, stars, comment, user_id, order_id, created_at, featured, products!inner(name, supplier_id, suppliers(name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const product = r.products as any;
    return {
      id: r.id,
      productId: r.product_id,
      productName: product.name,
      supplierId: product.supplier_id,
      supplierName: product.suppliers?.name ?? "Unknown",
      stars: r.stars,
      comment: r.comment,
      userId: r.user_id,
      orderId: r.order_id,
      createdAt: r.created_at,
      featured: r.featured ?? false,
    };
  });
}

export async function setReviewFeatured(
  kind: "product_review" | "order_review",
  id: string,
  featured: boolean,
  client: SupabaseClient = supabase
): Promise<void> {
  const table = kind === "product_review" ? "ratings" : "feedback";
  const { error } = await client
    .from(table).update({ featured }).eq("id", id);
  if (error) throw error;
}

// ─── Supplier Order Feedback ──────────────────────────────────────────────────

export interface SupplierOrderFeedback {
  id: string;
  message: string;
  orderNumber: number;
  createdAt: string;
  customerName: string | null;
}

export async function getSupplierOrderFeedback(supplierId: string): Promise<SupplierOrderFeedback[]> {
  // Get order_review feedback for orders that contain products from this supplier
  // Path: feedback.order_number → orders.order_number → order_items → products.supplier_id
  
  // First get all order numbers that have items from this supplier
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, orders!inner(order_number)")
    .eq("supplier_id", supplierId);
  if (itemsError) throw itemsError;
  
  const orderNumbers = [...new Set((orderItems ?? []).map((item) => (item.orders as any).order_number as number))];
  if (orderNumbers.length === 0) return [];
  
  // Get feedback for those order numbers
  const { data: feedback, error: feedbackError } = await supabase
    .from("feedback")
    .select("*")
    .eq("source", "order_review")
    .in("order_number", orderNumbers)
    .order("created_at", { ascending: false });
  if (feedbackError) throw feedbackError;
  
  return (feedback ?? []).map((f) => ({
    id: f.id,
    message: f.message,
    orderNumber: f.order_number,
    createdAt: f.created_at,
    customerName: f.name,
  }));
}

// ─── Saved Baskets ────────────────────────────────────────────────────────────

export interface SavedBasket {
  id: string;
  userId: string;
  customerEmail: string | null;
  items: Array<{ productId: string; quantity: number }>;
  total: number;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
  reminderSentAt: string | null;
}

export interface SavedBasketWithProducts extends SavedBasket {
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    supplierName: string;
  }>;
}

export async function saveBasket(
  userId: string,
  customerEmail: string | null,
  items: Array<{ productId: string; quantity: number }>,
  total: number
): Promise<void> {
  // Keyed on EMAIL (not the Clerk user id) so a customer's single saved basket
  // survives Clerk id changes (e.g. the dev->prod instance migration) and follows
  // them across devices. We still record the current user_id for reference.
  if (!customerEmail) return;

  const { data: existing } = await supabase
    .from("saved_baskets")
    .select("id")
    .eq("customer_email", customerEmail)
    .is("converted_at", null)
    .maybeSingle();

  if (items.length === 0) {
    // Cart emptied: delete the pending basket rather than leaving a £0 row in the
    // admin list. Safe from the "removed items come back" problem - the server now
    // holds nothing, so nothing is restored on the next visit.
    if (existing) {
      const { error } = await supabase
        .from("saved_baskets")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    }
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from("saved_baskets")
      .update({
        user_id: userId,
        items,
        total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    // Post-checkout race guard: markBasketConverted (normal + top-up checkout)
    // stamps converted_at on the basket the customer just ordered. A late
    // debounced save from the browser must not recreate a fresh pending basket
    // in the seconds after that. If this email converted a basket in the last 5
    // minutes, skip re-creating one. (A genuinely new shop later saves normally.)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentlyConverted } = await supabase
      .from("saved_baskets")
      .select("id")
      .eq("customer_email", customerEmail)
      .gte("converted_at", fiveMinutesAgo)
      .limit(1)
      .maybeSingle();
    if (recentlyConverted) return;

    const { error } = await supabase
      .from("saved_baskets")
      .insert({
        user_id: userId,
        customer_email: customerEmail,
        items,
        total,
      });
    if (error) throw error;
  }
}

export async function markBasketConverted(customerEmail: string): Promise<void> {
  if (!customerEmail) return;
  const { error } = await supabase
    .from("saved_baskets")
    .update({ converted_at: new Date().toISOString() })
    .eq("customer_email", customerEmail)
    .is("converted_at", null);
  if (error) throw error;
}

export async function getSavedBaskets(): Promise<SavedBasketWithProducts[]> {
  const { data, error } = await supabase
    .from("saved_baskets")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  // Get all product IDs from all baskets
  const allProductIds = new Set<string>();
  for (const basket of data ?? []) {
    for (const item of (basket.items as Array<{ productId: string }>) ?? []) {
      allProductIds.add(item.productId);
    }
  }

  // Fetch product details
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, supplier_id, suppliers(name)")
    .in("id", Array.from(allProductIds));

  const productMap = new Map(
    (products ?? []).map((p) => {
      const supplier = p.suppliers as { name: string } | { name: string }[] | null;
      const supplierName = Array.isArray(supplier) ? supplier[0]?.name : supplier?.name;
      return [
        p.id,
        {
          name: p.name,
          price: Number(p.price),
          supplierName: supplierName ?? "Unknown",
        },
      ];
    })
  );

  return (data ?? []).map((b) => ({
    id: b.id,
    userId: b.user_id,
    customerEmail: b.customer_email,
    items: b.items as Array<{ productId: string; quantity: number }>,
    total: Number(b.total),
    createdAt: b.created_at,
    updatedAt: b.updated_at,
    convertedAt: b.converted_at,
    reminderSentAt: b.reminder_sent_at ?? null,
    products: ((b.items as Array<{ productId: string; quantity: number }>) ?? []).map((item) => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        productName: product?.name ?? "Unknown product",
        quantity: item.quantity,
        price: product?.price ?? 0,
        supplierName: product?.supplierName ?? "Unknown",
      };
    }),
  }));
}

export async function getSavedBasketByEmail(customerEmail: string): Promise<SavedBasket | null> {
  if (!customerEmail) return null;
  const { data, error } = await supabase
    .from("saved_baskets")
    .select("*")
    .eq("customer_email", customerEmail)
    .is("converted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    customerEmail: data.customer_email,
    items: data.items as Array<{ productId: string; quantity: number }>,
    total: Number(data.total),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    convertedAt: data.converted_at,
    reminderSentAt: data.reminder_sent_at ?? null,
  };
}

export async function deleteSavedBasket(id: string): Promise<void> {
  const { error } = await supabase.from("saved_baskets").delete().eq("id", id);
  if (error) throw error;
}
