import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('Code from query:', code)
  console.log('SearchParams:', searchParams.toString())
  console.log('Origin:', origin)

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('Exchange result error:', error)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      const finalRedirectUrl = isLocalEnv
        ? `${origin}${next}`
        : forwardedHost
        ? `https://${forwardedHost}${next}`
        : `${origin}${next}`

      console.log('Redirecting to:', finalRedirectUrl)
      return NextResponse.redirect(finalRedirectUrl)
    }
  }

  // If code was not present or exchange failed
  console.error('Redirecting to error page')
  return NextResponse.redirect(`${origin}/auth/error`)
}
