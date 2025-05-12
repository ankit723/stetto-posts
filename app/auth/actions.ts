'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db'
import { User } from '@prisma/client'

// Define the base URL for redirects
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Define a type for the auth action results
type AuthResult = 
  | { error: string }
  | { message: string }
  | void; // For when we redirect with no error or message

export async function login(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: userData } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.log('error', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/account')
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string

  // The actual URL that should receive the callback from Supabase
  // Make sure this matches your actual deployment URL
  const redirectTo = `${BASE_URL}/auth/callback`
  console.log('Redirect URL:', redirectTo)

  // Sign up with Supabase Auth
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
      emailRedirectTo: redirectTo
    }
  })

  if (error) {
    return { error: error.message }
  }

  // If email confirmation is required
  if (data?.user && !data.user.confirmed_at) {
    try {
      // Still create user in database but mark as unconfirmed
      await db.user.create({
        data: {
          id: data.user.id,
          email,
          password: '', // We don't store the actual password here as Supabase handles auth
          firstName,
          lastName,
        },
      })
    } catch (dbError) {
      console.error('Failed to create user in database:', dbError)
      // Don't return error here as the auth was successful, and we can try creating DB record after confirmation
    }
    
    return { message: 'Please check your email for a confirmation link to complete your registration' }
  }

  // If no email confirmation required or user is already confirmed (rare)
  try {
    await db.user.create({
      data: {
        id: data.user?.id as string,
        email,
        password: '', // We don't store the actual password here as Supabase handles auth
        firstName,
        lastName,
      },
    })
  } catch (dbError) {
    console.error('Failed to create user in database:', dbError)
    return { error: 'Failed to create user account' }
  }

  revalidatePath('/', 'layout')
  redirect('/account')
}

export async function logout(): Promise<AuthResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/', 'layout')
  redirect('/')
} 

export async function isUserAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return false
  }

  try {
    const user2 = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true }
    })


    return user2?.role === 'ADMIN'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}
