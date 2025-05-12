'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface WatermarkedImageProps {
  photoUrl: string
  watermarkUrl: string
  watermarkConfig: {
    position: { x: number, y: number }
    dimensions: { width: number, height: number }
    rotation: number
  }
  alt?: string
  className?: string
  onLoad?: () => void
}

const WatermarkedImage: React.FC<WatermarkedImageProps> = ({
  photoUrl,
  watermarkUrl,
  watermarkConfig,
  alt = 'Watermarked image',
  className = '',
  onLoad
}) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const photoImg = new Image()
    const watermarkImg = new Image()
    let photoLoaded = false
    let watermarkLoaded = false

    const renderCanvas = () => {
      if (!photoLoaded || !watermarkLoaded) return
      
      const canvas = canvasRef.current
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // Set canvas dimensions to match the photo
      canvas.width = photoImg.width
      canvas.height = photoImg.height
      setDimensions({ width: photoImg.width, height: photoImg.height })
      
      // Draw the photo
      ctx.drawImage(photoImg, 0, 0)
      
      // Calculate the actual watermark position and dimensions
      // based on the original photo size
      const { position, dimensions, rotation } = watermarkConfig
      
      // Save the current state
      ctx.save()
      
      // Move to the center of where the watermark should be
      ctx.translate(
        position.x + dimensions.width / 2,
        position.y + dimensions.height / 2
      )
      
      // Rotate around this center point
      ctx.rotate((rotation * Math.PI) / 180)
      
      // Draw the watermark with its center at the origin
      ctx.drawImage(
        watermarkImg,
        -dimensions.width / 2,
        -dimensions.height / 2,
        dimensions.width,
        dimensions.height
      )
      
      // Restore the context state
      ctx.restore()
      
      setLoading(false)
      if (onLoad) onLoad()
    }

    photoImg.onload = () => {
      photoLoaded = true
      if (watermarkLoaded) renderCanvas()
    }

    watermarkImg.onload = () => {
      watermarkLoaded = true
      if (photoLoaded) renderCanvas()
    }

    photoImg.onerror = () => {
      setError('Failed to load photo')
      setLoading(false)
    }

    watermarkImg.onerror = () => {
      setError('Failed to load watermark')
      setLoading(false)
    }

    photoImg.src = photoUrl
    watermarkImg.src = watermarkUrl

    return () => {
      photoImg.onload = null
      photoImg.onerror = null
      watermarkImg.onload = null
      watermarkImg.onerror = null
    }
  }, [photoUrl, watermarkUrl, watermarkConfig, onLoad])

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        className={`w-full h-full object-contain ${loading ? 'invisible' : ''}`}
        aria-label={alt}
      />
    </div>
  )
}

export default WatermarkedImage 