import { supabase } from "@/lib/supabase";

// Vercel rejects request bodies over 4.5MB with a plain-text error before the
// API route ever runs, so larger photos must be shrunk in the browser first.
const COMPRESS_THRESHOLD = 3 * 1024 * 1024;
const MAX_DIMENSION = 1600; // matches the server-side Sharp resize

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image. Please try a different photo."));
    };
    img.src = url;
  });
}

async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not process that image. Please try a smaller photo.");
  }

  // JPEG has no transparency, so flatten onto white rather than black
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) {
    throw new Error("Could not process that image. Please try a smaller photo.");
  }
  return blob;
}

async function readErrorMessage(response: Response): Promise<string> {
  if (response.status === 413) {
    return "That image is too large to upload. Please try a smaller photo.";
  }
  try {
    const data = await response.json();
    if (data?.error) return data.error;
  } catch {
    // Response wasn't JSON (e.g. a plain-text platform error) - fall through
  }
  return `Upload failed (${response.status}). Please try again.`;
}

export async function uploadProductImage(file: File): Promise<string> {
  let upload: Blob = file;
  let fileName = file.name;

  if (file.size > COMPRESS_THRESHOLD) {
    upload = await compressImage(file);
    fileName = file.name.replace(/\.\w+$/, "") + ".jpg";
  }

  const formData = new FormData();
  formData.append("file", upload, fileName);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
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
