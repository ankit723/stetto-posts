'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, Image as ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [imageError, setImageError] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUserStatus() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        // Check if user is admin
        if (user) {
          const response = await fetch('/api/check-admin')
          const { isAdmin } = await response.json()
          setIsAdmin(isAdmin)
        }
      } catch (error) {
        console.error('Error checking user status:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkUserStatus()
  }, [])

  const handleGetStarted = () => {
    if (!user) {
      router.push('/auth/login')
    } else if (isAdmin) {
      router.push('/admin')
    } else {
      router.push('/collections')
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-24">
      <div className="flex flex-col md:flex-row items-center gap-12">
        {/* Hero Content */}
        <div className="flex-1 space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Protect Your Photos with <span className="text-primary">Watermarks</span>
          </h1>
          
          <p className="text-xl text-muted-foreground">
            Easily add customizable text and image watermarks to protect your digital content and establish your brand identity.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              disabled={loading}
              className="text-lg px-8"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Loading...
                </>
              ) : (
                'Get Started'
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => router.push('/about')}
              className="text-lg"
            >
              Learn More
            </Button>
          </div>
        </div>
        
        {/* Hero Image */}
        <div className="flex-1 relative">
          <div className="relative h-[400px] w-full rounded-lg overflow-hidden shadow-xl">
            <Image
              src={imageError ? "/placeholder-image.svg" : "/hero-image.png"}
              alt="Photo watermarking example"
              fill
              className="object-cover"
              priority
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 border-4 border-primary rounded-xl" />
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 border rounded-lg bg-card">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Protect Your Work</h3>
          <p className="text-muted-foreground">
            Safeguard your photos from unauthorized use with customizable watermarks.
          </p>
        </div>
        
        <div className="p-6 border rounded-lg bg-card">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ImageIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Manage Collections</h3>
          <p className="text-muted-foreground">
            Organize your photos into collections for easier management and watermarking.
          </p>
        </div>
        
        <div className="p-6 border rounded-lg bg-card">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Easy to Use</h3>
          <p className="text-muted-foreground">
            Simple and intuitive interface for quick watermarking without any technical skills.
          </p>
        </div>
      </div>
    </div>
  )
}