import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db, executeWithRetry } from '@/utils/db'

export async function GET(request: NextRequest) {
  const supabase = createClient()

  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all collections that have watermark configurations for the current user
    // Include watermark config data to reduce subsequent API calls
    const watermarkedCollections = await executeWithRetry(() =>
      db.photoConfig.findMany({
        where: {
          userId: user.id
        },
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
          },
          collection: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              photos: {
                select: {
                  id: true,
                  url: true,
                  sequence: true,
                },
                orderBy: {
                  sequence: 'asc'
                },
                take: 1 // Just get the first photo for the thumbnail
              },
              _count: {
                select: {
                  photos: true
                }
              }
            }
          }
        },
        orderBy: {
          collection: {
            createdAt: 'desc'
          }
        }
      })
    )

    // Format the response with watermark config included
    const formattedCollections = watermarkedCollections.map(config => {
      const collection = config.collection
      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        photoCount: collection._count.photos,
        thumbnailUrl: collection.photos.length > 0 ? collection.photos[0].url : undefined,
        createdAt: collection.createdAt.toISOString(),
        // Include watermark config to avoid additional API calls
        watermarkConfig: {
          id: config.id,
          position: config.position,
          dimensions: config.dimensions,
          rotation: config.rotation,
          watermark: config.watermark
        }
      }
    })

    return NextResponse.json(formattedCollections)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 