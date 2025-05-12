import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/utils/db'

// GET /api/watermarks - Get all watermarks for the current user
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

    // Fetch watermarks for the current user using Prisma
    const watermarks = await db.photo.findMany({
      where: {
        userId: user.id,
        isWatermark: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(watermarks)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/watermarks - Create a new watermark
export async function POST(request: NextRequest) {
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

    // Parse the multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'No name provided' },
        { status: 400 }
      )
    }

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size should be less than 5MB' },
        { status: 400 }
      )
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp']
    
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Only PNG, JPG, JPEG, GIF and WEBP files are allowed' },
        { status: 400 }
      )
    }

    // Generate a unique filename
    const fileName = `${uuidv4()}.${fileExtension}`
    const filePath = `watermarks/${user.id}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath)

    // Store watermark in database using Prisma
    const watermark = await db.photo.create({
      data: {
        url: publicUrl,
        isWatermark: true,
        userId: user.id
      }
    })

    return NextResponse.json(watermark)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 