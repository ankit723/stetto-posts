import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { db } from '@/utils/db'
import sharp from 'sharp'

export const maxDuration = 60; // Set max duration to 60 seconds (Vercel Hobby plan limit)
export const dynamic = 'force-dynamic'; // Disable caching for this route

// Set memory limits for Sharp to prevent memory issues
sharp.cache(false); // Disable sharp cache
sharp.concurrency(2); // Process two images at a time for better throughput

// Define the maximum input pixels for Sharp (10,000 x 10,000)
const MAX_INPUT_PIXELS = 100000000; // 1e8

// Maximum number of photos to process in parallel
const BATCH_SIZE = 3;

// Maximum number of photos to process in total (to stay within time limits)
const MAX_PHOTOS_PER_BATCH = 40;

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
    const filename = pathname.split('/').pop() || `photo-${index + 1}.jpg`;
    
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
      filename 
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
  const { id } = params
  
  try {
    // Get batch number from URL query parameters
    const searchParams = request.nextUrl.searchParams;
    const batchNumber = parseInt(searchParams.get('batch') || '1', 10);
    const batchSize = parseInt(searchParams.get('size') || String(MAX_PHOTOS_PER_BATCH), 10);
    
    // Ensure batch size doesn't exceed maximum
    const effectiveBatchSize = Math.min(batchSize, MAX_PHOTOS_PER_BATCH);
    
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
        photos: true
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Calculate the total number of batches
    const totalPhotos = collection.photos.length;
    const totalBatches = Math.ceil(totalPhotos / effectiveBatchSize);
    
    // Validate batch number
    if (batchNumber < 1 || batchNumber > totalBatches) {
      return NextResponse.json(
        { error: `Invalid batch number. Available batches: 1-${totalBatches}` },
        { status: 400 }
      )
    }
    
    // Get the photos for the requested batch
    const startIndex = (batchNumber - 1) * effectiveBatchSize;
    const endIndex = Math.min(startIndex + effectiveBatchSize, totalPhotos);
    const photosToProcess = collection.photos.slice(startIndex, endIndex);

    // Check if collection has photos
    if (!photosToProcess || photosToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No photos to process in this batch' },
        { status: 400 }
      )
    }

    console.log(`Processing batch ${batchNumber}/${totalBatches} (${photosToProcess.length} photos) for collection ${collection.name}`);

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
Batch: ${batchNumber} of ${totalBatches}
Photos in this batch: ${photosToProcess.length}
Total photos in collection: ${totalPhotos}
Downloaded on: ${new Date().toLocaleString()}

This collection was watermarked with the Photo Watermark app.

To download other batches, use the batch parameter in the URL:
- Batch 1: ?batch=1 (photos 1-${effectiveBatchSize})
${totalBatches > 1 ? `- Batch 2: ?batch=2 (photos ${effectiveBatchSize + 1}-${Math.min(effectiveBatchSize * 2, totalPhotos)})` : ''}
${totalBatches > 2 ? `- Batch 3: ?batch=3 (photos ${effectiveBatchSize * 2 + 1}-${Math.min(effectiveBatchSize * 3, totalPhotos)})` : ''}
${totalBatches > 3 ? `- And so on up to batch ${totalBatches}` : ''}
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
Batch: ${batchNumber} of ${totalBatches}
Photos in this batch: ${photosToProcess.length} (${startIndex + 1}-${endIndex} of ${totalPhotos})
Successfully processed: ${successful}
Failed to process: ${failed}

${failed > 0 ? 'Failed items:' : ''}
${failed > 0 ? results.filter(r => !r.success).map(item => `- Photo ID: ${item.id}, Error: ${item.error}`).join('\n') : ''}

To download other batches, append ?batch=X to the URL where X is the batch number (1-${totalBatches}).
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
    const fileName = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_batch${batchNumber}_watermarked.zip`;
    
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