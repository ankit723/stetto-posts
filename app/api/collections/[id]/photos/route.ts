import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

// POST /api/collections/[id]/photos - Add photos to an existing collection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const supabase = createClient()

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the user is an admin
    const isAdmin = await db.user.findFirst({
      where: {
        id: user.id,
        role: 'ADMIN'
      }
    })

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { images } = await request.json()

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    // Check if collection exists
    const collection = await db.collection.findUnique({
      where: { id }
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Create photo records for each image
    const photoPromises = images.map((url: string) => 
      db.photo.create({
        data: {
          url,
          collections: {
            connect: {
              id,
            },
          },
        },
      })
    )

    await Promise.all(photoPromises)

    return NextResponse.json({ success: true, addedCount: images.length })
  } catch (error) {
    console.error('Error adding photos to collection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to add photos: ${errorMessage}` },
      { status: 500 }
    )
  }
} 