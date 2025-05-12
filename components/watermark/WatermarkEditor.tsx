'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { Loader2, RotateCw, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva'
import Konva from 'konva'
import { KonvaEventObject } from 'konva/lib/Node'
import Image from 'next/image'

interface Watermark {
  id: string
  url: string
  isWatermark: boolean
}

interface WatermarkConfig {
  watermarkId: string
  position: { x: number, y: number }
  dimensions: { width: number, height: number }
  rotation: number
}

interface WatermarkEditorProps {
  collectionId: string
  watermarks: Watermark[]
  photoUrl: string
  initialConfig?: WatermarkConfig
  onSave: (config: WatermarkConfig) => void
  onCancel: () => void
}

// Define Konva specific types
interface BoundBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const WatermarkEditor = ({
  collectionId,
  watermarks,
  photoUrl,
  initialConfig,
  onSave,
  onCancel
}: WatermarkEditorProps) => {
  const [selectedWatermarkId, setSelectedWatermarkId] = useState<string>(initialConfig?.watermarkId || '')
  
  // Adjust initial position to account for the centered rotation point
  const initialPosition = initialConfig ? {
    x: initialConfig.position.x + (initialConfig.dimensions.width / 2),
    y: initialConfig.position.y + (initialConfig.dimensions.height / 2)
  } : { x: 0, y: 0 }
  
  const [position, setPosition] = useState<{ x: number, y: number }>(initialPosition)
  const [dimensions, setDimensions] = useState<{ width: number, height: number }>(initialConfig?.dimensions || { width: 200, height: 200 })
  const [rotation, setRotation] = useState<number>(initialConfig?.rotation || 0)
  const [loading, setLoading] = useState<boolean>(false)
  const [photoSize, setPhotoSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
  const [stageSize, setStageSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
  const [photoScale, setPhotoScale] = useState<{ scaleX: number, scaleY: number }>({ scaleX: 1, scaleY: 1 })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLImageElement>(null)
  const watermarkRef = useRef<Konva.Image>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  
  // State for Konva images
  const [photoNode, setPhotoNode] = useState<HTMLImageElement | null>(null)
  const [watermarkNode, setWatermarkNode] = useState<HTMLImageElement | null>(null)
  
  // Load the photo dimensions once it's loaded
  useEffect(() => {
    if (photoRef.current && photoRef.current.complete) {
      setPhotoSize({
        width: photoRef.current.naturalWidth,
        height: photoRef.current.naturalHeight
      })
    }
    
    // Load the photo for Konva
    const image = new window.Image()
    image.src = photoUrl
    image.onload = () => {
      setPhotoNode(image)
    }
  }, [photoUrl])
  
  // Load the watermark image for Konva when selected
  useEffect(() => {
    if (selectedWatermarkId) {
      const selectedWatermark = watermarks.find(w => w.id === selectedWatermarkId)
      if (selectedWatermark) {
        const image = new window.Image()
        image.src = selectedWatermark.url
        image.onload = () => {
          setWatermarkNode(image)
        }
      }
    }
  }, [selectedWatermarkId, watermarks])
  
  // Update stage size when container size changes
  useEffect(() => {
    const updateStageSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    
    updateStageSize()
    window.addEventListener('resize', updateStageSize)
    
    return () => {
      window.removeEventListener('resize', updateStageSize)
    }
  }, [])
  
  // Center the watermark when first selected or when changing watermarks
  useEffect(() => {
    if (selectedWatermarkId && containerRef.current) {
      // If no initial config, center the watermark
      if (!initialConfig || initialConfig.watermarkId !== selectedWatermarkId) {
        const containerRect = containerRef.current.getBoundingClientRect()
        setPosition({
          x: (containerRect.width) / 2,
          y: (containerRect.height) / 2
        })
        setRotation(0)
      }
    }
  }, [selectedWatermarkId, dimensions, initialConfig])
  
  // Attach transformer to watermark when it's available
  useEffect(() => {
    if (watermarkRef.current && transformerRef.current) {
      transformerRef.current.nodes([watermarkRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [watermarkNode])
  
  // Calculate photo scale to fit container
  useEffect(() => {
    if (photoNode && stageSize.width > 0 && stageSize.height > 0) {
      const imageWidth = photoNode.width
      const imageHeight = photoNode.height
      
      const scaleX = stageSize.width / imageWidth
      const scaleY = stageSize.height / imageHeight
      
      // Use the smaller scale to ensure the image fits within the container
      const scale = Math.min(scaleX, scaleY)
      
      setPhotoScale({
        scaleX: scale,
        scaleY: scale
      })
    }
  }, [photoNode, stageSize])
  
  const handleSave = () => {
    if (!selectedWatermarkId) {
      toast.error('Please select a watermark')
      return
    }
    
    // Scale the position and dimensions to match the original photo size
    // This ensures consistent positioning regardless of the display size
    let scaledConfig: WatermarkConfig
    
    if (containerRef.current && photoSize.width > 0 && photoSize.height > 0) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const scaleX = photoSize.width / containerRect.width
      const scaleY = photoSize.height / containerRect.height
      
      // Adjust position to account for the centered rotation point
      const adjustedPosition = {
        x: position.x - dimensions.width / 2,
        y: position.y - dimensions.height / 2
      }
      
      scaledConfig = {
        watermarkId: selectedWatermarkId,
        position: {
          x: adjustedPosition.x * scaleX,
          y: adjustedPosition.y * scaleY
        },
        dimensions: {
          width: dimensions.width * scaleX,
          height: dimensions.height * scaleY
        },
        rotation: rotation
      }
    } else {
      // Fallback if we couldn't get the container size
      const adjustedPosition = {
        x: position.x - dimensions.width / 2,
        y: position.y - dimensions.height / 2
      }
      
      scaledConfig = {
        watermarkId: selectedWatermarkId,
        position: adjustedPosition,
        dimensions,
        rotation
      }
    }
    
    onSave(scaledConfig)
  }
  
  const selectedWatermark = watermarks.find(w => w.id === selectedWatermarkId)
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Watermark Editor</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
        <div className="lg:col-span-2">
          <div 
            ref={containerRef} 
            className="relative bg-gray-100 border rounded-lg overflow-hidden"
            style={{ height: '70vh' }}
          >
            {/* Hidden image for reference */}
            <Image
              ref={photoRef}
              src={photoUrl} 
              alt="Preview" 
              className="hidden"
              width={100}
              height={100}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement
                setPhotoSize({
                  width: img.naturalWidth,
                  height: img.naturalHeight
                })
              }}
            />
            
            {stageSize.width > 0 && stageSize.height > 0 && (
              <Stage width={stageSize.width} height={stageSize.height}>
                <Layer>
                  {photoNode && (
                    <KonvaImage
                      image={photoNode}
                      x={(stageSize.width - (photoNode.width * photoScale.scaleX)) / 2}
                      y={(stageSize.height - (photoNode.height * photoScale.scaleY)) / 2}
                      scaleX={photoScale.scaleX}
                      scaleY={photoScale.scaleY}
                    />
                  )}
                  
                  {watermarkNode && selectedWatermarkId && (
                    <KonvaImage
                      ref={watermarkRef}
                      image={watermarkNode}
                      x={position.x}
                      y={position.y}
                      width={dimensions.width}
                      height={dimensions.height}
                      rotation={rotation}
                      draggable
                      offsetX={dimensions.width / 2}
                      offsetY={dimensions.height / 2}
                      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                        setPosition({
                          x: e.target.x(),
                          y: e.target.y()
                        })
                      }}
                      onTransform={() => {
                        if (watermarkRef.current) {
                          const node = watermarkRef.current
                          const scaleX = node.scaleX()
                          const scaleY = node.scaleY()
                          
                          // Reset scale and update width and height
                          node.scaleX(1)
                          node.scaleY(1)
                          
                          setDimensions({
                            width: Math.max(5, node.width() * scaleX),
                            height: Math.max(5, node.height() * scaleY)
                          })
                          
                          setRotation(node.rotation())
                          setPosition({
                            x: node.x(),
                            y: node.y()
                          })
                        }
                      }}
                    />
                  )}
                  
                  {watermarkNode && selectedWatermarkId && (
                    <Transformer
                      ref={transformerRef}
                      boundBoxFunc={(oldBox: BoundBox, newBox: BoundBox) => {
                        // Limit size
                        if (newBox.width < 5 || newBox.height < 5) {
                          return oldBox
                        }
                        return newBox
                      }}
                      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                      resizeEnabled={true}
                      rotateEnabled={true}
                      keepRatio={false}
                      centeredScaling={true}
                    />
                  )}
                </Layer>
              </Stage>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Select Watermark</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {watermarks.length === 0 ? (
                <p className="col-span-2 text-sm text-gray-500">
                  No watermarks available. Please upload watermarks first.
                </p>
              ) : (
                watermarks.map((watermark) => (
                  <div
                    key={watermark.id}
                    className={`border rounded-md p-2 cursor-pointer transition-all ${
                      selectedWatermarkId === watermark.id
                        ? 'border-primary ring-1 ring-primary'
                        : 'hover:border-gray-400'
                    }`}
                    onClick={() => setSelectedWatermarkId(watermark.id)}
                  >
                    <div className="aspect-square flex items-center justify-center bg-gray-50">
                      <Image
                        src={watermark.url}
                        alt="Watermark option"
                        className="max-h-full max-w-full object-contain"
                        width={100}
                        height={100}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {watermarks.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.location.href = '/watermarks'}
              >
                Upload Watermarks
              </Button>
            )}
          </Card>
          
          {selectedWatermarkId && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Rotation</h3>
              <div className="flex items-center gap-4">
                <Slider
                  value={[rotation]}
                  min={0}
                  max={360}
                  step={1}
                  onValueChange={(values) => {
                    setRotation(values[0])
                    if (watermarkRef.current) {
                      watermarkRef.current.rotation(values[0])
                      watermarkRef.current.getLayer()?.batchDraw()
                    }
                  }}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setRotation(0)
                      if (watermarkRef.current) {
                        watermarkRef.current.rotation(0)
                        watermarkRef.current.getLayer()?.batchDraw()
                      }
                    }}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-right">{Math.round(rotation)}°</span>
                </div>
              </div>
            </Card>
          )}
          
          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!selectedWatermarkId || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Apply Watermark
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WatermarkEditor 