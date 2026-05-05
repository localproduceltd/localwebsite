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

// Products data for Shaun's Fresh Fish & Seafood
const products = [
  {
    name: "Fresh Haddock Boneless Fillets (7/8oz)",
    category: "Fish & Seafood",
    price: 10.00,
    unit: "pack of 2",
    description: "Fresh Norwegian haddock, boneless fillets at 7/8oz each. Perfect for fish and chips, baking or pan-frying.",
    locality: "International",
    variable_location: false,
    allergens: ["fish"],
    tags: ["gluten-free", "dairy-free"],
  },
  {
    name: "Fresh Salmon Boneless Portions (200g)",
    category: "Fish & Seafood",
    price: 10.00,
    unit: "pack of 2",
    description: "Fresh Scottish farmed salmon, boneless 200g portions. Rich in omega-3, perfect for grilling, baking or pan-searing.",
    locality: "UK",
    variable_location: false,
    allergens: ["fish"],
    tags: ["gluten-free", "dairy-free"],
  },
  {
    name: "Fresh Seabass Fillets (Boneless & Scaled)",
    category: "Fish & Seafood",
    price: 10.00,
    unit: "pack of 2",
    description: "Fresh wild Atlantic seabass fillets, boneless and scaled. Delicate, sweet flavour – ideal for pan-frying or roasting.",
    locality: "International",
    variable_location: false,
    allergens: ["fish"],
    tags: ["gluten-free", "dairy-free"],
  },
  {
    name: "Fresh Natural Smoked Haddock Portions",
    category: "Fish & Seafood",
    price: 10.00,
    unit: "pack of 2",
    description: "Fresh haddock, naturally smoked in Grimsby. No artificial dyes – just traditional smoking for a rich, golden finish. Perfect for kedgeree or poaching.",
    locality: "UK",
    variable_location: false,
    allergens: ["fish"],
    tags: ["gluten-free", "dairy-free"],
  },
  {
    name: "Fresh Cod Boneless Portions",
    category: "Fish & Seafood",
    price: 10.00,
    unit: "pack of 2",
    description: "Fresh Icelandic cod, boneless portions. Firm, flaky white fish – great for fish pies, battered fish or simply baked with herbs.",
    locality: "International",
    variable_location: false,
    allergens: ["fish"],
    tags: ["gluten-free", "dairy-free"],
  },
];

async function main() {
  // First, find the supplier
  console.log("Looking for Shaun's Fresh Fish & Seafood...");
  
  const { data: suppliers, error: searchError } = await supabase
    .from("suppliers")
    .select("id, name, status")
    .ilike("name", "%shaun%fish%");

  if (searchError) {
    console.error("Error searching for supplier:", searchError);
    process.exit(1);
  }

  if (!suppliers || suppliers.length === 0) {
    console.error("❌ Supplier not found. Please check the supplier exists in the database.");
    console.log("\nSearching for any fish-related suppliers...");
    
    const { data: fishSuppliers } = await supabase
      .from("suppliers")
      .select("id, name, status")
      .or("name.ilike.%fish%,name.ilike.%seafood%,category.eq.Fishmonger");
    
    if (fishSuppliers && fishSuppliers.length > 0) {
      console.log("Found these suppliers:");
      fishSuppliers.forEach(s => console.log(`  - ${s.name} (${s.status})`));
    }
    process.exit(1);
  }

  const supplier = suppliers[0];
  console.log(`✓ Found supplier: ${supplier.name} (ID: ${supplier.id}, Status: ${supplier.status})`);

  // Insert products
  console.log(`\nCreating ${products.length} products...`);
  
  for (const product of products) {
    const { error: productError } = await supabase.from("products").insert({
      supplier_id: supplier.id,
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
      console.log(`✓ ${product.name} (${product.locality})`);
    }
  }

  console.log("\n✅ Upload complete!");
  console.log(`Supplier: ${supplier.name}`);
  console.log(`Products: ${products.length} items added`);
}

main();
