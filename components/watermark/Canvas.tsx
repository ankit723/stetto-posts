'use client'

import Image from 'next/image'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Draggable from 'react-draggable'
import { ResizableBox } from 'react-resizable'
import 'react-resizable/css/styles.css'

// Add type declaration for react-draggable if needed
declare module 'react-draggable'

interface CanvasProps {
  photoUrl: string
  watermarkUrl: string
  initialPosition?: { x: number; y: number }
  initialDimensions?: { width: number; height: number }
  initialRotation?: number
  onPositionChange: (position: { x: number; y: number }) => void
  onDimensionsChange: (dimensions: { width: number; height: number }) => void
  onRotationChange: (rotation: number) => void
  onPhotoLoad: (dimensions: { width: number; height: number }) => void
}

const Canvas: React.FC<CanvasProps> = ({
  photoUrl,
  watermarkUrl,
  initialPosition = { x: 0, y: 0 },
  initialDimensions = { width: 200, height: 200 },
  initialRotation = 0,
  onPositionChange,
  onDimensionsChange,
  onRotationChange,
  onPhotoLoad
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLImageElement>(null)
  
  const [loaded, setLoaded] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [position, setPosition] = useState(initialPosition)
  const [dimensions, setDimensions] = useState(initialDimensions)
  const [rotation, setRotation] = useState(initialRotation)
  
  const handlePhotoLoad = useCallback(() => {
    if (photoRef.current) {
      const { naturalWidth, naturalHeight } = photoRef.current
      onPhotoLoad({ width: naturalWidth, height: naturalHeight })
      setLoaded(true)
      
      // If position is at default, center the watermark
      if (position.x === 0 && position.y === 0 && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = containerRef.current.clientHeight
        
        const newPosition = {
          x: (containerWidth - dimensions.width) / 2,
          y: (containerHeight - dimensions.height) / 2
        }
        
        setPosition(newPosition)
        onPositionChange(newPosition)
      }
    }
  }, [position, dimensions, onPhotoLoad, onPositionChange])
  
  useEffect(() => {
    if (photoRef.current && photoRef.current.complete) {
      handlePhotoLoad()
    }
  }, [photoUrl, handlePhotoLoad])
  
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    
    updateContainerSize()
    window.addEventListener('resize', updateContainerSize)
    
    return () => {
      window.removeEventListener('resize', updateContainerSize)
    }
  }, [])
  
  const handleDragStop = (e: any, data: any) => {
    const newPosition = { x: data.x, y: data.y }
    setPosition(newPosition)
    onPositionChange(newPosition)
  }
  
  const handleResize = (e: any, { size }: { size: { width: number, height: number } }) => {
    const newDimensions = { width: size.width, height: size.height }
    setDimensions(newDimensions)
    onDimensionsChange(newDimensions)
  }
  
  return (
    <div 
      ref={containerRef} 
      className="relative overflow-hidden bg-gray-100 rounded-lg"
      style={{ height: '500px' }}
    >
      <Image
        ref={photoRef}
        src={photoUrl}
        alt="Photo"
        className="absolute top-0 left-0 w-full h-full object-contain"
        onLoad={handlePhotoLoad}
        width={100}
        height={100}
      />
      
      {loaded && watermarkUrl && (
        <Draggable
          position={position}
          onStop={handleDragStop}
          bounds="parent"
        >
          <div 
            className="absolute cursor-move"
            style={{ 
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              width: dimensions.width,
              height: dimensions.height,
            }}
          >
            <ResizableBox
              width={dimensions.width}
              height={dimensions.height}
              onResize={handleResize}
              resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
              minConstraints={[50, 50]}
              maxConstraints={[containerSize.width * 0.9, containerSize.height * 0.9]}
            >
              <div className="w-full h-full">
                <Image
                  src={watermarkUrl}
                  alt="Watermark"
                  className="w-full h-full object-contain"
                  draggable={false}
                  style={{ opacity: 0.7 }}
                  width={100}
                  height={100}
                />
              </div>
            </ResizableBox>
          </div>
        </Draggable>
      )}
    </div>
  )
}

export default Canvas 