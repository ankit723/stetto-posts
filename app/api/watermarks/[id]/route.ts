import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'

// DELETE /api/watermarks/[id] - Delete a watermark
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

    // Check if watermark exists and belongs to user using Prisma
    const watermark = await db.photo.findFirst({
      where: {
        id,
        userId: user.id,
        isWatermark: true
      }
    })

    if (!watermark) {
      return NextResponse.json(
        { error: 'Watermark not found' },
        { status: 404 }
      )
    }

    // Check if watermark is used in any collection
    const configs = await db.photoConfig.findFirst({
      where: {
        watermarkId: id
      }
    })

    if (configs) {
      return NextResponse.json(
        { error: 'Cannot delete watermark as it is used in one or more collections' },
        { status: 400 }
      )
    }

    // Extract the file path from the URL
    const url = new URL(watermark.url)
    const pathname = url.pathname
    const filePath = pathname.startsWith('/') ? pathname.substring(1) : pathname

    // Delete the file from storage if it's in our bucket
    if (filePath.includes('watermarks/')) {
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([filePath])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with deletion from database even if storage deletion fails
      }
    }

    // Delete the watermark from the database using Prisma
    await db.photo.delete({
      where: {
        id
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

export async function GET(
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

    // Fetch the watermark using Prisma
    const watermark = await db.photo.findFirst({
      where: {
        id,
        userId: user.id,
        isWatermark: true
      }
    })

    if (!watermark) {
      return NextResponse.json(
        { error: 'Watermark not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(watermark)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 