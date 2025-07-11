import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

export const dynamic = 'force-dynamic'; // Disable caching for this route

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient()
  const { id } = await params
  
  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if collection exists and user has access using Prisma
    const collection = await db.collection.findUnique({
      where: {
        id
      },
      include: {
        photos: {
          select: {
            id: true,
            sequence: true
          }
        }
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }
    
    // Get watermark configuration for this collection using Prisma
    const watermarkConfig = await db.photoConfig.findFirst({
      where: {
        collectionId: id,
        userId: user.id
      }
    })

    if (!watermarkConfig) {
      return NextResponse.json(
        { error: 'Watermark configuration not found' },
        { status: 404 }
      )
    }

    // Calculate the number of chunks needed (50 photos per chunk)
    const CHUNK_SIZE = 50
    const totalPhotos = collection.photos.length
    const totalChunks = Math.ceil(Math.min(totalPhotos, 500) / CHUNK_SIZE)
    
    return NextResponse.json({
      totalPhotos,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      maxPhotos: 500,
      hasWatermarkConfig: !!watermarkConfig
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 