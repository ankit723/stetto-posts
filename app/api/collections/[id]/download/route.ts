import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { db } from '@/utils/db'
import sharp from 'sharp'

export const maxDuration = 120; // Set max duration to 120 seconds for processing larger collections
export const dynamic = 'force-dynamic'; // Disable caching for this route

// Set memory limits for Sharp to prevent memory issues
sharp.cache(false); // Disable sharp cache
sharp.concurrency(2); // Process two images at a time for better throughput

// Define the maximum input pixels for Sharp (10,000 x 10,000)
const MAX_INPUT_PIXELS = 100000000; // 1e8

// Maximum number of photos to process in parallel
const BATCH_SIZE = 5;

// Maximum number of photos to process in total (to stay within time limits)
const MAX_PHOTOS_TO_PROCESS = 500;

interface WatermarkPosition {
  x: number;
  y: number;
}

interface WatermarkDimensions {
  width: number;
  height: number;
}

interface WatermarkConfig {
  position: WatermarkPosition;
  dimensions: WatermarkDimensions;
  rotation: number;
  watermark: {
    id: string;
    url: string;
  };
}

// Helper function to process photos in batches
async function processBatch(
  photos: any[],
  processedWatermark: Buffer,
  watermarkConfig: WatermarkConfig,
  zip: JSZip,
  startIdx: number,
  endIdx: number
) {
  const batchPromises = [];
  
  for (let i = startIdx; i < endIdx && i < photos.length; i++) {
    batchPromises.push(processPhoto(photos[i], i, processedWatermark, watermarkConfig, zip));
  }
  
  return Promise.all(batchPromises);
}

