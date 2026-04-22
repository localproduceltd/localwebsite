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

// UK 14 major allergens
export const ALLERGENS = [
  { id: "celery", label: "Celery" },
  { id: "gluten", label: "Gluten" },
  { id: "crustaceans", label: "Crustaceans" },
  { id: "eggs", label: "Eggs" },
  { id: "fish", label: "Fish" },
  { id: "lupin", label: "Lupin" },
  { id: "milk", label: "Milk" },
  { id: "molluscs", label: "Molluscs" },
  { id: "mustard", label: "Mustard" },
  { id: "nuts", label: "Nuts" },
  { id: "peanuts", label: "Peanuts" },
  { id: "sesame", label: "Sesame" },
  { id: "soya", label: "Soya" },
  { id: "sulphites", label: "Sulphur dioxide / sulphites" },
] as const;

export type Allergen = typeof ALLERGENS[number]["id"];

// Product tags (dietary/lifestyle)
export const PRODUCT_TAGS = [
  { id: "vegan", label: "Vegan", color: "bg-green-100 text-green-700" },
  { id: "vegetarian", label: "Vegetarian", color: "bg-emerald-100 text-emerald-700" },
  { id: "organic", label: "Organic", color: "bg-lime-100 text-lime-700" },
  { id: "gluten-free", label: "Gluten Free", color: "bg-amber-100 text-amber-700" },
  { id: "dairy-free", label: "Dairy Free", color: "bg-sky-100 text-sky-700" },
] as const;

export type ProductTag = typeof PRODUCT_TAGS[number]["id"];
