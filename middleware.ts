// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { updateSession } from '@/utils/supabase/middleware'

export default async function middleware(request: NextRequest) {
  // Update the session first to refresh auth cookies
  const response = await updateSession(request)
  
  const supabase = await createClient()
  
  // Get authenticated user with getUser() instead of using session directly
  const { data: { user }, error } = await supabase.auth.getUser()
  console.log('user', user?.id)
  
  const { pathname } = request.nextUrl

  const protectedRoutes = ['/account']
  
  const unauthRoutes = ['/onboarding', '/auth']

  if (!user && protectedRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  
  if (user && unauthRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/account', request.url)) 
  }

  return response
}

export const config = {
  matcher: [
    '/account/:path*',
    '/admin/:path*',
    '/auth/:path*',    
    '/api/collections/:path*',
  ],
}