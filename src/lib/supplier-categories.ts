/**
 * Supplier categories - the single source of truth.
 *
 * This is the badge shown to customers on supplier cards (home, /suppliers),
 * the supplier page and the map pin popup. It is display-only: nothing filters
 * or sorts on it.
 *
 * Both category dropdowns (admin + supplier portal) read this list, and
 * `/api/admin/suppliers` rejects anything not on it, so the onboarding skill
 * and any future script can't invent new values. There is also a CHECK
 * constraint on `suppliers.category` as a final backstop
 * (`20260828_supplier_category_constraint.sql`).
 *
 * Rewritten 28 Aug 2026: the old 10-item list had drifted to 17 values in the
 * database because onboarding wrote straight to Supabase. The organising rule
 * is what a supplier actually does, with grow/rear/make kept separate from
 * sell - which is why Grower is distinct from Greengrocer.
 *
 * If you add one: add it here, add it to the constraint in a new migration,
 * and update `context/suppliers.md`.
 */
export const SUPPLIER_CATEGORIES = [
  // They grow or rear it
  "Grower",
  "Farm",
  "Dairy",
  "Beekeeper",
  // Fresh shops and stalls
  "Greengrocer",
  "Butcher",
  "Fishmonger",
  "Farm Shop",
  // They make it
  "Bakery",
  "Cheesemaker",
  "Coffee Roaster",
  "Kitchen",
  // Pantry
  "Deli",
  "Refill Shop",
  // Non-food
  "Florist",
  "Home & Gifts",
  // Fallback - should stay empty
  "Other",
] as const;

export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

export function isSupplierCategory(value: unknown): value is SupplierCategory {
  return typeof value === "string" && (SUPPLIER_CATEGORIES as readonly string[]).includes(value);
}
