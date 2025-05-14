import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { PrismaClient } from '@prisma/client'

// Create a single instance of PrismaClient to avoid connection issues
const prisma = new PrismaClient()

// GET /api/collections - Get all collections
export async function GET() {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        photos: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

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
      const BATCH_SIZE = 50
      
      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE)
        const photoPromises = batch.map((url: string) => 
          prisma.photo.create({
            data: {
              url,
              collections: {
                connect: {
                  id: collection.id,
                },
              },
            },
          })
        )

        await Promise.all(photoPromises)
      }
    }

    // Get the collection with photos
    const collectionWithPhotos = await prisma.collection.findUnique({
      where: { id: collection.id },
      include: { 
        photos: {
          take: 100 // Limit the number of photos returned to avoid payload size issues
        }
      },
    })

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