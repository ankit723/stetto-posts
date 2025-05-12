import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

export async function GET(
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

    const collection = await db.collection.findUnique({
      where: { id },
      include: { photos: true }
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json(collection)
  } catch (error) {
    console.error('Error fetching collection:', error)
    return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 })
  }
}

export async function PUT(
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

    const { name, description, newImages, existingPhotos, photosToDelete } = await request.json()

    // Update the collection
    const updatedCollection = await db.collection.update({
      where: { id },
      data: {
        name,
        description,
      },
    })

    // Delete photos that need to be removed
    if (photosToDelete && photosToDelete.length > 0) {
      await db.photo.deleteMany({
        where: {
          id: {
            in: photosToDelete
          }
        }
      })
    }

    // Add new photos
    if (newImages && newImages.length > 0) {
      const photoPromises = newImages.map((url: string) => 
        db.photo.create({
          data: {
            url,
            collections: {
              connect: {
                id: id,
              },
            },
          },
        })
      )

      await Promise.all(photoPromises)
    }

    // Get the updated collection with photos
    const collectionWithPhotos = await db.collection.findUnique({
      where: { id },
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

    return NextResponse.json(collectionWithPhotos)
  } catch (error) {
    console.error('Error updating collection:', error)
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Delete the collection
    await db.collection.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Collection deleted successfully' })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}
