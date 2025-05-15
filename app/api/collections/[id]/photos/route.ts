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
      include: {
        photos: {
          orderBy: { sequence: 'desc' },
          take: 1,
        }
      }
    }))

    console.log('Collection data:', collection)
    
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Get the current highest sequence number
    let currentMaxSequence = 0
    if (collection.photos && collection.photos.length > 0) {
      currentMaxSequence = collection.photos[0].sequence
      console.log(`Current max sequence: ${currentMaxSequence}`)
    }

    // Process images in optimal batch sizes
    const BATCH_SIZE = 100
    let addedCount = 0
    
    // Log the images array to verify order
    console.log(`Processing ${images.length} images in order:`, images.slice(0, 5).map((url, idx) => `${idx}: ${url.substring(0, 50)}...`))
    
    // Use a single transaction for the entire operation
    await executeWithRetry(() => 
      db.$transaction(async (tx) => {
        // Create photos in batches for better performance
        for (let i = 0; i < images.length; i += BATCH_SIZE) {
          const batch = images.slice(i, i + BATCH_SIZE)
          
          // Create photo records with sequence numbers
          // The sequence number is critical for preserving the order of images
          const photoData = batch.map((url, index) => {
            // Each image gets a sequence number based on its position in the original array
            // Starting from 1 to ensure all sequences are positive and in order
            const seq = currentMaxSequence + i + index + 1
            console.log(`Setting sequence ${seq} for image at index ${i + index}: ${url.substring(0, 30)}...`)
            return { 
              url, 
              sequence: seq
            }
          })
          
          console.log(`Created ${photoData.length} photo records with sequences from ${photoData[0]?.sequence} to ${photoData[photoData.length-1]?.sequence}`)
          
          // Create photos individually to preserve exact order
          const createdPhotoIds = []
          for (const data of photoData) {
            const photo = await tx.photo.create({
              data: data,
              select: { id: true, sequence: true }
            })
            createdPhotoIds.push({ id: photo.id })
            console.log(`Created photo with ID ${photo.id} and sequence ${photo.sequence}`)
          }
          
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
            console.log(`Connected ${createdPhotoIds.length} photos to collection ${id}`)
          }
        }
      }, {
        maxWait: 5000,
        timeout: 30000
      })
    )

    console.log(`Successfully added ${addedCount} photos to collection ${id}`)
    
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