import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_DIMENSION = 1600;
const ICON_MAX_DIMENSION = 400;
const WEBP_QUALITY = 80;

// Skip these files (favicons, manifests, etc.)
const SKIP_PATTERNS = [
  /favicon/i,
  /android-chrome/i,
  /apple-touch-icon/i,
  /\.svg$/i,
  /\.ico$/i,
  /\.webmanifest$/i,
];

interface ImageResult {
  file: string;
  originalSize: number;
  newSize: number;
  outputPath: string;
}

async function findImages(dir: string): Promise<string[]> {
  const images: string[] = [];
  
  if (!fs.existsSync(dir)) return images;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      images.push(...await findImages(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if ([".png", ".jpg", ".jpeg"].includes(ext)) {
        // Check skip patterns
        const shouldSkip = SKIP_PATTERNS.some(pattern => pattern.test(entry.name));
        if (!shouldSkip) {
          images.push(fullPath);
        }
      }
    }
  }
  
  return images;
}

async function optimiseImage(imagePath: string): Promise<ImageResult> {
  const originalSize = fs.statSync(imagePath).size;
  const metadata = await sharp(imagePath).metadata();
  
  // Determine if this is an icon (small aspect ratio or small dimensions)
  const isIcon = (metadata.width && metadata.height) && 
    (Math.max(metadata.width, metadata.height) <= 200 || 
     (metadata.width <= 100 && metadata.height <= 100));
  
  const maxDim = isIcon ? ICON_MAX_DIMENSION : MAX_DIMENSION;
  
  // Build output path (same name but .webp extension)
  const dir = path.dirname(imagePath);
  const baseName = path.basename(imagePath, path.extname(imagePath));
  const outputPath = path.join(dir, `${baseName}.webp`);
  
  // Process the image
  await sharp(imagePath)
    .resize(maxDim, maxDim, { 
      fit: "inside", 
      withoutEnlargement: true 
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);
  
  const newSize = fs.statSync(outputPath).size;
  
  return {
    file: path.relative(PUBLIC_DIR, imagePath),
    originalSize,
    newSize,
    outputPath: path.relative(PUBLIC_DIR, outputPath),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  console.log("🔍 Finding images in /public...\n");
  
  const images = await findImages(PUBLIC_DIR);
  
  if (images.length === 0) {
    console.log("No images found to optimise.");
    return;
  }
  
  console.log(`Found ${images.length} images to process.\n`);
  
  const results: ImageResult[] = [];
  
  for (const imagePath of images) {
    try {
      const result = await optimiseImage(imagePath);
      results.push(result);
      console.log(`✓ ${result.file}`);
    } catch (error) {
      console.error(`✗ ${path.relative(PUBLIC_DIR, imagePath)}: ${error}`);
    }
  }
  
  // Print summary table
  console.log("\n" + "=".repeat(80));
  console.log("BEFORE/AFTER SIZE COMPARISON");
  console.log("=".repeat(80));
  console.log(
    "File".padEnd(40) + 
    "Original".padStart(12) + 
    "WebP".padStart(12) + 
    "Savings".padStart(12)
  );
  console.log("-".repeat(80));
  
  let totalOriginal = 0;
  let totalNew = 0;
  
  for (const result of results) {
    const savings = result.originalSize - result.newSize;
    const savingsPercent = ((savings / result.originalSize) * 100).toFixed(0);
    totalOriginal += result.originalSize;
    totalNew += result.newSize;
    
    console.log(
      result.file.substring(0, 39).padEnd(40) +
      formatBytes(result.originalSize).padStart(12) +
      formatBytes(result.newSize).padStart(12) +
      `${formatBytes(savings)} (${savingsPercent}%)`.padStart(16)
    );
  }
  
  console.log("-".repeat(80));
  const totalSavings = totalOriginal - totalNew;
  const totalSavingsPercent = ((totalSavings / totalOriginal) * 100).toFixed(0);
  console.log(
    "TOTAL".padEnd(40) +
    formatBytes(totalOriginal).padStart(12) +
    formatBytes(totalNew).padStart(12) +
    `${formatBytes(totalSavings)} (${totalSavingsPercent}%)`.padStart(16)
  );
  console.log("=".repeat(80));
  
  console.log("\n✅ WebP versions created alongside originals.");
  console.log("   Review the .webp files, then update code references and delete originals.");
}

main().catch(console.error);
