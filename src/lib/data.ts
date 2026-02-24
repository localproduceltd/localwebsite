import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  category: string;
}

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
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  createdAt: string;
  deliveryDay: string;
}

export interface DeliveryDay {
  id: string;
  dayOfWeek: string;
  cutoffTime: string;
  active: boolean;
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
    userId: o.user_id,
    items: (o.order_items as Array<{ product_id: string; product_name: string; quantity: number; price: number }>).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: Number(item.price),
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
    .order("id");
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    dayOfWeek: d.day_of_week,
    cutoffTime: d.cutoff_time,
    active: d.active,
  }));
}

export async function getActiveDeliveryDays(): Promise<DeliveryDay[]> {
  const { data, error } = await supabase
    .from("delivery_days")
    .select("*")
    .eq("active", true)
    .order("id");
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    dayOfWeek: d.day_of_week,
    cutoffTime: d.cutoff_time,
    active: d.active,
  }));
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
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, description: data.description, image: data.image, location: data.location, category: data.category };
}

export async function updateSupplier(supplier: Supplier): Promise<void> {
  const { error } = await supabase.from("suppliers").update({
    name: supplier.name,
    description: supplier.description,
    image: supplier.image,
    location: supplier.location,
    category: supplier.category,
  }).eq("id", supplier.id);
  if (error) throw error;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateOrderStatus(orderId: string, status: Order["status"]): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

export async function updateDeliveryDay(day: DeliveryDay): Promise<void> {
  const { error } = await supabase.from("delivery_days").update({
    active: day.active,
    cutoff_time: day.cutoffTime,
  }).eq("id", day.id);
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
    }))
  );
  if (itemsError) throw itemsError;

  return {
    id: order.id,
    userId: order.user_id,
    items,
    total: Number(order.total),
    status: order.status as Order["status"],
    createdAt: new Date(order.created_at).toISOString().split("T")[0],
    deliveryDay: order.delivery_day,
  };
}
