'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Download, Share2, ArrowLeft, Image as ImageIcon, Stamp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import WatermarkEditor from '@/components/watermark/WatermarkEditor'
import WatermarkedImage from '@/components/watermark/WatermarkedImage'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import JSZip from 'jszip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Photo {
  id: string
  url: string
  sequence: number
}

interface User {
  id: string
  firstName: string
  lastName: string
}

interface Collection {
  id: string
  name: string
  description: string
  photos: Photo[]
  user: User
}

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
  watermark?: Watermark
}

// Add a new PhotoItem component to handle both watermarked and non-watermarked photos
const PhotoItem = ({ 
  photo, 
  index, 
  collectionName, 
  watermarkConfig, 
  isLightbox = false,
  onLoad
}: { 
  photo: Photo, 
  index: number, 
  collectionName: string, 
  watermarkConfig: WatermarkConfig | null,
  isLightbox?: boolean,
  onLoad?: () => void
}) => {
  const [loaded, setLoaded] = useState(false)

  const handleImageLoad = () => {
    setLoaded(true)
    if (onLoad) onLoad()
  }

  if (watermarkConfig && watermarkConfig.watermark) {
    return (
      <WatermarkedImage
        photoUrl={photo.url}
        watermarkUrl={watermarkConfig.watermark.url}
        watermarkConfig={{
          position: watermarkConfig.position,
          dimensions: watermarkConfig.dimensions,
          rotation: watermarkConfig.rotation
        }}
        alt={`Photo ${index + 1} in ${collectionName}`}
        className={isLightbox ? "max-h-[80vh] max-w-full" : "w-full h-full object-cover"}
        onLoad={handleImageLoad}
      />
    )
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <Image 
        src={photo.url} 
        alt={`Photo ${index + 1} in ${collectionName}`}
        className={isLightbox 
          ? "max-h-[80vh] max-w-full object-contain transition-opacity duration-300" 
          : "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        }
        width={isLightbox ? 1920 : 800}
        height={isLightbox ? 1080 : 800}
        sizes={isLightbox ? "100vw" : "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"}
        quality={isLightbox ? 95 : 90}
        priority={isLightbox || index < 8}
        onLoad={handleImageLoad}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </>
  )
}

const CollectionPage = () => {
  const params = useParams()
  const { id } = params
  
  const [collection, setCollection] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false)
  const [watermarks, setWatermarks] = useState<Watermark[]>([])
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig | null>(null)
  const [isLoadingWatermarks, setIsLoadingWatermarks] = useState(false)
  const [isDownloadingCollection, setIsDownloadingCollection] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isLoadingWatermarkModal, setIsLoadingWatermarkModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [loadedImages, setLoadedImages] = useState(0)
  const [totalImages, setTotalImages] = useState(0)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState('')

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/collections/${id}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch collection')
        }
        
        const data = await response.json()
        
        // Debug: Log the original order and sequence values of photos
        console.log('Original photos order from API:', data.photos.map((p: Photo, idx: number) => 
          `[${idx}] id=${p.id.substring(0, 6)}, seq=${p.sequence}, url=${p.url.substring(0, 30)}...`
        ))
        
        // Debug: Log the sequence values of photos
        console.log('Photos before sorting:', data.photos.map((p: Photo) => ({ id: p.id.substring(0, 6), sequence: p.sequence })))
        
        // Ensure photos are sorted by sequence
        if (data.photos) {
          data.photos.sort((a: Photo, b: Photo) => a.sequence - b.sequence)
        }
        
        // Debug: Log the sequence values after sorting
        console.log('Photos after sorting:', data.photos.map((p: Photo) => ({ id: p.id.substring(0, 6), sequence: p.sequence })))
        
        setCollection(data)
        setTotalImages(data.photos?.length || 0)
      } catch (error) {
        console.error('Error fetching collection:', error)
        setError('Failed to load collection. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchCollection()
    }
  }, [id])

  useEffect(() => {
    const fetchWatermarkConfig = async () => {
      try {
        const response = await fetch(`/api/collections/${id}/watermark`)
        
        if (response.ok) {
          const data = await response.json()
          if (data) {
            setWatermarkConfig(data)
          }
        }
      } catch (error) {
        console.error('Error fetching watermark config:', error)
      }
    }

    if (id) {
      fetchWatermarkConfig()
    }
  }, [id])

  const fetchWatermarks = async () => {
    try {
      setIsLoadingWatermarks(true)
      const response = await fetch('/api/watermarks')
      
      if (!response.ok) {
        throw new Error('Failed to fetch watermarks')
      }
      
      const data = await response.json()
      setWatermarks(data)
    } catch (error) {
      console.error('Error fetching watermarks:', error)
      toast.error('Failed to load watermarks. Please try again.')
    } finally {
      setIsLoadingWatermarks(false)
    }
  }

  const handlePhotoClick = (index: number) => {
    setActivePhotoIndex(index)
    setIsLightboxOpen(true)
  }

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false)
  }

  const handleNextPhoto = () => {
    if (activePhotoIndex !== null && collection?.photos && activePhotoIndex < collection.photos.length - 1) {
      setActivePhotoIndex(activePhotoIndex + 1)
    }
  }

  const handlePrevPhoto = () => {
    if (activePhotoIndex !== null && activePhotoIndex > 0) {
      setActivePhotoIndex(activePhotoIndex - 1)
    }
  }

  const handleDownload = async (photo: Photo) => {
    try {
      setIsDownloading(photo.id)
      toast.info('Preparing download...')
      
      let imageUrl = photo.url
      
      // If watermark is configured, download the watermarked version
      if (watermarkConfig && watermarkConfig.watermark) {
        // Use the API to get a watermarked version
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
        
        try {
          const response = await fetch(`/api/collections/${id}/photos/${photo.id}/watermarked`, {
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            // Try to get more detailed error information
            if (response.headers.get('Content-Type')?.includes('application/json')) {
              const errorData = await response.json()
              throw new Error(errorData.error || `Failed to generate watermarked image (${response.status})`)
            } else {
              throw new Error(`Failed to generate watermarked image (${response.status})`)
            }
          }
          
          const blob = await response.blob()
          imageUrl = URL.createObjectURL(blob)
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Download timed out. Please try again.')
          }
          console.error('Watermarking error:', error)
          toast.error(`Watermarking failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          
          // Fall back to downloading the original image
          toast.info('Downloading original image instead...')
          const response = await fetch(photo.url)
          
          if (!response.ok) {
            throw new Error('Failed to download original image')
          }
          
          const blob = await response.blob()
          imageUrl = URL.createObjectURL(blob)
        }
      } else {
        // Fetch the original image
        const response = await fetch(photo.url)
        
        if (!response.ok) {
          throw new Error('Failed to download original image')
        }
        
        const blob = await response.blob()
        imageUrl = URL.createObjectURL(blob)
      }
      
      // Extract filename from URL
      const urlParts = photo.url.split('/')
      let filename = urlParts[urlParts.length - 1]
      
      // Remove query parameters if any
      if (filename.includes('?')) {
        filename = filename.split('?')[0]
      }
      
      // Add watermarked prefix if using watermark
      if (watermarkConfig && watermarkConfig.watermark) {
        filename = `watermarked_${filename}`
      }
      
      // Create a download link
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(imageUrl)
      
      toast.success('Photo downloaded successfully')
    } catch (error) {
      console.error('Error downloading photo:', error)
      toast.error(`Failed to download photo: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDownloading(null)
    }
  }

  const handleShare = () => {
    setIsSharing(true)
    
    if (typeof navigator.share !== 'undefined' && collection) {
      navigator.share({
        title: collection.name,
        text: `Check out this photo collection: ${collection.name}`,
        url: window.location.href,
      })
      .then(() => toast.success('Shared successfully'))
      .catch((error) => {
        console.error('Error sharing:', error)
        // Don't show error toast for user cancellations
        if (error.name !== 'AbortError') {
          toast.error('Failed to share. Try copying the URL manually.')
        }
      })
      .finally(() => setIsSharing(false))
    } else {
      // Fallback for browsers that don't support share API
      navigator.clipboard.writeText(window.location.href)
        .then(() => toast.success('Link copied to clipboard'))
        .catch(() => toast.error('Failed to copy link'))
        .finally(() => setIsSharing(false))
    }
  }

  const handleOpenWatermarkModal = async () => {
    setIsLoadingWatermarkModal(true)
    try {
      await fetchWatermarks()
      setIsWatermarkModalOpen(true)
    } finally {
      setIsLoadingWatermarkModal(false)
    }
  }

  const handleSaveWatermarkConfig = async (config: WatermarkConfig) => {
    try {
      setIsSavingConfig(true)
      
      const response = await fetch(`/api/collections/${id}/watermark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save watermark configuration')
      }
      
      const data = await response.json()
      setWatermarkConfig(data)
      setIsWatermarkModalOpen(false)
      toast.success('Watermark configuration saved successfully')
    } catch (error) {
      console.error('Error saving watermark configuration:', error)
      toast.error('Failed to save watermark configuration. Please try again.')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const handleDownloadCollection = async () => {
    if (!watermarkConfig) {
      toast.error('Please configure a watermark first')
      return
    }
    
    try {
      setIsDownloadingCollection(true)
      setDownloadProgress(5)
      setDownloadStatus('Preparing download...')
      
      // Show warning if collection has more than 500 images
      if (collection?.photos && collection.photos.length > 500) {
        toast.warning(`This collection has ${collection.photos.length} images. Due to processing limits, only the first 500 images will be downloaded.`)
      } else {
        toast.info('Starting download of all photos. This may take a while...')
      }
      
      // Use fetch with blob response type for downloading
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minute timeout
      
      setDownloadProgress(15)
      setDownloadStatus('Connecting to server...')
      
      const response = await fetch(`/api/collections/${id}/download`, {
        signal: controller.signal,
        cache: 'no-store' // Ensure we don't get a cached response
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        if (response.headers.get('Content-Type')?.includes('application/json')) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to download collection')
        } else {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
      }
      
      setDownloadProgress(30)
      setDownloadStatus('Processing images...')
      
      // Start a progress simulation since we can't get real-time progress from the server
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          // Gradually increase progress up to 90%
          if (prev < 90) {
            const increment = Math.max(1, Math.floor((90 - prev) / 10))
            return prev + increment
          }
          return prev
        })
        
        // Update status messages based on progress
        setDownloadStatus(prev => {
          const progress = downloadProgress
          if (progress < 40) return 'Processing images...'
          if (progress < 60) return 'Applying watermarks...'
          if (progress < 80) return 'Generating zip file...'
          return 'Finalizing download...'
        })
      }, 800)
      
      // Get the blob from the response
      const blob = await response.blob()
      
      // Clear the interval once we have the response
      clearInterval(progressInterval)
      setDownloadProgress(95)
      setDownloadStatus('Downloading file...')
      
      // Check if we got a zip file or just a text file (which might contain an error)
      if (blob.type === 'text/plain' && blob.size < 10000) {
        // Small text file might be an error message
        const text = await blob.text()
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
          throw new Error(text)
        }
      }
      
      // Check if the zip file is too small (might be empty or contain only the README)
      if (blob.type === 'application/zip' && blob.size < 1000) {
        toast.warning('The downloaded file is very small and may not contain all photos')
      }
      
      // Create a download link
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      
      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'collection.zip'
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      } else if (collection) {
        // Fallback to using the collection name
        filename = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_collection.zip`
      }
      
      setDownloadProgress(100)
      setDownloadStatus('Download complete!')
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
      
      // If the file contains a processing report, show a notification
      if (blob.size > 1000) {
        const zip = new JSZip()
        try {
          const zipContents = await zip.loadAsync(blob)
          if (zipContents.files['processing_report.txt']) {
            const reportContent = await zipContents.files['processing_report.txt'].async('text')
            const failedMatch = reportContent.match(/Failed to process: (\d+)/)
            const totalMatch = reportContent.match(/Total photos: (\d+)/)
            const successMatch = reportContent.match(/Successfully processed: (\d+)/)
            
            if (failedMatch && parseInt(failedMatch[1]) > 0) {
              const failed = parseInt(failedMatch[1])
              const total = totalMatch ? parseInt(totalMatch[1]) : (collection?.photos.length || 0)
              const success = successMatch ? parseInt(successMatch[1]) : (total - failed)
              
              if (success === 0) {
                toast.error('Failed to process any photos. Please try again later or contact support.')
              } else if (failed > 0) {
                const percentFailed = Math.round((failed / total) * 100)
                if (percentFailed > 50) {
                  toast.error(`${percentFailed}% of photos failed processing. Please try again later.`)
                } else {
                  toast.warning(`${success} photos processed successfully, ${failed} photos failed. See the processing_report.txt in the zip file for details.`)
                }
              }
            }
          }
        } catch (e) {
          console.error('Error checking zip contents:', e)
        }
      }
      
      toast.success(`Collection downloaded successfully (${Math.round(blob.size / 1024)} KB)`)
    } catch (error: unknown) {
      console.error('Error downloading collection:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Download timed out. The collection may be too large. Please try again later.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to download collection: ${errorMessage}. Please try again later.`)
      }
    } finally {
      setIsDownloadingCollection(false)
      // Reset progress after a short delay to show the completed state
      setTimeout(() => {
        setDownloadProgress(0)
        setDownloadStatus('')
      }, 3000)
    }
  }

  // Render the collection grid with watermarked images
  const renderCollectionGrid = () => {
    if (!collection || !collection.photos) {
      return null;
    }
    
    if (collection.photos.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-lg text-gray-600">This collection doesn&apos;t have any photos yet.</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {collection.photos.map((photo, index) => (
          <Card key={photo.id} className="overflow-hidden group">
            <div 
              className="aspect-square relative cursor-pointer" 
              onClick={() => handlePhotoClick(index)}
            >
              <PhotoItem 
                photo={photo}
                index={index}
                collectionName={collection.name}
                watermarkConfig={watermarkConfig}
              />
              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none"></div>
            </div>
            <div className="p-3 flex justify-end">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-gray-700 hover:text-blue-600"
                onClick={() => handleDownload(photo)}
                disabled={isDownloading === photo.id}
              >
                {isDownloading === photo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  // Render the lightbox with watermarked image
  const renderLightbox = () => {
    if (!isLightboxOpen || activePhotoIndex === null || !collection || !collection.photos) return null
    
    const activePhoto = collection.photos[activePhotoIndex]
    
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
        onClick={handleCloseLightbox}
      >
        <div 
          className="relative max-w-5xl max-h-[90vh] w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <Button 
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2"
            onClick={handleCloseLightbox}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </Button>
          
          <div className="flex items-center justify-center">
            <PhotoItem 
              photo={activePhoto}
              index={activePhotoIndex}
              collectionName={collection.name}
              watermarkConfig={watermarkConfig}
              isLightbox={true}
            />
          </div>
          
          <div className="absolute inset-x-0 bottom-4 flex justify-center space-x-4">
            <Button 
              onClick={() => handleDownload(activePhoto)}
              disabled={isDownloading === activePhoto.id}
              className="bg-white text-black hover:bg-gray-200"
            >
              {isDownloading === activePhoto.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
          </div>
          
          {/* Navigation buttons */}
          {activePhotoIndex > 0 && (
            <Button 
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                handlePrevPhoto()
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </Button>
          )}
          
          {collection.photos.length > 1 && activePhotoIndex < collection.photos.length - 1 && (
            <Button 
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                handleNextPhoto()
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link href="/collections" className="inline-flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Link>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-lg text-red-600">{error}</p>
        </div>
      ) : collection ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{collection.name}</h1>
              {collection.description && (
                <p className="text-gray-600 mb-4">{collection.description}</p>
              )}
              <p className="text-sm text-gray-500">
                {collection.user ? 
                  `By ${collection.user.firstName} ${collection.user.lastName}` : 
                  'By Unknown User'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
              <Button
                onClick={handleShare}
                disabled={isSharing}
                variant="outline"
                className="flex items-center"
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                Share
              </Button>
              
              <Button
                onClick={handleOpenWatermarkModal}
                disabled={isLoadingWatermarkModal}
                variant="outline"
                className="flex items-center"
              >
                {isLoadingWatermarkModal ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Stamp className="h-4 w-4 mr-2" />
                )}
                {watermarkConfig ? 'Edit Watermark' : 'Add Watermark'}
              </Button>
              
              <Button
                onClick={handleDownloadCollection}
                disabled={isDownloadingCollection}
                className="flex items-center"
              >
                {isDownloadingCollection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download All
              </Button>
            </div>
          </div>
          
          {/* Download Progress Bar */}
          {downloadProgress > 0 && (
            <div className="mb-6 p-4 bg-white border rounded-lg shadow-sm">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{downloadStatus}</span>
                <span className="text-sm font-medium">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Collection grid */}
          {renderCollectionGrid()}
          
          {/* Lightbox */}
          {renderLightbox()}
          
          {/* Watermark editor modal */}
          <Dialog open={isWatermarkModalOpen} onOpenChange={setIsWatermarkModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{watermarkConfig ? 'Edit Watermark' : 'Add Watermark'}</DialogTitle>
              </DialogHeader>
              
              {isLoadingWatermarks ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <WatermarkEditor
                  collectionId={id as string}
                  watermarks={watermarks}
                  photoUrl={collection.photos[0]?.url || ''}
                  initialConfig={watermarkConfig || undefined}
                  onSave={handleSaveWatermarkConfig}
                  onCancel={() => setIsWatermarkModalOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  )
}

export default CollectionPage