import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupplierStatus = "launch_live" | "launch_not_live" | "development_live" | "development_coming_soon" | "archived";

export interface Supplier {
  id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  category: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
  status: SupplierStatus;
}

export interface SupplierUser {
  id: string;
  clerkUserId: string;
  supplierId: string;
}

export type Locality = "Own Produce" | "Local" | "Regional" | "UK" | "International";

export const LOCALITY_OPTIONS: Locality[] = ["Own Produce", "Local", "Regional", "UK", "International"];

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
  locality: Locality;
  lat: number | null;
  lng: number | null;
  status: ProductStatus;
}

export type SupplierOrderStatus = "order_placed" | "prepping" | "dropped_at_depot" | "delivered" | "cancelled";

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  supplierId?: string;
  supplierStatus?: SupplierOrderStatus;
}

export interface Order {
  id: string;
  orderNumber: number;
  userId: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  createdAt: string;
  deliveryDay: string;
}

export interface DeliveryDay {
  id: string;
  deliveryDate: string;
  cutoffDate: string;
  cutoffTime: string;
}

// ─── Data access functions (powered by Supabase) ─────────────────────────────

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
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
    active: s.active ?? true,
    status: s.status ?? "launch_live",
  }));
}

// Development: get suppliers with development_live or development_coming_soon status
// Orders by status (development_live first, then development_coming_soon), then by name
export async function getPreLaunchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .in("status", ["development_live", "development_coming_soon"])
    .order("status")
    .order("name");
  if (error) throw error;
  // Sort so development_live comes before development_coming_soon
  const sorted = data.sort((a, b) => {
    if (a.status === "development_live" && b.status === "development_coming_soon") return -1;
    if (a.status === "development_coming_soon" && b.status === "development_live") return 1;
    return a.name.localeCompare(b.name);
  });
  return sorted.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    image: s.image,
    location: s.location,
    category: s.category,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    active: s.active ?? true,
    status: s.status ?? "launch_live",
  }));
}

// Launch: get suppliers with launch_live or launch_not_live status
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
    active: s.active ?? true,
    status: s.status ?? "launch_live",
  }));
}

// Get only launch_live suppliers (for homepage carousel etc.)
export async function getActiveSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("status", "launch_live")
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
    active: true,
    status: "launch_live" as const,
  }));
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
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
    active: data.active ?? true,
    status: data.status ?? "launch_live",
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, suppliers(name)")
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
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    status: (p.status as ProductStatus) ?? "approved",
  }));
}

// Get approved products from launch_live suppliers only (for launch mode)
export async function getApprovedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, suppliers!inner(name, active, status)")
    .eq("status", "approved")
    .eq("suppliers.status", "launch_live")
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
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    status: "approved" as ProductStatus,
  }));
}

export async function getProductsBySupplier(supplierId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, suppliers(name)")
    .eq("supplier_id", supplierId)
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
    locality: (p.locality as Locality) ?? "Local",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    status: (p.status as ProductStatus) ?? "approved",
  }));
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*, suppliers(name)")
    .eq("id", id)
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
    locality: (data.locality as Locality) ?? "Local",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    status: (data.status as ProductStatus) ?? "approved",
  };
}

export async function getOrders(userId?: string): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    userId: o.user_id,
    items: (o.order_items as Array<{ product_id: string; product_name: string; quantity: number; price: number; supplier_id?: string; supplier_status?: string }>).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: Number(item.price),
      supplierId: item.supplier_id ?? undefined,
      supplierStatus: (item.supplier_status as SupplierOrderStatus) ?? "order_placed",
    })),
    total: Number(o.total),
    status: o.status as Order["status"],
    createdAt: new Date(o.created_at).toISOString().split("T")[0],
    deliveryDay: o.delivery_day,
  }));
}

