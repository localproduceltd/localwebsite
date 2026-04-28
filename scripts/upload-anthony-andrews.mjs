import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supplier data
const supplier = {
  name: "Anthony Andrews Butchers",
  description: "Anthony Andrews Butchers is a traditional family butcher based in the village of Duffield, Derbyshire. Known for their quality Derbyshire dry-aged beef and homemade sausages using free-range pork, they have been supplying the local community with premium, locally sourced meat for years.",
  image: "/images/suppliers/anthony-andrews.jpg",
  location: "Duffield",
  category: "Butcher",
  lat: 52.9878,
  lng: -1.4867,
  status: "launch_not_live",
  email: null,
};

// Products data - allergens mapped to IDs
const products = [
  {
    name: "Pork Sausages (Thin)",
    category: "Meat & Poultry",
    price: 3.95,
    unit: "pack of 6",
    description: "Homemade thin pork sausages made with free-range pork. A traditional butcher's recipe, great for breakfast or a classic sausage sandwich.",
    locality: "Local",
    variable_location: true,
    allergens: ["gluten", "mustard"],
    tags: [],
  },
  {
    name: "Pork and Tomato Sausages (Thin)",
    category: "Meat & Poultry",
    price: 3.95,
    unit: "pack of 6",
    description: "Thin pork sausages with a hint of tomato, made in-house using free-range pork. A lighter, flavourful twist on a classic.",
    locality: "Local",
    variable_location: true,
    allergens: ["gluten", "mustard"],
    tags: [],
  },
  {
    name: "Cumberland Pork Sausages (Thick)",
    category: "Meat & Poultry",
    price: 5.50,
    unit: "pack of 6",
    description: "Thick Cumberland-style pork sausages, packed with herbs and spices. Made with free-range pork by Anthony Andrews' in-house team.",
    locality: "Local",
    variable_location: true,
    allergens: ["gluten", "mustard"],
    tags: [],
  },
  {
    name: "Cracked Black Pepper Sausages (Thick)",
    category: "Meat & Poultry",
    price: 5.50,
    unit: "pack of 6",
    description: "Thick free-range pork sausages with a bold cracked black pepper seasoning. Made in the traditional butcher style for a real depth of flavour.",
    locality: "Local",
    variable_location: true,
    allergens: ["gluten", "mustard"],
    tags: [],
  },
  {
    name: "Dry Cured Plain Back Bacon",
    category: "Meat & Poultry",
    price: 4.75,
    unit: "pack of 6 rashers",
    description: "Traditionally dry cured plain back bacon from Anthony Andrews. Minimal water content means it cooks beautifully and tastes exactly as bacon should.",
    locality: "Local",
    variable_location: true,
    allergens: ["sulphites"],
    tags: [],
  },
  {
    name: "Dry Cured Oak Smoked Back Bacon",
    category: "Meat & Poultry",
    price: 4.85,
    unit: "pack of 6 rashers",
    description: "Dry cured back bacon with a gentle oak smoke finish. Rich, deep flavour that elevates any bacon sandwich or cooked breakfast.",
    locality: "Local",
    variable_location: true,
    allergens: ["sulphites"],
    tags: [],
  },
  {
    name: "Chicken Fillets (Grade A, Barn Reared)",
    category: "Meat & Poultry",
    price: 6.95,
    unit: "pack of 2",
    description: "Grade A barn-reared chicken fillets, sourced and prepared by Anthony Andrews. Tender, well-trimmed, and ready to cook.",
    locality: "Local",
    variable_location: true,
    allergens: [],
    tags: [],
  },
  {
    name: "Minced Beef",
    category: "Meat & Poultry",
    price: 7.75,
    unit: "500g",
    description: "Derbyshire dry-aged minced beef, freshly prepared in store. Full of flavour and perfect for burgers, bolognese, or meatballs.",
    locality: "Local",
    variable_location: true,
    allergens: [],
    tags: [],
  },
  {
    name: "Stewing Beef",
    category: "Meat & Poultry",
    price: 8.75,
    unit: "500g",
    description: "Derbyshire dry-aged stewing beef, hand-cut for slow cooking. Deeply flavourful and ideal for casseroles, stews, and pies.",
    locality: "Local",
    variable_location: true,
    allergens: [],
    tags: [],
  },
];

async function main() {
  console.log("Creating supplier: Anthony Andrews Butchers...");
  
  // Insert supplier
  const { data: supplierData, error: supplierError } = await supabase
    .from("suppliers")
    .insert(supplier)
    .select()
    .single();

  if (supplierError) {
    console.error("Error creating supplier:", supplierError);
    process.exit(1);
  }

  console.log("✓ Supplier created with ID:", supplierData.id);

  // Insert products
  console.log(`\nCreating ${products.length} products...`);
  
  for (const product of products) {
    const { error: productError } = await supabase.from("products").insert({
      supplier_id: supplierData.id,
      name: product.name,
      description: product.description,
      price: product.price,
      unit: product.unit,
      image: "",
      category: product.category,
      in_stock: true,
      locality: product.locality,
      lat: null,
      lng: null,
      variable_location: product.variable_location,
      status: "approved",
      allergens: product.allergens,
      tags: product.tags,
    });

    if (productError) {
      console.error(`Error creating product "${product.name}":`, productError);
    } else {
      console.log(`✓ ${product.name}`);
    }
  }

  console.log("\n✅ Upload complete!");
  console.log(`Supplier: ${supplier.name} (status: ${supplier.status})`);
  console.log(`Products: ${products.length} items added`);
}

main();
