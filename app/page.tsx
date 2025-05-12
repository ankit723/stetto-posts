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
      <div className="flex flex-col md:flex-row items-center justify-center gap-12">
        {/* Hero Content */}
        <div className="flex-1 space-y-6 text-center items-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Protect Your Photos with <span className="text-primary">Watermarks</span>
          </h1>
          
          <p className="text-xl text-muted-foreground">
            Easily add customizable text and image watermarks to protect your digital content and establish your brand identity.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              disabled={loading}
              className="text-lg px-10 py-8 cursor-pointer"
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
          </div>
        </div>
    
      </div>
    </div>
  )
}