// Process a single photo
async function processPhoto(
  photo: any,
  index: number,
  processedWatermark: Buffer,
  watermarkConfig: WatermarkConfig,
  zip: JSZip
) {
  try {
    // Fetch the original photo with timeout
    const photoResponse = await fetch(photo.url, {
      signal: AbortSignal.timeout(10000) // 10 seconds timeout per photo
    });
    
    if (!photoResponse.ok) {
      console.error(`Failed to fetch photo ${photo.id}: HTTP ${photoResponse.status}`);
      return { 
        success: false, 
        id: photo.id, 
        error: `HTTP ${photoResponse.status}` 
      };
    }
    
    const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
    
    // Get the filename from the URL
    const photoUrl = new URL(photo.url);
    const pathname = photoUrl.pathname;
    // Add sequence number to the filename for proper ordering
    const originalFilename = pathname.split('/').pop() || `photo.jpg`;
    const sequenceNumber = photo.sequence || index + 1;
    // Format sequence number with leading zeros for proper sorting
    const paddedSequence = String(sequenceNumber).padStart(4, '0');
    const filename = `${paddedSequence}_${originalFilename}`;
    
    // Apply the watermark to the photo with optimized settings
    const watermarkedPhoto = await sharp(photoBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .composite([
        {
          input: processedWatermark,
          left: Math.round(watermarkConfig.position.x),
          top: Math.round(watermarkConfig.position.y),
          gravity: 'northwest'
        }
      ])
      .jpeg({ quality: 85 }) // Slightly reduce quality for better performance
      .toBuffer();
    
    // Add the watermarked photo to the zip
    zip.file(filename, watermarkedPhoto);
    
    return { 
      success: true, 
      id: photo.id, 
      filename,
      sequence: sequenceNumber
    };
  } catch (error: unknown) {
    console.error(`Error processing photo ${photo.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      id: photo.id, 
      error: errorMessage
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { id } = await params
  
  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if collection exists and user has access using Prisma
    const collection = await db.collection.findUnique({
      where: {
        id
      },
      include: {
        photos: {
          orderBy: {
            sequence: 'asc' // Order photos by sequence
          }
        }
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }
    
    // Check if collection has photos
    if (!collection.photos || collection.photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos to process in this collection' },
        { status: 400 }
      )
    }

    // Limit the number of photos to process to avoid timeouts
    const totalPhotos = collection.photos.length;
    const photosToProcess = collection.photos.slice(0, MAX_PHOTOS_TO_PROCESS);
    
    console.log(`Processing ${photosToProcess.length} photos (out of ${totalPhotos} total) for collection ${collection.name}`);
    console.log(`Photos will be processed in sequence order: ${photosToProcess.map(p => p.sequence).join(', ')}`);

    // Get watermark configuration for this collection using Prisma
    const watermarkConfigData = await db.photoConfig.findFirst({
      where: {
        collectionId: id,
        userId: user.id
      },
      include: {
        watermark: true
      }
    })

    if (!watermarkConfigData || !watermarkConfigData.watermark) {
      return NextResponse.json(
        { error: 'Watermark configuration not found' },
        { status: 404 }
      )
    }

    // Type cast the watermark config to ensure proper typing
    const watermarkConfig = watermarkConfigData as unknown as WatermarkConfig;

    // Create a new zip file with optimized settings
    const zip = new JSZip()

    // Add a README file to the zip
    zip.file('README.txt', `Collection: ${collection.name}
Description: ${collection.description || 'No description'}
Photos included: ${photosToProcess.length} ${totalPhotos > MAX_PHOTOS_TO_PROCESS ? `(out of ${totalPhotos} total)` : ''}
Downloaded on: ${new Date().toLocaleString()}

This collection was watermarked with the Photo Watermark app.
Photos are named with their sequence number to preserve the original order.
${totalPhotos > MAX_PHOTOS_TO_PROCESS ? `\nNote: This download includes the first ${MAX_PHOTOS_TO_PROCESS} photos out of ${totalPhotos} total photos in the collection due to processing limits.` : ''}
`)

    // Fetch the watermark image once and keep it in memory
    const watermarkResponse = await fetch(watermarkConfig.watermark.url)
    if (!watermarkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch watermark image' },
        { status: 500 }
      )
    }
    
    const watermarkBuffer = Buffer.from(await watermarkResponse.arrayBuffer())
    
    // Pre-process the watermark image with the specified dimensions and rotation
    const { dimensions, rotation } = watermarkConfig;
    
    // Optimize watermark processing
    const processedWatermark = await sharp(watermarkBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({
        width: Math.round(dimensions.width),
        height: Math.round(dimensions.height),
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .rotate(rotation)
      .toBuffer();
    
    // Process photos in batches to optimize memory usage and performance
    const results = [];
    
    for (let i = 0; i < photosToProcess.length; i += BATCH_SIZE) {
      const batchResults = await processBatch(
        photosToProcess,
        processedWatermark,
        watermarkConfig,
        zip,
        i,
        i + BATCH_SIZE
      );
      
      results.push(...batchResults);
      
      // Force garbage collection between batches
      if (global.gc) {
        try {
          global.gc();
        } catch (e) {
          // Ignore if gc is not available
        }
      }
    }
    
    // Log processing results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`Processed ${photosToProcess.length} photos: ${successful} successful, ${failed} failed`);
    
    if (successful === 0) {
      console.error('Failed to process any photos. Results:', results);
      return NextResponse.json(
        { error: 'Failed to process any photos in the collection. Please try again later or contact support.' },
        { status: 500 }
      );
    }
    
    // Add a processing report to the zip
    const reportContent = `
Processing Report
----------------
Collection: ${collection.name}
Total photos in collection: ${totalPhotos}
Photos processed: ${photosToProcess.length} ${totalPhotos > MAX_PHOTOS_TO_PROCESS ? `(limited to ${MAX_PHOTOS_TO_PROCESS} out of ${totalPhotos} total)` : ''}
Successfully processed: ${successful}
Failed to process: ${failed}

${totalPhotos > MAX_PHOTOS_TO_PROCESS ? `Note: Due to processing limits, only the first ${MAX_PHOTOS_TO_PROCESS} photos were included in this download.\n` : ''}
${failed > 0 ? 'Failed items:' : ''}
${failed > 0 ? results.filter(r => !r.success).map(item => `- Photo ID: ${item.id}, Error: ${item.error}`).join('\n') : ''}
`;

    zip.file('processing_report.txt', reportContent);
    
    // Generate the zip file with optimized compression
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 3 // Lower compression level for faster processing
      }
    });
    
    console.log(`Zip file generated, size: ${Math.round(zipBlob.size / 1024)} KB`);
    
    // Convert the blob to an array buffer for the response
    const arrayBuffer = await zipBlob.arrayBuffer();
    
    // Return the zip file as a downloadable response
    const fileName = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_watermarked.zip`;
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}