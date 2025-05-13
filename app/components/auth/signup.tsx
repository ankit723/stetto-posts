'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signup } from '@/app/auth/actions'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AuthResult = 
  | { error: string }
  | { message: string }
  | undefined;

// Submit button component that uses useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
        </>
      ) : 'Create account'}
    </Button>
  )
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const handleSubmit = async (formData: FormData) => {
    setError(null)
    setSuccess(null)
    
    try {
      const result = await signup(formData) as AuthResult
      
      if (result && 'error' in result) {
        setError(result.error)
      } else if (result && 'message' in result) {
        setSuccess(result.message)
      }
    } catch (e) {
      console.error('Error during signup:', e)
      setError('An error occurred during signup. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-lg text-card-foreground">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Create an account</h1>
          <p className="text-muted-foreground mt-2">Join us to watermark your photos</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-primary/10 text-primary rounded-md">
            {success}
          </div>
        )}

        {!success ? (
          <form action={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm bg-background focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm bg-background focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm bg-background focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm bg-background focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring"
              />
            </div>

            <div>
              <SubmitButton />
            </div>
          </form>
        ) : (
          <div className="text-center">
            <Link href="/auth/login">
              <Button className="inline-flex items-center">
                Go to Login
              </Button>
            </Link>
          </div>
        )}

        {!success && (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 