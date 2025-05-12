import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { PrismaClient } from '@prisma/client'

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

    // Create photo records for each image
    if (images && images.length > 0) {
      const photoPromises = images.map((url: string) => 
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

    // Get the collection with photos
    const collectionWithPhotos = await prisma.collection.findUnique({
      where: { id: collection.id },
      include: { photos: true },
    })

    return NextResponse.json(collectionWithPhotos, { status: 201 })
  } catch (error) {
    console.error('Failed to create collection:', error)
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    )
  }
} 