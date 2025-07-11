'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Shield, Image as ImageIcon, ArrowRight, Users, Clock, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface Collection {
  id: string
  name: string
  description: string
  photoCount: number
  createdAt: string
  hasWatermark: boolean
  photos: Array<{ url: string }>
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [recentCollections, setRecentCollections] = useState<Collection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUserStatus() {
      try {
        // Get current user - this is fast and sufficient for home page
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        // Only fetch collections if user is logged in
        if (user) {
          fetchRecentCollections()
        }
      } catch (error) {
        console.error('Error checking user status:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkUserStatus()
  }, [])

  const fetchRecentCollections = async () => {
    try {
      setCollectionsLoading(true)
      // Use the optimized minimal API for fast loading
      const response = await fetch('/api/collections?minimal=true&limit=6')
      
      if (response.ok) {
        const collections = await response.json()
        setRecentCollections(collections)
      }
    } catch (error) {
      console.error('Error fetching recent collections:', error)
    } finally {
      setCollectionsLoading(false)
    }
  }

  const handleGetStarted = () => {
    if (!user) {
      router.push('/auth/login')
    } else {
      router.push('/collections')
    }
  }

  const CollectionPreview = ({ collection }: { collection: Collection }) => (
    <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group">
      <Link href={`/collections/${collection.id}`} className="block h-full">
        <div className="aspect-video bg-gray-100 relative overflow-hidden">
          {collection.photos.length > 0 ? (
            <Image
              src={collection.photos[0].url}
              alt={collection.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              width={300}
              height={200}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
          )}
          {collection.hasWatermark && (
            <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
              Watermarked
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-medium text-lg mb-1 truncate">{collection.name}</h3>
          <p className="text-gray-500 text-sm line-clamp-2 h-10">
            {collection.description || 'No description'}
          </p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {new Date(collection.createdAt).toLocaleDateString()}
            </span>
            <span className="text-xs text-gray-500">
              {collection.photoCount} photos
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  )

  return (
    <div className="container mx-auto px-4 py-12 md:py-24">
      {/* Hero Section - Fixed alignment */}
      <div className="flex flex-col items-center justify-center text-center space-y-8 mb-16 max-w-5xl mx-auto">
        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Protect Your Photos with <span className="text-primary">Watermarks</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Easily add customizable watermarks to protect your digital content and establish your brand identity. 
            Fast, secure, and professional watermarking for photographers and content creators.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            disabled={loading}
            className="text-lg px-10 py-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                Loading...
              </>
            ) : user ? (
              <>
                View Collections <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              'Get Started Free'
            )}
          </Button>
          
          {!user && (
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => router.push('/collections')}
              className="text-lg px-10 py-6"
            >
              Browse Collections
            </Button>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">Secure Protection</h3>
          <p className="text-muted-foreground">
            Add custom watermarks to protect your intellectual property and prevent unauthorized use.
          </p>
        </div>
        
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">Lightning Fast</h3>
          <p className="text-muted-foreground">
            Optimized processing with parallel downloads and smart chunking for collections of any size.
          </p>
        </div>
        
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Download className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">Batch Processing</h3>
          <p className="text-muted-foreground">
            Process hundreds of photos at once with our advanced batch watermarking system.
          </p>
        </div>
      </div>

      {/* Recent Collections Section - Only show if user is logged in */}
      {user && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold">Recent Collections</h2>
              <p className="text-muted-foreground mt-1">
                Your latest photo collections and watermarked content
              </p>
            </div>
            <Link href="/collections">
              <Button variant="outline">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {collectionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recentCollections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentCollections.map((collection) => (
                <CollectionPreview key={collection.id} collection={collection} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No collections yet</h3>
              <p className="text-gray-500 mb-6">Create your first collection to start watermarking photos</p>
              <Link href="/collections">
                <Button>Create Collection</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Call to Action for Non-Users */}
      {!user && (
        <div className="text-center bg-primary/5 rounded-2xl p-12 space-y-6">
          <h2 className="text-3xl font-bold">Ready to Protect Your Photos?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of photographers and content creators who trust our platform to protect their work.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => router.push('/auth/signup')}
              className="text-lg px-8 py-6"
            >
              Sign Up Free
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => router.push('/auth/login')}
              className="text-lg px-8 py-6"
            >
              Login
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}