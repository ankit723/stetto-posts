'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, Calendar, Images } from 'lucide-react'
import { toast } from 'sonner'
import WatermarkedImage from '@/components/watermark/WatermarkedImage'
import Image from 'next/image'

interface WatermarkConfig {
  id: string
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  rotation: number
  watermark: {
    id: string
    url: string
  }
}

interface WatermarkedCollection {
  id: string
  name: string
  description: string
  photoCount: number
  thumbnailUrl?: string
  createdAt: string
  watermarkConfig: WatermarkConfig
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

  const OptimizedThumbnail = ({ collection }: { collection: WatermarkedCollection }) => {
    if (!collection.thumbnailUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
          <Images className="h-8 w-8 text-gray-400" />
        </div>
      )
    }

    // Use the watermark config data that's already included in the API response
    if (collection.watermarkConfig && collection.watermarkConfig.watermark) {
      return (
        <WatermarkedImage
          photoUrl={collection.thumbnailUrl}
          watermarkUrl={collection.watermarkConfig.watermark.url}
          watermarkConfig={{
            position: collection.watermarkConfig.position,
            dimensions: collection.watermarkConfig.dimensions,
            rotation: collection.watermarkConfig.rotation
          }}
          alt={collection.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )
    }

    // Fallback to regular image if watermark data is missing
    return (
      <Image
        src={collection.thumbnailUrl}
        alt={collection.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        width={400}
        height={300}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading watermarked collections...</p>
        </div>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
        <Images className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No watermarked collections yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          You haven't applied watermarks to any collections yet. Start by browsing collections and adding your watermarks.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/collections">
            <Button>Browse Collections</Button>
          </Link>
          <Link href="/watermarks">
            <Button variant="outline">Manage Watermarks</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {collections.length} collection{collections.length === 1 ? '' : 's'} with watermarks applied
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection) => (
          <Card key={collection.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="aspect-video relative bg-gray-100">
              <OptimizedThumbnail collection={collection} />
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md shadow-sm">
                Watermarked
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-lg mb-1 line-clamp-1">{collection.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {collection.description || 'No description provided'}
                </p>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Images className="h-3 w-3" />
                  <span>{collection.photoCount} photo{collection.photoCount === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(collection.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <Link href={`/collections/${collection.id}`} className="w-full">
                  <Button size="sm" className="w-full group">
                    <span>View Collection</span>
                    <ExternalLink className="h-3 w-3 ml-2 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {collections.length >= 6 && (
        <div className="text-center pt-4">
          <Link href="/collections">
            <Button variant="outline">View All Collections</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

export default WatermarkedCollections 