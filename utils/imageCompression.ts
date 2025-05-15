/**
 * Browser-compatible image compression utility
 * Uses Canvas API instead of Sharp to work in browser environments
 */

/**
 * Compresses an image using the browser's Canvas API
 * 
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns A Promise that resolves to the compressed image as a Blob
 */
export async function compressImage(
  file: File,
  options: {
    quality?: number; // 0-1, default 0.6 (higher compression)
    maxWidth?: number; // Maximum width in pixels
    maxHeight?: number; // Maximum height in pixels
    format?: 'jpeg' | 'png' | 'webp'; // Output format, default is jpeg for better compression
  } = {}
): Promise<Blob> {
  // Default options with higher compression
  const quality = options.quality !== undefined ? options.quality / 100 : 0.4; // Lower quality = higher compression
  const maxWidth = options.maxWidth || 1600; // Smaller default dimensions
  const maxHeight = options.maxHeight || 1600;
  
  // Create image from file
  const img = new Image();
  const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  
  // Create object URL from file
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  
  // Wait for image to load
  await imgPromise;
  
  // Release object URL
  URL.revokeObjectURL(objectUrl);
  
  // Calculate new dimensions while maintaining aspect ratio
  let width = img.width;
  let height = img.height;
  
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }
  
  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Draw image on canvas
  ctx.drawImage(img, 0, 0, width, height);
  
  // Determine output format - prefer JPEG for better compression
  let format = options.format;
  if (!format) {
    // Use JPEG by default for better compression unless PNG is explicitly needed (for transparency)
    if (file.type.includes('png') && needsTransparency(canvas)) {
      format = 'png';
    } else {
      format = 'jpeg';
    }
  }
  
  // Convert format to mime type
  let mimeType: string;
  switch (format) {
    case 'jpeg':
      mimeType = 'image/jpeg';
      break;
    case 'png':
      mimeType = 'image/png';
      break;
    case 'webp':
      mimeType = 'image/webp';
      break;
    default:
      mimeType = 'image/jpeg';
  }
  
  // Convert canvas to blob with specified quality
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Checks if an image has transparency that needs to be preserved
 * 
 * @param canvas - The canvas containing the image
 * @returns True if the image has transparency that should be preserved
 */
function needsTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  
  // Sample the image data to check for transparency
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Check a subset of pixels for transparency (checking every pixel would be too slow)
  const pixelCount = data.length / 4; // RGBA = 4 bytes per pixel
  const sampleSize = Math.min(pixelCount, 10000); // Check up to 10,000 pixels
  const stride = Math.max(1, Math.floor(pixelCount / sampleSize));
  
  for (let i = 3; i < data.length; i += 4 * stride) {
    if (data[i] < 255) { // Alpha channel less than 255 means transparency
      return true;
    }
  }
  
  return false;
}

/**
 * Compresses an image and returns it as a new File object
 * 
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns A Promise that resolves to the compressed image as a File
 */
export async function compressImageToFile(
  file: File,
  options: {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}
): Promise<File> {
  // Apply stronger compression by default for specific file types
  let compressionOptions = { ...options };
  
  // If no quality specified, use different defaults based on file size
  if (compressionOptions.quality === undefined) {
    if (file.size > 5 * 1024 * 1024) { // > 5MB
      compressionOptions.quality = 50; // Heavy compression
    } else if (file.size > 1 * 1024 * 1024) { // > 1MB
      compressionOptions.quality = 60; // Medium-heavy compression
    } else {
      compressionOptions.quality = 70; // Standard compression
    }
  }
  
  const compressedBlob = await compressImage(file, compressionOptions);
  
  // Determine the output format and create appropriate mime type
  let mimeType: string;
  let extension: string;
  
  if (options.format) {
    switch (options.format) {
      case 'jpeg':
        mimeType = 'image/jpeg';
        extension = 'jpg';
        break;
      case 'png':
        mimeType = 'image/png';
        extension = 'png';
        break;
      case 'webp':
        mimeType = 'image/webp';
        extension = 'webp';
        break;
      default:
        mimeType = file.type;
        extension = file.name.split('.').pop() || 'jpg';
    }
  } else {
    // Default to JPEG for better compression unless we detected PNG with transparency
    if (compressedBlob.type.includes('png')) {
      mimeType = 'image/png';
      extension = 'png';
    } else {
      mimeType = 'image/jpeg';
      extension = 'jpg';
    }
  }
  
  // Create a new filename
  const filename = file.name.replace(/\.[^/.]+$/, '') + '_compressed.' + extension;
  
  // Create a new File from the blob
  return new File([compressedBlob], filename, { type: mimeType });
} 