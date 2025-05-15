import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db, executeWithRetry } from '@/utils/db'

// GET /api/collections - Get all collections
export async function GET() {
  try {
    const collections = await executeWithRetry(() => 
      db.collection.findMany({
        include: {
          photos: {
            orderBy: {
              sequence: 'asc' // Order photos by sequence
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })
    );

    return NextResponse.json(collections)
  } catch (error) {
    console.error('Failed to fetch collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

// POST /api/collections - Create a new collection
export async function POST(request: Request) {
  try {
    const { name, description, images } = await request.json()

    // Get the current user
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use a transaction to create the collection and add initial photos
    const collectionWithPhotos = await executeWithRetry(() => 
      db.$transaction(async (prisma) => {
        // Create the collection first
        const collection = await prisma.collection.create({
          data: {
            name,
            description,
            userId: user.id,
          },
        })

        // Create photo records for each image in batches to avoid timeout
        if (images && images.length > 0) {
          const INTERNAL_BATCH_SIZE = 20 // Internal batch size for database operations
          
          // Process in internal batches to avoid overwhelming the database
          for (let i = 0; i < images.length; i += INTERNAL_BATCH_SIZE) {
            const batch = images.slice(i, i + INTERNAL_BATCH_SIZE)
            
            // Create photos in sequence
            for (let j = 0; j < batch.length; j++) {
              const url = batch[j]
              // Sequence starts at 1 and increases for each image
              // This ensures that the sequence matches the order in which images were selected
              const sequence = i + j + 1
              console.log(`Creating photo with sequence ${sequence} for URL: ${url.substring(0, 30)}...`)
              await prisma.photo.create({
                data: {
                  url,
                  sequence: sequence, // Set sequence based on position in the array
                  collections: {
                    connect: {
                      id: collection.id,
                    },
                  },
                },
              })
            }
          }
        }

        // Get the collection with photos
        return prisma.collection.findUnique({
          where: { id: collection.id },
          include: { 
            photos: {
              orderBy: {
                sequence: 'asc' // Order photos by sequence
              },
              take: 100 // Limit the number of photos returned to avoid payload size issues
            }
          },
        })
      }, {
        // Set a reasonable timeout for the transaction
        timeout: 60000, // 60 seconds for collection creation with all photos
        maxWait: 10000, // 10 seconds max wait time
      })
    );

    if (!collectionWithPhotos) {
      throw new Error('Failed to create collection')
    }

    return NextResponse.json(collectionWithPhotos, { status: 201 })
  } catch (error) {
    console.error('Failed to create collection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create collection: ${errorMessage}` },
      { status: 500 }
    )
  }
} 