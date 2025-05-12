'use client'

import Link from 'next/link'

export default function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-8">
          We encountered an error processing your request. Please try again.
        </p>
        <Link 
          href="/auth/login" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Return to login
        </Link>
      </div>
    </div>
  )
} 