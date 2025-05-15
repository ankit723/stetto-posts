import { NextRequest, NextResponse } from 'next/server'
import { db, executeWithRetry } from '@/utils/db'

// POST /api/collections/[id]/photos - Add photos to an existing collection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  
  try {
    const { images } = await request.json()

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    // Check if collection exists
    console.log('Checking if collection exists')
    console.log(id)

    const collection = await executeWithRetry(() => db.collection.findUnique({
      where: { id },
      select: { id: true } // Only select the id to minimize data transfer
    }))

    console.log('Collection data:', collection)
    
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Process images in optimal batch sizes
    const BATCH_SIZE = 100
    let addedCount = 0
    
    // Use a single transaction for the entire operation
    await executeWithRetry(() => 
      db.$transaction(async (tx) => {
        // Create photos in batches for better performance
        for (let i = 0; i < images.length; i += BATCH_SIZE) {
          const batch = images.slice(i, i + BATCH_SIZE)
          
          // Create photo records first without relationships
          const photoData = batch.map(url => ({ url }))
          const createdPhotos = await tx.photo.createMany({
            data: photoData,
            skipDuplicates: true,
          })
          
          // Get the IDs of the created photos
          const createdPhotoIds = await tx.photo.findMany({
            where: {
              url: { in: batch }
            },
            select: { id: true }
          })
          
          // Connect photos to collection in batch
          if (createdPhotoIds.length > 0) {
            await tx.collection.update({
              where: { id },
              data: {
                photos: {
                  connect: createdPhotoIds
                }
              }
            })
            
            addedCount += createdPhotoIds.length
          }
        }
      }, {
        maxWait: 5000,
        timeout: 30000
      })
    )

    return NextResponse.json({ 
      success: true, 
      addedCount,
      message: `Successfully added ${addedCount} photos to collection`
    })
  } catch (error) {
    console.error('Error adding photos to collection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to add photos: ${errorMessage}` },
      { status: 500 }
    )
  }
} 