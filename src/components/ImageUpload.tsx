"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { uploadProductImage } from "@/lib/storage";

interface ImageUploadProps {
  currentImage: string;
  onImageChange: (url: string) => void;
  label?: string;
}

export default function ImageUpload({ currentImage, onImageChange, label = "Product Image" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const url = await uploadProductImage(file);
      onImageChange(url);
      setPreview(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image. Please try again.";
      alert(errorMessage);
      setPreview(currentImage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview("");
    onImageChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-primary">{label}</label>
      
      {preview ? (
        <div className="relative">
          <div className="relative h-48 w-full overflow-hidden rounded-lg border-2 border-primary/10">
            <img
              src={preview}
              alt="Product preview"
              className="h-full w-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg hover:bg-red-600 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/20 bg-surface transition hover:border-secondary hover:bg-secondary/5 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-primary/30" />
              <div className="text-center">
                <p className="text-sm font-medium text-primary">Click to upload image</p>
                <p className="text-xs text-muted">JPEG, PNG, or WebP (max 5MB)</p>
              </div>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview && !uploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-sm font-medium text-primary transition hover:bg-secondary/10"
        >
          <Upload size={14} />
          Change Image
        </button>
      )}
    </div>
  );
}
