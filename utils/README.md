# Utility Functions

## Image Compression

The application includes image compression to optimize upload times and storage usage.

### How it works

1. When a user selects images for upload, they are automatically compressed before being uploaded to the server.
2. The compression process:
   - Reduces image quality to 80% (configurable)
   - Resizes large images to max dimensions of 2000x2000px (configurable)
   - Preserves the original image format when possible
   - Falls back to JPEG for better compression when needed

### Benefits

- **Faster uploads**: Smaller file sizes mean faster upload times
- **Reduced bandwidth usage**: Less data transfer for both uploads and downloads
- **Lower storage costs**: Compressed images take up less space in storage
- **Improved performance**: Smaller images load faster in the browser
- **Client-side processing**: All compression happens in the browser without server load

### Implementation

The compression is handled by the `imageCompression.ts` utility using the browser's Canvas API:

- `compressImage`: Compresses an image and returns a Blob
- `compressImageToFile`: Compresses an image and returns a new File object

### Configuration Options

The compression can be configured with these options:

- `quality`: 1-100, default 80 (internally converted to 0-1 for Canvas API)
- `maxWidth`: Maximum width in pixels (default 2000px)
- `maxHeight`: Maximum height in pixels (default 2000px)
- `format`: Output format ('jpeg', 'png', or 'webp')

### Usage

```typescript
import { compressImageToFile } from '@/utils/imageCompression'

// Example usage
const compressedFile = await compressImageToFile(originalFile, {
  quality: 75,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'jpeg'
})
``` 