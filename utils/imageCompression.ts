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
    quality?: number; // 0-1, default 0.8
    maxWidth?: number; // Maximum width in pixels
    maxHeight?: number; // Maximum height in pixels
    format?: 'jpeg' | 'png' | 'webp'; // Output format, default is same as input
  } = {}
): Promise<Blob> {
  // Default options
  const quality = options.quality !== undefined ? options.quality / 100 : 0.8;
  const maxWidth = options.maxWidth || 2000;
  const maxHeight = options.maxHeight || 2000;
  
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
  
  // Determine output format
  let format = options.format;
  if (!format) {
    // Try to use the same format as the input
    if (file.type.includes('jpeg') || file.type.includes('jpg')) {
      format = 'jpeg';
    } else if (file.type.includes('png')) {
      format = 'png';
    } else if (file.type.includes('webp')) {
      format = 'webp';
    } else {
      // Default to jpeg if format is unknown or unsupported
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
  const compressedBlob = await compressImage(file, options);
  
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
    // Keep original mime type if no format specified
    mimeType = file.type;
    extension = file.name.split('.').pop() || 'jpg';
  }
  
  // Create a new filename
  const filename = file.name.replace(/\.[^/.]+$/, '') + '_compressed.' + extension;
  
  // Create a new File from the blob
  return new File([compressedBlob], filename, { type: mimeType });
} 