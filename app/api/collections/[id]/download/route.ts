import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { db } from '@/utils/db'
import sharp from 'sharp'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { id } = params

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

    // Check if collection has photos
    if (!collection.photos || collection.photos.length === 0) {
      return NextResponse.json(
        { error: 'Collection has no photos' },
        { status: 400 }
      )
    }

    // Get watermark configuration for this collection using Prisma
    const watermarkConfig = await db.photoConfig.findFirst({
      where: {
        collectionId: id,
        userId: user.id
      },
      include: {
        watermark: true
      }
    })

    if (!watermarkConfig || !watermarkConfig.watermark) {
      return NextResponse.json(
        { error: 'Watermark configuration not found' },
        { status: 404 }
      )
    }

    // Create a new zip file
    const zip = new JSZip()

    // Add a README file to the zip
    zip.file('README.txt', `Collection: ${collection.name}
Description: ${collection.description || 'No description'}
Number of photos: ${collection.photos.length}
Downloaded on: ${new Date().toLocaleString()}

This collection was watermarked with the Photo Watermark app.
`)

    // Fetch the watermark image
    const watermarkResponse = await fetch(watermarkConfig.watermark.url)
    if (!watermarkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch watermark image' },
        { status: 500 }
      )
    }
    
    const watermarkBuffer = Buffer.from(await watermarkResponse.arrayBuffer())
    const watermarkImage = sharp(watermarkBuffer)
    const watermarkMetadata = await watermarkImage.metadata()
    
    // Process all photos and add them to the zip
    const photoPromises = collection.photos.map(async (photo, index) => {
      try {
        // Fetch the original photo
        const photoResponse = await fetch(photo.url)
        if (!photoResponse.ok) {
          console.error(`Failed to fetch photo ${photo.id}`)
          return null
        }
        
        const photoBuffer = Buffer.from(await photoResponse.arrayBuffer())
        
        // Get the filename from the URL
        const url = new URL(photo.url)
        const pathname = url.pathname
        const filename = pathname.split('/').pop() || `photo-${index + 1}.jpg`
        
        // Process the image with sharp to apply the watermark
        const photoImage = sharp(photoBuffer)
        const photoMetadata = await photoImage.metadata()
        
        if (!photoMetadata.width || !photoMetadata.height || !watermarkMetadata.width || !watermarkMetadata.height) {
          console.error(`Missing metadata for photo ${photo.id}`)
          return null
        }
        
        // Calculate the scaling factor for the watermark
        const photoWidth = photoMetadata.width
        const photoHeight = photoMetadata.height
        
        // Scale the watermark position and dimensions to match the actual photo size
        const { position, dimensions, rotation } = watermarkConfig
        
        // Resize the watermark to the specified dimensions
        const resizedWatermark = await watermarkImage
          .resize({
            width: Math.round(dimensions.width),
            height: Math.round(dimensions.height),
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .toBuffer()
        
        // Create a watermark image with the correct rotation
        const rotatedWatermark = await sharp(resizedWatermark)
          .rotate(rotation)
          .toBuffer()
        
        // Apply the watermark to the photo
        const watermarkedPhoto = await photoImage
          .composite([
            {
              input: rotatedWatermark,
              left: Math.round(position.x),
              top: Math.round(position.y),
              gravity: 'northwest'
            }
          ])
          .toBuffer()
        
        // Add the watermarked photo to the zip
        zip.file(filename, watermarkedPhoto)
        
        return true
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error)
        return null
      }
    })
    
    // Wait for all photo processing to complete
    await Promise.all(photoPromises)
    
    // Generate the zip file
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    })
    
    // Convert the blob to an array buffer for the response
    const arrayBuffer = await zipBlob.arrayBuffer()
    
    // Return the zip file as a downloadable response
    const fileName = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_watermarked.zip`
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}