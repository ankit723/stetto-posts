'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import WatermarkedCollectionThumbnail from './WatermarkedCollectionThumbnail'

interface WatermarkedCollection {
  id: string
  name: string
  description: string
  photoCount: number
  thumbnailUrl?: string
  createdAt: string
}

const WatermarkedCollections = () => {
  const [collections, setCollections] = useState<WatermarkedCollection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWatermarkedCollections = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/account/watermarked-collections')
        
        if (!response.ok) {
          throw new Error('Failed to fetch watermarked collections')
        }
        
        const data = await response.json()
        setCollections(data)
      } catch (error) {
        console.error('Error fetching watermarked collections:', error)
        toast.error('Failed to load watermarked collections. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchWatermarkedCollections()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading watermarked collections...</span>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">You haven&apos;t watermarked any collections yet.</p>
        <Link href="/collections">
          <Button variant="outline">Browse Collections</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((collection) => (
          <Card key={collection.id} className="overflow-hidden">
            <div className="aspect-video relative bg-gray-100">
              {collection.thumbnailUrl ? (
                <WatermarkedCollectionThumbnail 
                  collectionId={collection.id}
                  photoUrl={collection.thumbnailUrl}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No thumbnail
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="font-medium text-lg mb-1 truncate">{collection.name}</h3>
              <p className="text-sm text-gray-500 mb-2 line-clamp-2">{collection.description || 'No description'}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{collection.photoCount} photos</span>
                <Link href={`/collections/${collection.id}`}>
                  <Button size="sm" variant="outline" className="flex items-center gap-1">
                    <span>View</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default WatermarkedCollections 