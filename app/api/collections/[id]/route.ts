import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

// Helper function to ensure all photos have valid sequence values
async function ensurePhotoSequences(photos: any[], collectionId: string) {
  // Check if any photos are missing sequence values (0 is the default)
  const needsSequencing = photos.some(photo => photo.sequence === 0)
  
  if (needsSequencing) {
    console.log(`Collection ${collectionId}: Fixing missing sequence values for photos`)
    
    // Update photos with proper sequence values
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      if (photo.sequence === 0) {
        // Update the photo with a new sequence value
        await db.photo.update({
          where: { id: photo.id },
          data: { sequence: i + 1 }
        })
        
        // Update the in-memory object as well
        photo.sequence = i + 1
      }
    }
    
    // Sort the photos by their new sequence values
    photos.sort((a, b) => a.sequence - b.sequence)
    console.log(`Collection ${collectionId}: Fixed sequence values for ${photos.length} photos`)
  }
  
  return photos
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params
  const supabase = createClient()

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const collection = await db.collection.findUnique({
      where: { id },
      include: { 
        photos: {
          orderBy: {
            sequence: 'asc' // Order photos by sequence
          },
        }
      }
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Ensure all photos have proper sequence values
    if (collection.photos && collection.photos.length > 0) {
      collection.photos = await ensurePhotoSequences(collection.photos, id)
    }

    return NextResponse.json(collection)
  } catch (error) {
    console.error('Error fetching collection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to fetch collection: ${errorMessage}` }, { status: 500 })
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

    // If there are photos to delete, get their URLs first so we can delete from storage
    if (photosToDelete && photosToDelete.length > 0) {
      // Get the photos to be deleted to extract their URLs
      const photosToBeDeleted = await db.photo.findMany({
        where: {
          id: {
            in: photosToDelete
          }
        }
      })

      // Extract file paths from the photo URLs
      const photoFilePaths = photosToBeDeleted.map(photo => {
        try {
          // Extract the path from the URL
          // URL format is typically like: https://xxx.supabase.co/storage/v1/object/public/photos/collections/filename.jpg
          const url = new URL(photo.url)
          const pathParts = url.pathname.split('/')
          const bucketIndex = pathParts.findIndex(part => part === 'public') + 1
          if (bucketIndex > 0 && bucketIndex < pathParts.length) {
            // Join the parts after 'public' to get the file path
            return pathParts.slice(bucketIndex).join('/')
          }
          return null
        } catch (error) {
          console.error('Error parsing photo URL:', error)
          return null
        }
      }).filter(Boolean) as string[]

      // Delete photos from storage in batches
      if (photoFilePaths.length > 0) {
        const BATCH_SIZE = 100 // Supabase allows up to 100 files per delete operation
        
        // Process in batches
        for (let i = 0; i < photoFilePaths.length; i += BATCH_SIZE) {
          const batchPaths = photoFilePaths.slice(i, i + BATCH_SIZE)
          try {
            const { error } = await supabase.storage
              .from('photos')
              .remove(batchPaths)
            
            if (error) {
              console.error('Error deleting photos from storage:', error)
              // Continue with deletion even if some files fail to delete
            }
          } catch (storageError) {
            console.error('Storage deletion error:', storageError)
            // Continue with deletion even if storage deletion fails
          }
        }
      }

      // Now delete the database records
      await db.photo.deleteMany({
        where: {
          id: {
            in: photosToDelete
          }
        }
      })
    }

    // Get the current highest sequence number
    const highestSequenceResult = await db.photo.findFirst({
      where: {
        collections: {
          some: {
            id
          }
        }
      },
      orderBy: {
        sequence: 'desc'
      },
      select: {
        sequence: true
      }
    })

    let currentMaxSequence = highestSequenceResult?.sequence || 0

    // Add new photos in batches for better performance
    if (newImages && newImages.length > 0) {
      const BATCH_SIZE = 50
      
      for (let i = 0; i < newImages.length; i += BATCH_SIZE) {
        const batch = newImages.slice(i, i + BATCH_SIZE)
        
        // Create photos with sequence numbers
        for (let j = 0; j < batch.length; j++) {
          const url = batch[j]
          await db.photo.create({
            data: {
              url,
              sequence: currentMaxSequence + i + j + 1,
              collections: {
                connect: {
                  id: id,
                },
              },
            },
          })
        }
      }
    }

    // Get the updated collection with photos
    const collectionWithPhotos = await db.collection.findUnique({
      where: { id },
      include: { 
        photos: {
          orderBy: {
            sequence: 'asc'
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

    // Ensure all photos have proper sequence values
    if (collectionWithPhotos && collectionWithPhotos.photos && collectionWithPhotos.photos.length > 0) {
      collectionWithPhotos.photos = await ensurePhotoSequences(collectionWithPhotos.photos, id)
    }

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
  const { id } = await params
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

    // Get all photos associated with this collection before deleting
    const collection = await db.collection.findUnique({
      where: { id },
      include: { photos: true }
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Extract file paths from the photo URLs
    const photoFilePaths = collection.photos.map(photo => {
      try {
        // Extract the path from the URL
        // URL format is typically like: https://xxx.supabase.co/storage/v1/object/public/photos/collections/filename.jpg
        const url = new URL(photo.url)
        const pathParts = url.pathname.split('/')
        const bucketIndex = pathParts.findIndex(part => part === 'public') + 1
        if (bucketIndex > 0 && bucketIndex < pathParts.length) {
          // Join the parts after 'public' to get the file path
          return pathParts.slice(bucketIndex).join('/')
        }
        return null
      } catch (error) {
        console.error('Error parsing photo URL:', error)
        return null
      }
    }).filter(Boolean) as string[]

    // Delete photos from storage in batches
    if (photoFilePaths.length > 0) {
      const BATCH_SIZE = 100 // Supabase allows up to 100 files per delete operation
      
      // Process in batches
      for (let i = 0; i < photoFilePaths.length; i += BATCH_SIZE) {
        const batchPaths = photoFilePaths.slice(i, i + BATCH_SIZE)
        try {
          const { error } = await supabase.storage
            .from('photos')
            .remove(batchPaths)
          
          if (error) {
            console.error('Error deleting photos from storage:', error)
            // Continue with deletion even if some files fail to delete
          }
        } catch (storageError) {
          console.error('Storage deletion error:', storageError)
          // Continue with deletion even if storage deletion fails
        }
      }
    }

    // Delete the collection (this will cascade delete the photo records in the database)
    await db.collection.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Collection deleted successfully' })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}