export async function getDeliveryDays(): Promise<DeliveryDay[]> {
  const { data, error } = await supabase
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

// ─── Write functions ─────────────────────────────────────────────────────────

export async function createProduct(product: Omit<Product, "id" | "supplierName">): Promise<void> {
  const { error } = await supabase.from("products").insert({
    name: product.name,
    description: product.description,
    price: product.price,
    unit: product.unit,
    image: product.image,
    category: product.category,
    in_stock: product.inStock,
    supplier_id: product.supplierId,
    locality: product.locality,
    lat: product.lat,
    lng: product.lng,
    status: product.status ?? "approved",
  });
  if (error) throw error;
}

export async function updateProduct(product: Product): Promise<void> {
  const { error } = await supabase.from("products").update({
    name: product.name,
    description: product.description,
    price: product.price,
    unit: product.unit,
    image: product.image,
    category: product.category,
    in_stock: product.inStock,
    supplier_id: product.supplierId,
    locality: product.locality,
    lat: product.lat,
    lng: product.lng,
    status: product.status,
  }).eq("id", product.id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function createSupplier(supplier: Omit<Supplier, "id">): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").insert({
    name: supplier.name,
    description: supplier.description,
    image: supplier.image,
    location: supplier.location,
    category: supplier.category,
    lat: supplier.lat,
    lng: supplier.lng,
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, description: data.description, image: data.image, location: data.location, category: data.category, lat: data.lat ?? null, lng: data.lng ?? null, active: data.active ?? true, status: data.status ?? "launch_live" };
}

export async function updateSupplier(supplier: Supplier): Promise<void> {
  const { error } = await supabase.from("suppliers").update({
    name: supplier.name,
    description: supplier.description,
    image: supplier.image,
    location: supplier.location,
    category: supplier.category,
    lat: supplier.lat,
    lng: supplier.lng,
    active: supplier.active,
    status: supplier.status,
  }).eq("id", supplier.id);
  if (error) throw error;
}

export async function deleteSupplier(id: string): Promise<void> {
  // Delete supplier user links
  await supabase.from("supplier_users").delete().eq("supplier_id", id);
  
  // Get all product IDs for this supplier
  const { data: products } = await supabase.from("products").select("id").eq("supplier_id", id);
  const productIds = products?.map((p) => p.id) ?? [];
  
  if (productIds.length > 0) {
    // Delete order items for these products
    await supabase.from("order_items").delete().in("product_id", productIds);
    // Delete ratings for these products
    await supabase.from("ratings").delete().in("product_id", productIds);
    // Delete the products
    await supabase.from("products").delete().eq("supplier_id", id);
  }
  
  // Delete supplier order items
  await supabase.from("supplier_order_items").delete().eq("supplier_id", id);
  
  // Finally delete the supplier
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateOrderStatus(orderId: string, status: Order["status"]): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
  // Delivered/cancelled cascade is handled by a DB trigger (cascade_order_status)
}

export async function createDeliveryDay(day: Omit<DeliveryDay, "id">): Promise<DeliveryDay> {
  const { data, error } = await supabase.from("delivery_days").insert({
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

export async function updateDeliveryDay(day: DeliveryDay): Promise<void> {
  const { error } = await supabase.from("delivery_days").update({
    delivery_date: day.deliveryDate,
    cutoff_date: day.cutoffDate,
    cutoff_time: day.cutoffTime,
  }).eq("id", day.id);
  if (error) throw error;
}

export async function deleteDeliveryDay(id: string): Promise<void> {
  const { error } = await supabase.from("delivery_days").delete().eq("id", id);
  if (error) throw error;
}

export async function createOrder(userId: string, total: number, deliveryDay: string, items: OrderItem[]): Promise<Order> {
  const { data: order, error } = await supabase
    .from("orders")
    .insert({ user_id: userId, total, status: "pending", delivery_day: deliveryDay })
    .select()
    .single();
  if (error || !order) throw error ?? new Error("Failed to create order");

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price,
      supplier_id: item.supplierId ?? null,
      supplier_status: "order_placed",
    }))
  );
  if (itemsError) throw itemsError;

  return {
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    items,
    total: Number(order.total),
    status: order.status as Order["status"],
    createdAt: new Date(order.created_at).toISOString().split("T")[0],
    deliveryDay: order.delivery_day,
  };
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

export async function getSupplierUsers(): Promise<(SupplierUser & { supplierName: string })[]> {
  const { data, error } = await supabase
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

export async function createSupplierUser(clerkUserId: string, supplierId: string): Promise<void> {
  const { error } = await supabase.from("supplier_users").insert({
    clerk_user_id: clerkUserId,
    supplier_id: supplierId,
  });
  if (error) throw error;
}

export async function deleteSupplierUser(id: string): Promise<void> {
  const { error } = await supabase.from("supplier_users").delete().eq("id", id);
  if (error) throw error;
}

// ─── Product status functions ───────────────────────────────────────────────

export async function updateProductStatus(productId: string, status: ProductStatus): Promise<void> {
  const { error } = await supabase.from("products").update({ status }).eq("id", productId);
  if (error) throw error;
}

// ─── Supplier Order functions ───────────────────────────────────────────────

export interface SupplierOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  supplierStatus: SupplierOrderStatus;
  deliveryDay: string;
  orderCreatedAt: string;
  orderStatus: Order["status"];
}

export async function getSupplierOrders(supplierId: string): Promise<SupplierOrderItem[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("*, orders(delivery_day, created_at, status)")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false, referencedTable: "orders" });
  if (error) throw error;
  return data.map((item) => {
    const order = item.orders as { delivery_day: string; created_at: string; status: string };
    return {
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: Number(item.price),
      supplierStatus: (item.supplier_status as SupplierOrderStatus) ?? "order_placed",
      deliveryDay: order?.delivery_day ?? "",
      orderCreatedAt: order ? new Date(order.created_at).toISOString().split("T")[0] : "",
      orderStatus: (order?.status as Order["status"]) ?? "pending",
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

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function submitFeedback(name: string, message: string): Promise<void> {
  const { error } = await supabase
    .from("feedback")
    .insert({ name: name || null, message });
  if (error) throw error;
}

export async function getFeedback(): Promise<{ id: string; name: string | null; message: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

export async function submitRating(userId: string, productId: string, orderId: string, stars: number): Promise<void> {
  const { error } = await supabase
    .from("ratings")
    .upsert({ user_id: userId, product_id: productId, order_id: orderId, stars }, { onConflict: "user_id,product_id,order_id" });
  if (error) throw error;
}

export async function getRatingsByOrder(userId: string, orderId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("product_id, stars")
    .eq("user_id", userId)
    .eq("order_id", orderId);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const r of data ?? []) map[r.product_id] = r.stars;
  return map;
}

export async function getProductRatings(productId: string): Promise<Array<{ stars: number; createdAt: string }>> {
  const { data, error } = await supabase
    .from("ratings")
    .select("stars, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ stars: r.stars, createdAt: r.created_at }));
}

// ─── Customer Profiles ──────────────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  clerkUserId: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
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
    addressLine1: data.address_line1 ?? null,
    addressLine2: data.address_line2 ?? null,
    city: data.city ?? null,
    postcode: data.postcode ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
  };
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

// ─── Delivery Zones ─────────────────────────────────────────────────────────

export type ZoneStatus = "live" | "not_live";

export interface DeliveryZone {
  id: string;
  name: string;
  centreLat: number;
  centreLng: number;
  radiusMiles: number;
  zoneStatus: ZoneStatus;
  launchDate: string | null; // ISO date string for not_live zones
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    centreLat: d.centre_lat,
    centreLng: d.centre_lng,
    radiusMiles: d.radius_miles,
    zoneStatus: (d.zone_status as ZoneStatus) ?? "live",
    launchDate: d.launch_date ?? null,
  }));
}

