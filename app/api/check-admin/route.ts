import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin } from '@/app/auth/actions'

export async function GET() {
  try {
    const isAdmin = await isUserAdmin()
    
    return NextResponse.json({ isAdmin }, { status: 200 })
  } catch (error) {
    console.error('Error checking admin status:', error)
    return NextResponse.json({ isAdmin: false, error: 'Failed to check admin status' }, { status: 500 })
  }
} 