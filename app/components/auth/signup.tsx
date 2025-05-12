'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signup } from '@/app/auth/actions'

type AuthResult = 
  | { error: string }
  | { message: string }
  | undefined;

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    setSuccess(null)
    setIsLoading(true)
    
    try {
      const result = await signup(formData) as AuthResult
      
      if (result && 'error' in result) {
        setError(result.error)
      } else if (result && 'message' in result) {
        setSuccess(result.message)
      }
    } catch (e) {
      setError('An error occurred during signup. Please try again.')
    } finally {
      setIsLoading(false)
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
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground ${
                  isLoading 
                    ? 'bg-primary/70 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/50'
                }`}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <Link 
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/50"
            >
              Go to Login
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