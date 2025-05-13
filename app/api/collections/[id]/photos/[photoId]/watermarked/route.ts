import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'
import sharp from 'sharp'

// Maximum image dimensions to process (to prevent memory issues)
const MAX_INPUT_PIXELS = 100000000 // ~100MP

// Define interfaces to match the database schema
interface WatermarkConfig {
  id: string
  collectionId: string
  userId: string
  watermarkId: string
  position: { x: number, y: number }
  dimensions: { width: number, height: number }
  rotation: number
  watermark: {
    id: string
    url: string
    isWatermark: boolean
  }
}

// GET /api/collections/[id]/photos/[photoId]/watermarked - Get a watermarked version of a photo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, photoId: string } }
) {
  const supabase = createClient()
  const { id, photoId } = params

  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if collection exists
    const collection = await db.collection.findFirst({
      where: {
        id
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Check if photo exists in the collection
    const photo = await db.photo.findFirst({
      where: {
        id: photoId,
        collections: {
          some: {
            id
          }
        }
      }
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found in collection' },
        { status: 404 }
      )
    }

    // Get watermark configuration for this collection
    const watermarkConfig = await db.photoConfig.findFirst({
      where: {
        collectionId: id
      },
      include: {
        watermark: true
      }
    }) as unknown as WatermarkConfig | null

    if (!watermarkConfig || !watermarkConfig.watermark) {
      return NextResponse.json(
        { error: 'Watermark configuration not found' },
        { status: 404 }
      )
    }

    console.log('Watermark config:', {
      position: watermarkConfig.position,
      dimensions: watermarkConfig.dimensions,
      rotation: watermarkConfig.rotation,
      watermarkUrl: watermarkConfig.watermark.url
    })

    // Fetch the original photo
    const photoResponse = await fetch(photo.url, {
      cache: 'no-store'
    })
    if (!photoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch original photo' },
        { status: 500 }
      )
    }
    const photoBuffer = Buffer.from(await photoResponse.arrayBuffer())

    // Fetch the watermark image
    const watermarkResponse = await fetch(watermarkConfig.watermark.url, {
      cache: 'no-store'
    })
    if (!watermarkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch watermark image' },
        { status: 500 }
      )
    }
    const watermarkBuffer = Buffer.from(await watermarkResponse.arrayBuffer())

    // Get the watermark dimensions and position
    const position = watermarkConfig.position as { x: number, y: number }
    const dimensions = watermarkConfig.dimensions as { width: number, height: number }
    const rotation = watermarkConfig.rotation || 0

    // Process the watermark with the specified dimensions and rotation
    const processedWatermark = await sharp(watermarkBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({
        width: Math.round(dimensions.width),
        height: Math.round(dimensions.height),
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .rotate(rotation)
      .toBuffer()

    // Apply the watermark to the photo
    const watermarkedPhoto = await sharp(photoBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .composite([
        {
          input: processedWatermark,
          left: Math.round(position.x),
          top: Math.round(position.y),
          gravity: 'northwest'
        }
      ])
      .jpeg({ quality: 90 })
      .toBuffer()

    // Return the watermarked image
    return new NextResponse(watermarkedPhoto, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="watermarked_${photoId}.jpg"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error generating watermarked image:', error)
    return NextResponse.json(
      { error: 'Failed to generate watermarked image' },
      { status: 500 }
    )
  }
} 