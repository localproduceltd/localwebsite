# Supabase Storage Setup for Product Images

This guide explains how to set up Supabase Storage for product image uploads.

## Setup Instructions

### 1. Run the Storage Setup SQL

In your Supabase dashboard:
1. Go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `/sql/storage-setup.sql`
4. Run the query

This will:
- Create a public storage bucket called `product-images`
- Set up the necessary access policies for authenticated users to upload, update, and delete images
- Allow public read access to all product images

### 2. Verify Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. You should see a bucket named `product-images`
3. The bucket should be marked as **Public**

## How It Works

### For Suppliers

When adding or editing a product:
1. Click the image upload area or "Change Image" button
2. Select a JPEG, PNG, or WebP file (max 5MB)
3. The image is automatically uploaded to Supabase Storage
4. The public URL is saved with the product

### Technical Details

- **Storage bucket**: `product-images`
- **File naming**: Random hash + timestamp to prevent conflicts
- **Max file size**: 5MB
- **Accepted formats**: JPEG, PNG, WebP
- **Access**: Public read, authenticated write

### Image Upload Component

The `ImageUpload` component (`/src/components/ImageUpload.tsx`) handles:
- File selection and validation
- Upload progress indication
- Preview display
- Image removal
- Error handling

### Storage Utilities

The storage utilities (`/src/lib/storage.ts`) provide:
- `uploadProductImage(file)` - Uploads a file and returns the public URL
- `deleteProductImage(url)` - Deletes an image from storage (optional cleanup)

## Troubleshooting

### Images not uploading
- Check that the storage bucket exists and is public
- Verify the storage policies are set up correctly
- Check browser console for error messages

### Images not displaying
- Verify the public URL is correctly formatted
- Check that the bucket is set to public access
- Ensure CORS is configured if needed

### File size errors
- Maximum file size is 5MB
- Compress images before uploading if needed
