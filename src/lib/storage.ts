import { supabase } from "@/lib/supabase";

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Upload failed");
  }

  const data = await response.json();
  return data.url;
}

export async function deleteProductImage(url: string): Promise<void> {
  const path = url.split("/product-images/").pop();
  if (!path) return;

  const { error } = await supabase.storage
    .from("product-images")
    .remove([path]);

  if (error) {
    console.error("Error deleting image:", error);
  }
}