export async function createDeliveryZone(zone: Omit<DeliveryZone, "id">): Promise<DeliveryZone> {
  const { data, error } = await supabase
    .from("delivery_zones")
    .insert({
      name: zone.name,
      centre_lat: zone.centreLat,
      centre_lng: zone.centreLng,
      radius_miles: zone.radiusMiles,
      zone_status: zone.zoneStatus,
      launch_date: zone.launchDate,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    centreLat: data.centre_lat,
    centreLng: data.centre_lng,
    radiusMiles: data.radius_miles,
    zoneStatus: (data.zone_status as ZoneStatus) ?? "live",
    launchDate: data.launch_date ?? null,
  };
}

export async function updateDeliveryZone(zone: DeliveryZone): Promise<void> {
  const { error } = await supabase
    .from("delivery_zones")
    .update({
      name: zone.name,
      centre_lat: zone.centreLat,
      centre_lng: zone.centreLng,
      radius_miles: zone.radiusMiles,
      zone_status: zone.zoneStatus,
      launch_date: zone.launchDate,
    })
    .eq("id", zone.id);
  if (error) throw error;
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) throw error;
}

// Legacy compat — kept so old imports don't break during migration
export type DeliverySettings = DeliveryZone;
export async function getDeliverySettings(): Promise<DeliverySettings | null> {
  const zones = await getDeliveryZones();
  return zones[0] ?? null;
}
export async function updateDeliverySettings(settings: DeliverySettings): Promise<void> {
  return updateDeliveryZone(settings);
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
