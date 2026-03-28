// Fixed product categories for the marketplace
export const PRODUCT_CATEGORIES = [
  "Vegetables",
  "Fruit",
  "Salad & Herbs",
  "Meat & Poultry",
  "Fish & Seafood",
  "Dairy",
  "Cheese",
  "Eggs",
  "Bread",
  "Pastries & Cakes",
  "Pantry",
  "Preserves & Condiments",
  "Drinks",
  "Other",
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
