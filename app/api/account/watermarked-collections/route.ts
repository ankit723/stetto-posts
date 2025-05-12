import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

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
    const watermarkedCollections = await db.photoConfig.findMany({
      where: {
        userId: user.id
      },
      select: {
        collection: {
          include: {
            photos: {
              take: 1, // Just get one photo for the thumbnail
              orderBy: {
                createdAt: 'desc'
              }
            },
            _count: {
              select: {
                photos: true
              }
            }
          }
        }
      }
    })

    // Format the response
    const formattedCollections = watermarkedCollections.map(config => {
      const collection = config.collection
      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        photoCount: collection._count.photos,
        thumbnailUrl: collection.photos.length > 0 ? collection.photos[0].url : undefined,
        createdAt: collection.createdAt.toISOString()
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