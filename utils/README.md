# Utility Functions

## Image Compression

The application includes advanced image compression to significantly reduce file sizes and optimize upload times.

### How it works

1. When a user selects images for upload, they are automatically compressed before being uploaded to the server.
2. The compression process:
   - Uses adaptive quality reduction based on file size (50-70% quality)
   - Resizes large images to max dimensions of 1600x1600px
   - Converts most images to JPEG format for maximum compression
   - Intelligently preserves PNG format only when transparency is detected

### Benefits

- **Much faster uploads**: Significantly smaller file sizes mean much faster upload times
- **Greatly reduced bandwidth usage**: Much less data transfer for both uploads and downloads
- **Lower storage costs**: Highly compressed images take up far less space in storage
- **Improved performance**: Smaller images load faster in the browser
- **Client-side processing**: All compression happens in the browser without server load
- **Smart format selection**: Automatically uses the most efficient format for each image

### Implementation

The compression is handled by the `imageCompression.ts` utility using the browser's Canvas API:

- `compressImage`: Compresses an image and returns a Blob
- `compressImageToFile`: Compresses an image and returns a new File object
- `needsTransparency`: Helper function to detect if an image requires transparency

### Compression Strategy

The utility uses an adaptive compression strategy:

- **Large files** (>5MB): Heavy compression (50% quality)
- **Medium files** (1-5MB): Medium-heavy compression (60% quality)
- **Small files** (<1MB): Standard compression (70% quality)
- **Images with transparency**: Preserved as PNG with moderate compression
- **All other images**: Converted to JPEG for maximum compression

### Configuration Options

The compression can be configured with these options:

- `quality`: 1-100, with adaptive defaults based on file size
- `maxWidth`: Maximum width in pixels (default 1600px)
- `maxHeight`: Maximum height in pixels (default 1600px)
- `format`: Output format ('jpeg', 'png', or 'webp')

### Usage

```typescript
import { compressImageToFile } from '@/utils/imageCompression'

// Example usage with default adaptive compression
const compressedFile = await compressImageToFile(originalFile)

// Example usage with custom settings
const compressedFile = await compressImageToFile(originalFile, {
  quality: 50, // Very high compression
  maxWidth: 1200,
  maxHeight: 1200,
  format: 'jpeg'
})
``` 