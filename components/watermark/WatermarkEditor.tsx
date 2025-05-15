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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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
  const [displayScale, setDisplayScale] = useState<number>(1)
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true)
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number>(1)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLImageElement>(null)
  const watermarkRef = useRef<Konva.Image>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  
  // State for Konva images
  const [photoNode, setPhotoNode] = useState<HTMLImageElement | null>(null)
  const [watermarkNode, setWatermarkNode] = useState<HTMLImageElement | null>(null)
  
  // Function to force update the transformer
  const updateTransformer = () => {
    if (watermarkRef.current && transformerRef.current) {
      transformerRef.current.nodes([watermarkRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }
  
  // Load the photo dimensions once it's loaded
  useEffect(() => {
    if (photoRef.current && photoRef.current.complete) {
      const naturalWidth = photoRef.current.naturalWidth
      const naturalHeight = photoRef.current.naturalHeight
      
      setPhotoSize({
        width: naturalWidth,
        height: naturalHeight
      })
    }
    
    // Load the photo for Konva
    const image = new window.Image()
    image.src = photoUrl
    image.onload = () => {
      setPhotoNode(image)
      
      // Update photo size
      setPhotoSize({
        width: image.width,
        height: image.height
      })
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
          setOriginalAspectRatio(image.naturalWidth / image.naturalHeight)
          
          // Force update transformer after a small delay
          setTimeout(updateTransformer, 100)
        }
      }
    }
  }, [selectedWatermarkId, watermarks])
  
  // Update stage size and calculate display scale when container size changes
  useEffect(() => {
    const updateStageSizeAndScale = () => {
      if (containerRef.current && photoSize.width > 0 && photoSize.height > 0) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = containerRef.current.clientHeight
        
        // Calculate the scale to fit the image in the container
        const scaleX = containerWidth / photoSize.width
        const scaleY = containerHeight / photoSize.height
        const scale = Math.min(scaleX, scaleY, 1) // Never scale up, only down
        
        setDisplayScale(scale)
        
        // Set the stage size to the actual image dimensions scaled to fit the container
        setStageSize({
          width: photoSize.width * scale,
          height: photoSize.height * scale
        })
        
        // Update transformer after stage size is set
        setTimeout(updateTransformer, 100)
      }
    }
    
    updateStageSizeAndScale()
    window.addEventListener('resize', updateStageSizeAndScale)
    
    return () => {
      window.removeEventListener('resize', updateStageSizeAndScale)
    }
  }, [photoSize, containerRef])
  
  // Center the watermark when first selected or when changing watermarks
  useEffect(() => {
    if (selectedWatermarkId && photoSize.width > 0 && photoSize.height > 0) {
      // If no initial config, center the watermark
      if (!initialConfig || initialConfig.watermarkId !== selectedWatermarkId) {
        setPosition({
          x: photoSize.width / 2,
          y: photoSize.height / 2
        })
        setRotation(0)
        setDimensions({ width: 200, height: 200 })
      } else if (initialConfig && initialConfig.watermarkId === selectedWatermarkId) {
        // Ensure we properly set the position and dimensions for editing
        const adjustedPosition = {
          x: initialConfig.position.x + (initialConfig.dimensions.width / 2),
          y: initialConfig.position.y + (initialConfig.dimensions.height / 2)
        }
        setPosition(adjustedPosition)
        setDimensions(initialConfig.dimensions)
        setRotation(initialConfig.rotation)
      }
    }
  }, [selectedWatermarkId, photoSize, initialConfig])
  
  // Attach transformer to watermark when it's available
  useEffect(() => {
    if (watermarkRef.current && transformerRef.current) {
      transformerRef.current.nodes([watermarkRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [watermarkNode])
  
  // Add a new useEffect to ensure transformer is attached after position and dimensions are set
  useEffect(() => {
    if (watermarkRef.current && transformerRef.current && position.x !== 0 && position.y !== 0) {
      transformerRef.current.nodes([watermarkRef.current])
      layerRef.current?.batchDraw()
    }
  }, [position, dimensions, rotation])
  
  const handleSave = () => {
    if (!selectedWatermarkId) {
      toast.error('Please select a watermark')
      return
    }
    
    // Calculate the position in the original photo coordinates
    // Since we're working with the actual image dimensions now,
    // we just need to adjust for the centered rotation point
    const adjustedPosition = {
      x: position.x - dimensions.width / 2,
      y: position.y - dimensions.height / 2
    }
    
    const config: WatermarkConfig = {
      watermarkId: selectedWatermarkId,
      position: adjustedPosition,
      dimensions,
      rotation
    }
    
    onSave(config)
  }
  
  const selectedWatermark = watermarks.find(w => w.id === selectedWatermarkId)
  
  // Function to handle watermark transform
  const handleTransformEnd = () => {
    if (watermarkRef.current) {
      const node = watermarkRef.current
      
      // Get the new dimensions
      const newWidth = node.width() * node.scaleX()
      const newHeight = node.height() * node.scaleY()
      
      // Reset scale to 1
      node.scaleX(1)
      node.scaleY(1)
      
      // Set new dimensions
      node.width(newWidth)
      node.height(newHeight)
      
      // Update state with the actual dimensions (accounting for display scale)
      setDimensions({
        width: newWidth / displayScale,
        height: newHeight / displayScale
      })
      
      // Update position (accounting for display scale)
      setPosition({
        x: node.x() / displayScale,
        y: node.y() / displayScale
      })
      
      // Update rotation
      setRotation(node.rotation())
      
      // Redraw the layer
      node.getLayer()?.batchDraw()
    }
  }
  
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
            className="relative bg-gray-100 border rounded-lg overflow-hidden flex items-center justify-center"
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
            
            {stageSize.width > 0 && stageSize.height > 0 && photoNode && (
              <Stage 
                ref={stageRef}
                width={stageSize.width} 
                height={stageSize.height}
                style={{ 
                  boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                  maxWidth: '100%', 
                  maxHeight: '100%' 
                }}
              >
                <Layer ref={layerRef}>
                  {/* Photo Image */}
                  <KonvaImage
                    image={photoNode}
                    width={photoSize.width * displayScale}
                    height={photoSize.height * displayScale}
                  />
                  
                  {/* Watermark Image */}
                  {watermarkNode && selectedWatermarkId && (
                    <KonvaImage
                      ref={watermarkRef}
                      image={watermarkNode}
                      x={position.x * displayScale}
                      y={position.y * displayScale}
                      width={dimensions.width * displayScale}
                      height={dimensions.height * displayScale}
                      rotation={rotation}
                      draggable
                      offsetX={(dimensions.width * displayScale) / 2}
                      offsetY={(dimensions.height * displayScale) / 2}
                      onDragEnd={(e) => {
                        setPosition({
                          x: e.target.x() / displayScale,
                          y: e.target.y() / displayScale
                        })
                      }}
                      onTransformEnd={handleTransformEnd}
                    />
                  )}
                  
                  {/* Transformer */}
                  {watermarkNode && selectedWatermarkId && (
                    <Transformer
                      ref={transformerRef}
                      boundBoxFunc={(oldBox, newBox) => {
                        // Limit minimum size
                        if (newBox.width < 10 || newBox.height < 10) {
                          return oldBox
                        }
                        return newBox
                      }}
                      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                      anchorSize={10}
                      anchorCornerRadius={5}
                      borderStroke="#2563eb"
                      borderStrokeWidth={2}
                      anchorStroke="#2563eb"
                      anchorFill="#ffffff"
                      rotateEnabled={true}
                      resizeEnabled={true}
                    />
                  )}
                </Layer>
              </Stage>
            )}
            
            {(!photoNode || stageSize.width === 0) && (
              <div className="flex items-center justify-center w-full h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
          
          {selectedWatermarkId && (
            <div className="mt-4 text-sm text-gray-500">
              <p>Tip: Click and drag the watermark to position it. Use the handles to resize, and the rotation control to rotate.</p>
            </div>
          )}
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
          
          {selectedWatermarkId && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Size</h3>
              <div className="space-y-4">
                <div className="flex items-center mb-2 gap-2">
                  <Checkbox
                    id="maintain-aspect-ratio"
                    checked={maintainAspectRatio}
                    onCheckedChange={(checked) => setMaintainAspectRatio(checked as boolean)}
                  />
                  <Label htmlFor="maintain-aspect-ratio" className="text-xs text-gray-700 cursor-pointer">
                    Maintain aspect ratio
                  </Label>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs text-gray-500">Width</label>
                    <span className="text-xs text-gray-500">{Math.round(dimensions.width)}px</span>
                  </div>
                  <Slider
                    value={[dimensions.width]}
                    min={50}
                    max={photoSize.width}
                    step={1}
                    onValueChange={(values) => {
                      const newWidth = values[0]
                      let newHeight = dimensions.height
                      
                      if (maintainAspectRatio && originalAspectRatio) {
                        newHeight = newWidth / originalAspectRatio
                      }
                      
                      const updatedDimensions = {
                        width: newWidth,
                        height: newHeight
                      }
                      
                      setDimensions(updatedDimensions)
                      
                      if (watermarkRef.current) {
                        watermarkRef.current.width(updatedDimensions.width * displayScale)
                        watermarkRef.current.height(updatedDimensions.height * displayScale)
                        watermarkRef.current.offsetX((updatedDimensions.width * displayScale) / 2)
                        watermarkRef.current.offsetY((updatedDimensions.height * displayScale) / 2)
                        watermarkRef.current.getLayer()?.batchDraw()
                      }
                    }}
                    className="flex-1"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs text-gray-500">Height</label>
                    <span className="text-xs text-gray-500">{Math.round(dimensions.height)}px</span>
                  </div>
                  <Slider
                    value={[dimensions.height]}
                    min={50}
                    max={photoSize.height}
                    step={1}
                    onValueChange={(values) => {
                      const newHeight = values[0]
                      let newWidth = dimensions.width
                      
                      if (maintainAspectRatio && originalAspectRatio) {
                        newWidth = newHeight * originalAspectRatio
                      }
                      
                      const updatedDimensions = {
                        width: newWidth,
                        height: newHeight
                      }
                      
                      setDimensions(updatedDimensions)
                      
                      if (watermarkRef.current) {
                        watermarkRef.current.width(updatedDimensions.width * displayScale)
                        watermarkRef.current.height(updatedDimensions.height * displayScale)
                        watermarkRef.current.offsetX((updatedDimensions.width * displayScale) / 2)
                        watermarkRef.current.offsetY((updatedDimensions.height * displayScale) / 2)
                        watermarkRef.current.getLayer()?.batchDraw()
                      }
                    }}
                    className="flex-1"
                  />
                </div>
                
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Reset to default size
                      const defaultSize = { width: 200, height: 200 }
                      setDimensions(defaultSize)
                      
                      if (watermarkRef.current) {
                        watermarkRef.current.width(defaultSize.width * displayScale)
                        watermarkRef.current.height(defaultSize.height * displayScale)
                        watermarkRef.current.offsetX((defaultSize.width * displayScale) / 2)
                        watermarkRef.current.offsetY((defaultSize.height * displayScale) / 2)
                        watermarkRef.current.getLayer()?.batchDraw()
                      }
                    }}
                  >
                    Reset Size
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Apply original aspect ratio
                      if (watermarkNode) {
                        const newHeight = dimensions.width / originalAspectRatio
                        
                        const updatedDimensions = {
                          width: dimensions.width,
                          height: newHeight
                        }
                        
                        setDimensions(updatedDimensions)
                        
                        if (watermarkRef.current) {
                          watermarkRef.current.width(updatedDimensions.width * displayScale)
                          watermarkRef.current.height(updatedDimensions.height * displayScale)
                          watermarkRef.current.offsetX((updatedDimensions.width * displayScale) / 2)
                          watermarkRef.current.offsetY((updatedDimensions.height * displayScale) / 2)
                          watermarkRef.current.getLayer()?.batchDraw()
                        }
                      }
                    }}
                  >
                    Apply Original Ratio
                  </Button>
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