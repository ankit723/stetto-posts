import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { db } from '@/utils/db'
import sharp from 'sharp'

export const maxDuration = 300; // Set max duration to 300 seconds (5 minutes)
export const dynamic = 'force-dynamic'; // Disable caching for this route

// Set memory limits for Sharp to prevent memory issues
sharp.cache(false); // Disable sharp cache
sharp.concurrency(1); // Process one image at a time

// Define the maximum input pixels for Sharp (10,000 x 10,000)
const MAX_INPUT_PIXELS = 100000000; // 1e8

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

// Helper function to wait between operations to allow memory cleanup
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        photos: true
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    const photosToProcess = collection.photos

    // Check if collection has photos
    if (!photosToProcess || photosToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No photos to process' },
        { status: 400 }
      )
    }

    console.log(`Processing ${photosToProcess.length} photos for collection ${collection.name}`)

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

    // Create a new zip file
    const zip = new JSZip()

    // Add a README file to the zip
    zip.file('README.txt', `Collection: ${collection.name}
Description: ${collection.description || 'No description'}
Number of photos: ${photosToProcess.length}
Downloaded on: ${new Date().toLocaleString()}

This collection was watermarked with the Photo Watermark app.
`)

    // Fetch the watermark image once and keep it in memory
    console.log(`Fetching watermark image: ${watermarkConfig.watermark.url}`);
    const watermarkResponse = await fetch(watermarkConfig.watermark.url)
    if (!watermarkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch watermark image' },
        { status: 500 }
      )
    }
    
    const watermarkBuffer = Buffer.from(await watermarkResponse.arrayBuffer())
    
    // Pre-process the watermark image with the specified dimensions and rotation
    // to avoid doing it for each photo
    const { dimensions, rotation } = watermarkConfig;
    
    console.log(`Preparing watermark with dimensions: ${dimensions.width}x${dimensions.height}, rotation: ${rotation}`);
    
    // Resize the watermark
    const resizedWatermark = await sharp(watermarkBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({
        width: Math.round(dimensions.width),
        height: Math.round(dimensions.height),
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    // Rotate the watermark
    const processedWatermark = await sharp(resizedWatermark, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate(rotation)
      .toBuffer();
    
    // Process all photos and add them to the zip
    const results = [];
    
    // Process each photo sequentially to avoid memory issues
    for (let i = 0; i < photosToProcess.length; i++) {
      const photo = photosToProcess[i];
      
      try {
        // Fetch the original photo
        console.log(`Fetching photo ${i + 1}/${photosToProcess.length}: ${photo.id}`);
        const photoResponse = await fetch(photo.url, {
          // Add a timeout to prevent hanging on slow requests
          signal: AbortSignal.timeout(30000) // 30 seconds timeout
        });
        
        if (!photoResponse.ok) {
          console.error(`Failed to fetch photo ${photo.id}: HTTP ${photoResponse.status}`);
          results.push({ success: false, id: photo.id, error: `HTTP ${photoResponse.status}` });
          continue;
        }
        
        const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
        
        // Get the filename from the URL
        const photoUrl = new URL(photo.url);
        const pathname = photoUrl.pathname;
        const filename = pathname.split('/').pop() || `photo-${i + 1}.jpg`;
        
        console.log(`Processing photo: ${filename}`);
        
        try {
          // Apply the watermark to the photo with simplified approach
          const watermarkedPhoto = await sharp(photoBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .composite([
              {
                input: processedWatermark,
                left: Math.round(watermarkConfig.position.x),
                top: Math.round(watermarkConfig.position.y),
                gravity: 'northwest'
              }
            ])
            .toBuffer();
          
          // Add the watermarked photo to the zip
          zip.file(filename, watermarkedPhoto);
          console.log(`Successfully processed photo ${i + 1}/${photosToProcess.length}: ${filename}`);
          
          results.push({ success: true, id: photo.id, filename });
        } catch (processingError: any) {
          console.error(`Error processing photo ${photo.id}:`, processingError);
          results.push({ 
            success: false, 
            id: photo.id, 
            error: `Processing error: ${processingError.message || 'Unknown error'}` 
          });
        }
        
        // Force garbage collection to free memory after each photo
        if (global.gc) {
          try {
            global.gc();
          } catch (e) {
            // Ignore if gc is not available
          }
        }
      } catch (error: any) {
        console.error(`Error handling photo ${photo.id}:`, error);
        results.push({ 
          success: false, 
          id: photo.id, 
          error: error.message || 'Unknown error' 
        });
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
Total photos: ${photosToProcess.length}
Successfully processed: ${successful}
Failed to process: ${failed}

${failed > 0 ? 'Failed items:' : ''}
${failed > 0 ? results.filter(r => !r.success).map(item => `- Photo ID: ${item.id}, Error: ${item.error}`).join('\n') : ''}
`;

    zip.file('processing_report.txt', reportContent);
    console.log('Processing report created');
    
    // Generate the zip file
    console.log('Generating zip file...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
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