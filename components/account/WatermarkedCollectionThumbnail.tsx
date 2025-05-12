'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import WatermarkedImage from '@/components/watermark/WatermarkedImage'

interface WatermarkedCollectionThumbnailProps {
  collectionId: string
  photoUrl: string
}

const WatermarkedCollectionThumbnail = ({
  collectionId,
  photoUrl
}: WatermarkedCollectionThumbnailProps) => {
  const [watermarkConfig, setWatermarkConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWatermarkConfig = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/collections/${collectionId}/watermark`)
        
        if (response.ok) {
          const data = await response.json()
          if (data && data.watermark) {
            setWatermarkConfig(data)
          } else {
            setError('No watermark configuration found')
          }
        } else {
          setError('Failed to load watermark configuration')
        }
      } catch (error) {
        console.error('Error fetching watermark config:', error)
        setError('Error loading watermark')
      } finally {
        setLoading(false)
      }
    }

    if (collectionId && photoUrl) {
      fetchWatermarkConfig()
    }
  }, [collectionId, photoUrl])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !watermarkConfig || !watermarkConfig.watermark) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <span className="text-sm">No preview</span>
      </div>
    )
  }

  return (
    <WatermarkedImage
      photoUrl={photoUrl}
      watermarkUrl={watermarkConfig.watermark.url}
      watermarkConfig={{
        position: watermarkConfig.position,
        dimensions: watermarkConfig.dimensions,
        rotation: watermarkConfig.rotation
      }}
      className="w-full h-full"
    />
  )
}

export default WatermarkedCollectionThumbnail 