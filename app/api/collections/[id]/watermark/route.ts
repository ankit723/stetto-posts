import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

// GET /api/collections/[id]/watermark - Get the watermark configuration for a collection
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const collection = await db.collection.findFirst({
      where: {
        id,
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Get watermark configuration for this collection using Prisma
    const photoConfig = await db.photoConfig.findFirst({
      where: {
        collectionId: id,
        userId: user.id
      },
      include: {
        watermark: true
      }
    })

    if (!photoConfig) {
      return NextResponse.json(
        { error: 'Watermark configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(photoConfig)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/collections/[id]/watermark - Save a watermark configuration
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { id } = params

  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const { watermarkId, position, dimensions, rotation } = await request.json()

    // Validate required fields
    if (!watermarkId || !position || !dimensions) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if collection exists and user has access using Prisma
    const collection = await db.collection.findFirst({
      where: {
        id
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Check if watermark exists using Prisma
    const watermark = await db.photo.findFirst({
      where: {
        id: watermarkId,
        isWatermark: true
      }
    })

    if (!watermark) {
      return NextResponse.json(
        { error: 'Watermark not found' },
        { status: 404 }
      )
    }

    // Check if configuration already exists using Prisma
    const existingConfig = await db.photoConfig.findFirst({
      where: {
        collectionId: id,
        userId: user.id
      }
    })

    let result;

    if (existingConfig) {
      // Update existing configuration using Prisma
      result = await db.photoConfig.update({
        where: {
          id: existingConfig.id
        },
        data: {
          watermarkId,
          position,
          dimensions,
          rotation: rotation || 0
        },
        include: {
          watermark: true
        }
      })
    } else {
      // Create new configuration using Prisma
      result = await db.photoConfig.create({
        data: {
          collectionId: id,
          userId: user.id,
          watermarkId,
          position,
          dimensions,
          rotation: rotation || 0
        },
        include: {
          watermark: true
        }
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE /api/collections/[id]/watermark - Remove a watermark configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { id } = params

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
    const collection = await db.collection.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Delete the watermark configuration using Prisma
    await db.photoConfig.deleteMany({
      where: {
        collectionId: id,
        userId: user.id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 