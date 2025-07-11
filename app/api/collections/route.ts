import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db, executeWithRetry } from '@/utils/db'

// GET /api/collections - Get all collections (optimized for listing)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const optimized = url.searchParams.get('optimized') === 'true'
    const minimal = url.searchParams.get('minimal') === 'true'
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : undefined
    
    if (minimal) {
      // Super minimal endpoint - collection basics + first photo + watermark for thumbnails
      const collections = await executeWithRetry(() => 
        db.collection.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            photos: {
              select: {
                id: true,
                url: true,
                sequence: true,
              },
              orderBy: {
                sequence: 'asc'
              },
              take: 1 // Only get the first photo for thumbnail
            },
            _count: {
              select: {
                photos: true
              }
            },
            photoConfigs: {
              select: {
                id: true,
                position: true,
                dimensions: true,
                rotation: true,
                watermark: {
                  select: {
                    id: true,
                    url: true,
                  }
                }
              },
              take: 1 // Only get the first watermark config
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          ...(limit && { take: limit })
        })
      );

      // Transform to match expected format
      const transformedCollections = collections.map(collection => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt,
        updatedAt: collection.createdAt, // Use createdAt as fallback
        user: collection.user,
        photos: collection.photos, // Include first photo for thumbnail
        photoCount: collection._count.photos, // Include actual photo count
        hasWatermark: collection.photoConfigs.length > 0,
        watermarkConfig: collection.photoConfigs[0] || null // First watermark config if any
      }))

      return NextResponse.json(transformedCollections)
    } else if (optimized) {
      // Ultra-optimized endpoint using raw SQL for maximum performance
      const collections = await executeWithRetry(() => 
        db.$queryRaw`
          SELECT 
            c.id,
            c.name,
            c.description,
            c."createdAt",
            c."updatedAt",
            c."userId",
            u."firstName",
            u."lastName",
            first_photo.id as "firstPhotoId",
            first_photo.url as "firstPhotoUrl",
            first_photo.sequence as "firstPhotoSequence",
            photo_count.count as "photoCount",
            watermark_config.id as "watermarkConfigId",
            watermark_config.position as "watermarkPosition",
            watermark_config.dimensions as "watermarkDimensions",
            watermark_config.rotation as "watermarkRotation",
            watermark_photo.id as "watermarkPhotoId",
            watermark_photo.url as "watermarkPhotoUrl"
          FROM "Collection" c
          LEFT JOIN "User" u ON c."userId" = u.id
          LEFT JOIN LATERAL (
            SELECT p.id, p.url, p.sequence
            FROM "Photo" p
            JOIN "_CollectionToPhoto" cp ON p.id = cp."B"
            WHERE cp."A" = c.id
            ORDER BY p.sequence ASC
            LIMIT 1
          ) first_photo ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(*) as count
            FROM "Photo" p
            JOIN "_CollectionToPhoto" cp ON p.id = cp."B"
            WHERE cp."A" = c.id
          ) photo_count ON true
          LEFT JOIN "PhotoConfig" watermark_config ON c.id = watermark_config."collectionId"
          LEFT JOIN "Photo" watermark_photo ON watermark_config."watermarkId" = watermark_photo.id
          ORDER BY c."createdAt" DESC
        `
      );

      // Transform the raw SQL result to match the expected format
      const transformedCollections = (collections as any[]).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: {
          id: row.userId,
          firstName: row.firstName,
          lastName: row.lastName,
        },
        photos: row.firstPhotoId ? [{
          id: row.firstPhotoId,
          url: row.firstPhotoUrl,
          sequence: row.firstPhotoSequence,
        }] : [],
        photoCount: parseInt(row.photoCount) || 0, // Include actual photo count
        hasWatermark: !!row.watermarkConfigId,
        watermarkConfig: row.watermarkConfigId ? {
          id: row.watermarkConfigId,
          position: row.watermarkPosition,
          dimensions: row.watermarkDimensions,
          rotation: row.watermarkRotation,
          watermark: row.watermarkPhotoId ? {
            id: row.watermarkPhotoId,
            url: row.watermarkPhotoUrl,
          } : null
        } : null
      }))

      return NextResponse.json(transformedCollections)
    } else {
      // Original endpoint for backward compatibility
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
    }
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