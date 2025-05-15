'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, FolderPlus, Image as ImageIcon, Edit, Trash2, MoreVertical, Upload, X, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/utils/supabase/client'
import { isUserAdmin } from '../auth/actions'
import Image from 'next/image'
import { compressImageToFile } from '@/utils/imageCompression'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'

// Add import for WatermarkedImage component
import WatermarkedImage from '@/components/watermark/WatermarkedImage'

interface Photo {
  id: string
  url: string
}

interface Collection {
  id: string
  name: string
  description: string
  photos: Photo[]
  createdAt: string
  hasWatermark: boolean
}

interface PreviewImage {
  id: string
  file: File
  preview: string
  originalIndex: number
}

// Add a new component for collection thumbnails
const CollectionThumbnail = ({ collection }: { collection: Collection }) => {
  const [watermarkConfig, setWatermarkConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only fetch watermark config if the collection has a watermark
    if (!collection.hasWatermark) {
      setLoading(false)
      return
    }

    const fetchWatermarkConfig = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/collections/${collection.id}/watermark`)
        
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

    if (collection.id && collection.photos.length > 0) {
      fetchWatermarkConfig()
    }
  }, [collection.id, collection.hasWatermark, collection.photos])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  // If collection has watermark and we have the config, use WatermarkedImage
  if (collection.hasWatermark && watermarkConfig && watermarkConfig.watermark && collection.photos.length > 0) {
    return (
      <WatermarkedImage
        photoUrl={collection.photos[0].url}
        watermarkUrl={watermarkConfig.watermark.url}
        watermarkConfig={{
          position: watermarkConfig.position,
          dimensions: watermarkConfig.dimensions,
          rotation: watermarkConfig.rotation
        }}
        alt={collection.name}
        className="w-full h-full object-cover"
      />
    )
  }

  // For collections without watermark or if there was an error loading watermark config
  if (collection.photos.length > 0) {
    return (
      <Image
        src={collection.photos[0].url} 
        alt={collection.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        width={500}
        height={300}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority
      />
    )
  }

  // Fallback for collections without photos
  return (
    <div className="w-full h-full flex items-center justify-center">
      <ImageIcon className="h-12 w-12 text-gray-300" />
    </div>
  )
}

const CollectionsPage = () => {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [editCollectionId, setEditCollectionId] = useState('')
  const [editCollectionName, setEditCollectionName] = useState('')
  const [editCollectionDescription, setEditCollectionDescription] = useState('')
  const [deleteCollectionId, setDeleteCollectionId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([])
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([])
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isImageLoading, setIsImageLoading] = useState<{[key: string]: boolean}>({})
  const [deletingProgress, setDeletingProgress] = useState(0)
  const [isDeletingPhotos, setIsDeletingPhotos] = useState(false)
  const [currentCollection, setCurrentCollection] = useState<Collection | null>(null)
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null)
  // Add new state for multi-select
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false)
  
  // Constants for upload configuration
  const STORAGE_BATCH_SIZE = 10      // Smaller batches for better reliability
  const MAX_RETRIES = 3              // Reasonable retry attempts
  const RETRY_DELAY = 1000           // Base delay before retry (ms)
  
  const MAX_IMAGES = 500 // Maximum number of images allowed per collection
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await isUserAdmin()
        setIsAdmin(adminStatus)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setAdminLoading(false)
      }
    }
    
    checkAdminStatus()
  }, [])

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/collections')
      
      if (!response.ok) {
        throw new Error('Failed to fetch collections')
      }
      
      const data = await response.json()
      
      // Add hasWatermark property based on whether the collection has a watermark configuration
      const collectionsWithWatermarkInfo = await Promise.all(
        data.map(async (collection: Collection) => {
          try {
            const watermarkResponse = await fetch(`/api/collections/${collection.id}/watermark`)
            const hasWatermark = watermarkResponse.ok
            return { ...collection, hasWatermark }
          } catch (error) {
            return { ...collection, hasWatermark: false }
          }
        })
      )
      
      setCollections(collectionsWithWatermarkInfo)
    } catch (error) {
      console.error('Error fetching collections:', error)
      toast.error('Failed to load collections. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    
    const files = Array.from(e.target.files)
    
    // Limit the number of files to add
    const filesToAdd = files.slice(0, MAX_IMAGES - selectedFiles.length)
    
    // Show warning if some files were dropped
    if (files.length > filesToAdd.length) {
      toast.warning(`Only added ${filesToAdd.length} images. Maximum of ${MAX_IMAGES} new images allowed.`)
    }
    
    // Immediately assign sequence numbers to preserve original selection order
    // This happens before any async operations that could change the order
    const filesWithOrder = filesToAdd.map((file, index) => {
      // Store the original order directly on the file object using a custom property
      const fileWithOrder = Object.assign(file, { 
        originalOrder: selectedFiles.length + index 
      })
      return fileWithOrder
    })
    
    console.log('Original file order:', filesWithOrder.map((f, i) => 
      `[${i}] ${f.name} (order=${(f as any).originalOrder})`
    ))
    
    // Show loading state while compressing images
    setIsImageLoading(prev => {
      const newState = {...prev}
      filesWithOrder.forEach(file => {
        const id = Math.random().toString(36).substring(2)
        newState[id] = true
      })
      return newState
    })
    
    // Process files in parallel with compression while preserving original order
    const processedFiles: File[] = []
    const newPreviews: PreviewImage[] = []
    
    await Promise.all(filesWithOrder.map(async (file) => {
      try {
        // Generate a unique ID for this image
        const id = Math.random().toString(36).substring(2)
        
        // Compress the image using adaptive compression
        const compressedFile = await compressImageToFile(file)
        // Transfer the originalOrder property to the compressed file
        Object.assign(compressedFile, { originalOrder: (file as any).originalOrder })
        
        // Add to processed files
        processedFiles.push(compressedFile)
        
        // Create preview URL
        const preview = URL.createObjectURL(compressedFile)
        
        // Create an image object to detect when it's loaded
        const imgElement = document.createElement('img')
        imgElement.onload = () => {
          setIsImageLoading(prev => ({...prev, [id]: false}))
        }
        imgElement.src = preview
        
        // Add to preview images with the correct index to maintain order
        newPreviews.push({
          id,
          file: compressedFile,
          preview,
          originalIndex: (file as any).originalOrder // Use the original order we stored
        })
      } catch (error) {
        console.error('Error compressing image:', error)
        toast.error('Failed to process image. Please try again.')
      }
    }))
    
    // Sort the processed files and previews by originalOrder before updating state
    processedFiles.sort((a, b) => (a as any).originalOrder - (b as any).originalOrder)
    newPreviews.sort((a, b) => a.originalIndex - b.originalIndex)
    
    console.log('Processed files order:', processedFiles.map((f, i) => 
      `[${i}] ${f.name} (order=${(f as any).originalOrder})`
    ))
    
    // Update state with processed files
    setSelectedFiles((prevFiles) => [...prevFiles, ...processedFiles])
    setPreviewImages((prevPreviews) => [...prevPreviews, ...newPreviews])
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files)
      
      // Filter for only image files
      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      
      if (imageFiles.length === 0) {
        toast.error('Please drop image files only')
        return
      }
      
      // Limit the number of files to add
      const filesToAdd = imageFiles.slice(0, MAX_IMAGES - selectedFiles.length)
      
      // Show warning if some files were dropped
      if (imageFiles.length > filesToAdd.length) {
        toast.warning(`Only added ${filesToAdd.length} images. Maximum of ${MAX_IMAGES} new images allowed.`)
      }
      
      // Immediately assign sequence numbers to preserve original selection order
      // This happens before any async operations that could change the order
      const filesWithOrder = filesToAdd.map((file, index) => {
        // Store the original order directly on the file object using a custom property
        const fileWithOrder = Object.assign(file, { 
          originalOrder: selectedFiles.length + index 
        })
        return fileWithOrder
      })
      
      console.log('Original dropped file order:', filesWithOrder.map((f, i) => 
        `[${i}] ${f.name} (order=${(f as any).originalOrder})`
      ))
      
      // Show loading state while compressing images
      setIsImageLoading(prev => {
        const newState = {...prev}
        filesWithOrder.forEach(file => {
          const id = Math.random().toString(36).substring(2)
          newState[id] = true
        })
        return newState
      })
      
      // Process files in parallel with compression while preserving original order
      const processedFiles: File[] = []
      const newPreviews: PreviewImage[] = []
      
      await Promise.all(filesWithOrder.map(async (file) => {
        try {
          // Generate a unique ID for this image
          const id = Math.random().toString(36).substring(2)
          
          // Compress the image using adaptive compression
          const compressedFile = await compressImageToFile(file)
          // Transfer the originalOrder property to the compressed file
          Object.assign(compressedFile, { originalOrder: (file as any).originalOrder })
          
          // Add to processed files
          processedFiles.push(compressedFile)
          
          // Create preview URL
          const preview = URL.createObjectURL(compressedFile)
          
          // Create an image object to detect when it's loaded
          const imgElement = document.createElement('img')
          imgElement.onload = () => {
            setIsImageLoading(prev => ({...prev, [id]: false}))
          }
          imgElement.src = preview
          
          // Add to preview images with the correct index to maintain order
          newPreviews.push({
            id,
            file: compressedFile,
            preview,
            originalIndex: (file as any).originalOrder // Use the original order we stored
          })
        } catch (error) {
          console.error('Error compressing image:', error)
          toast.error('Failed to process image. Please try again.')
        }
      }))
      
      // Sort the processed files and previews by originalOrder before updating state
      processedFiles.sort((a, b) => (a as any).originalOrder - (b as any).originalOrder)
      newPreviews.sort((a, b) => a.originalIndex - b.originalIndex)
      
      console.log('Processed dropped files order:', processedFiles.map((f, i) => 
        `[${i}] ${f.name} (order=${(f as any).originalOrder})`
      ))
      
      // Update state with processed files
      setSelectedFiles((prevFiles) => [...prevFiles, ...processedFiles])
      setPreviewImages((prevPreviews) => [...prevPreviews, ...newPreviews])
    }
  }

  const removeImage = (id: string) => {
    // Find the image to remove
    const imageToRemove = previewImages.find((image) => image.id === id)
    if (!imageToRemove) return
    
    // Get its original index
    const removedIndex = imageToRemove.originalIndex
    
    // Remove from previewImages
    setPreviewImages((prevPreviews) => {
      // First filter out the removed image
      const filteredPreviews = prevPreviews.filter((image) => image.id !== id)
      
      // Then adjust indices for images that came after the removed one
      return filteredPreviews.map(image => {
        if (image.originalIndex > removedIndex) {
          return { ...image, originalIndex: image.originalIndex - 1 }
        }
        return image
      })
    })
    
    // Also remove from selectedFiles
    setSelectedFiles((prevFiles) => 
      prevFiles.filter((file) => file !== imageToRemove.file)
    )
  }

  const removeExistingPhoto = (photoId: string) => {
    // Remove from existingPhotos
    setExistingPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    
    // Add to photosToDelete
    setPhotosToDelete((prev) => [...prev, photoId])
    
    // No need to adjust originalIndex values for new images since
    // existing photos are separate from newly added photos
  }

  const handleCreateCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!newCollectionName.trim()) {
      toast.error('Please enter a name for the collection')
      return
    }
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isCreating) {
        setIsCreating(false)
        toast.error('Operation timed out. Please try again with fewer images or check your connection.')
      }
    }, 120000) // 2 minute timeout
    
    try {
      setIsCreating(true)
      setUploadProgress(0)
      
      // Constants for upload configuration - optimized for reliability
      const API_BATCH_SIZE = 10             // Smaller API batches to reduce connection issues
      const API_CALL_DELAY = 500            // Longer delay between API calls
      
      // Create the collection first
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCollectionName,
          description: newCollectionDescription,
          images: [], // Initially create without images
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create collection')
      }
      
      const newCollection = await response.json()
      const collectionId = newCollection.id
      
      // 2. Preprocess images before upload (in parallel)
      console.time('Image Preprocessing')
      const filesToProcess = selectedFiles.slice(0, 50) // Enforce 50 image limit
      const totalFiles = filesToProcess.length
      let processedFiles = 0
      
      console.log('Selected files order:', selectedFiles.map((file, idx) => 
        `[${idx}] ${file.name} (order=${(file as any).originalOrder || 'unknown'})`
      ))
      console.log('Preview images order:', previewImages.map(img => 
        `[${img.originalIndex}] ${img.file.name}`
      ))
      
      // Prepare all file names and paths in advance - maintain original order
      const fileInfos = filesToProcess.map((file, index) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        return {
          file,
          fileName,
          filePath: `collections/${collectionId}/${fileName}`,
          processed: false,
          url: null as string | null,
          originalIndex: (file as any).originalOrder || index // Use stored originalOrder if available
        }
      })
      
      // Sort fileInfos by originalIndex to ensure correct order
      fileInfos.sort((a, b) => a.originalIndex - b.originalIndex)
      
      console.timeEnd('Image Preprocessing')
      
      console.log('File infos created with indices:', fileInfos.map(info => 
        `[${info.originalIndex}] ${info.file.name}`
      ))
      
      // 3. Process uploads in smaller batches for better reliability
      console.time('Storage Uploads')
      const allImageUrls: Array<{url: string, originalIndex: number}> = []
      
      // Function to upload with retry mechanism and optimizations
      const uploadFileWithRetry = async (fileInfo: typeof fileInfos[0], retryCount = 0): Promise<string | null> => {
        try {
          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(fileInfo.filePath, fileInfo.file)
            
          if (uploadError) {
            throw uploadError
          }
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(fileInfo.filePath)
            
          return publicUrl
        } catch (error) {
          if (retryCount < MAX_RETRIES) {
            // Longer delay before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)))
            return uploadFileWithRetry(fileInfo, retryCount + 1)
          }
          console.error('Upload failed after retries:', error)
          return null
        }
      }
      
      // Process uploads in smaller batches for better reliability
      for (let i = 0; i < fileInfos.length; i += STORAGE_BATCH_SIZE) {
        // Get current batch
        const currentBatch = fileInfos.slice(i, i + STORAGE_BATCH_SIZE)
        
        console.log(`Processing batch ${i / STORAGE_BATCH_SIZE + 1} with indices:`, 
          currentBatch.map(info => `${info.originalIndex}: ${info.file.name}`))
        
        // Process batch in parallel
        const batchPromises = currentBatch.map(fileInfo => uploadFileWithRetry(fileInfo))
        const batchResults = await Promise.all(batchPromises)
        
        // Process results
        batchResults.forEach((url, index) => {
          if (url) {
            currentBatch[index].url = url
            currentBatch[index].processed = true
            allImageUrls.push({
              url,
              originalIndex: currentBatch[index].originalIndex
            })
            console.log(`Uploaded file ${currentBatch[index].file.name} with index ${currentBatch[index].originalIndex}`)
          }
        })
        
        // Update progress
        processedFiles += currentBatch.length
        setUploadProgress(Math.round((processedFiles / totalFiles) * 100))
        
        // Add a delay between batches to prevent overwhelming the server
        if (i + STORAGE_BATCH_SIZE < fileInfos.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      console.timeEnd('Storage Uploads')
      
      // 4. Process database updates in a single API call
      console.time('Database Updates')
      if (allImageUrls.length > 0) {
        try {
          // Sort by original index to maintain upload order
          allImageUrls.sort((a, b) => a.originalIndex - b.originalIndex)
          
          console.log('Sorted image URLs for API call:', 
            allImageUrls.map(item => `${item.originalIndex}: ${item.url.substring(0, 30)}...`))
          
          // Send all images in a single API call
          const response = await fetch(`/api/collections/${collectionId}/photos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: allImageUrls.map(item => item.url),
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add photos');
          }
          
          const result = await response.json();
          console.log(`Added ${result.addedCount} photos to collection in a single operation`);
        } catch (error) {
          console.error('Failed to add photos:', error);
          toast.error(`Error adding photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      console.timeEnd('Database Updates')
      
      // 5. Calculate success metrics and update UI
      console.time('UI Updates')
      const successRate = (allImageUrls.length / totalFiles) * 100
      
      // Update UI state - use the collection ID but set photos manually
      setCollections(prev => [
        ...prev, 
        { 
          ...newCollection, 
          photos: allImageUrls.map(item => ({ id: Math.random().toString(), url: item.url })),
          hasWatermark: false 
        }
      ])
      
      // Reset state
      setIsAddDialogOpen(false)
      setNewCollectionName('')
      setNewCollectionDescription('')
      setSelectedFiles([])
      setPreviewImages([])
      
      // Show appropriate success message based on upload results
      if (allImageUrls.length === 0) {
        toast.error('Failed to upload any images. Collection created without images.')
      } else if (successRate < 100) {
        toast.success(`Collection created with ${allImageUrls.length} of ${totalFiles} images`)
      } else {
        toast.success('Collection created successfully with all images')
      }
      console.timeEnd('UI Updates')
      
    } catch (error) {
      console.error('Error creating collection:', error)
      toast.error(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      clearTimeout(timeoutId)
      setIsCreating(false)
    }
  }

  const handleEditCollection = (collection: Collection) => {
    setEditCollectionId(collection.id)
    setEditCollectionName(collection.name)
    setEditCollectionDescription(collection.description)
    setExistingPhotos(collection.photos || [])
    setIsEditDialogOpen(true)
  }

  const handleDeleteCollection = (collectionId: string) => {
    setDeleteCollectionId(collectionId)
    setIsDeleteDialogOpen(true)
  }

  // Add new function to handle batch deletion
  const handleBatchDelete = () => {
    if (selectedCollections.length === 0) {
      toast.error('No collections selected')
      return
    }
    setIsBatchDeleteDialogOpen(true)
  }

  // Add new function to toggle collection selection
  const toggleCollectionSelection = (collectionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId)
      } else {
        return [...prev, collectionId]
      }
    })
  }

  // Add new function to toggle select mode
  const toggleSelectMode = () => {
    setSelectMode(prev => !prev)
    if (selectMode) {
      setSelectedCollections([])
    }
  }

  // Add new function to select all collections
  const selectAllCollections = () => {
    if (selectedCollections.length === collections.length) {
      setSelectedCollections([])
    } else {
      setSelectedCollections(collections.map(c => c.id))
    }
  }

  // Add new function to submit batch delete
  const submitBatchDeleteCollections = async () => {
    if (selectedCollections.length === 0) return
    
    try {
      setIsBatchDeleting(true)
      setDeletingProgress(0)
      
      // Track total collections and deleted count for progress
      const totalToDelete = selectedCollections.length
      let deletedCount = 0
      
      // Process deletions sequentially to avoid overwhelming the server
      for (const collectionId of selectedCollections) {
        try {
          const response = await fetch(`/api/collections/${collectionId}`, {
            method: 'DELETE',
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to delete collection ${collectionId}:`, errorData.error)
            continue
          }
          
          deletedCount++
          setDeletingProgress(Math.round((deletedCount / totalToDelete) * 100))
        } catch (error) {
          console.error(`Error deleting collection ${collectionId}:`, error)
        }
      }
      
      // Update collections state by removing deleted collections
      setCollections(collections.filter(c => !selectedCollections.includes(c.id)))
      setSelectedCollections([])
      setSelectMode(false)
      setIsBatchDeleteDialogOpen(false)
      
      if (deletedCount === totalToDelete) {
        toast.success(`Successfully deleted ${deletedCount} collections`)
      } else {
        toast.warning(`Deleted ${deletedCount} of ${totalToDelete} collections`)
      }
    } catch (error) {
      console.error('Error in batch deletion:', error)
      toast.error(`Failed to complete batch deletion: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsBatchDeleting(false)
    }
  }

  const submitEditCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!editCollectionName.trim()) {
      toast.error('Please enter a name for the collection')
      return
    }
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isEditing) {
        setIsEditing(false)
        toast.error('Operation timed out. Please try again with fewer images or check your connection.')
      }
    }, 120000) // 2 minute timeout
    
    try {
      setIsEditing(true)
      setUploadProgress(0)
      
      // 1. First update the collection metadata
      console.time('Metadata Update')
      const metadataResponse = await fetch(`/api/collections/${editCollectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editCollectionName,
          description: editCollectionDescription,
          newImages: [], // No new images in this step
          existingPhotos: existingPhotos.map(photo => photo.id),
          photosToDelete
        }),
      })
      
      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json()
        throw new Error(errorData.error || 'Failed to update collection')
      }
      
      const updatedCollection = await metadataResponse.json()
      console.timeEnd('Metadata Update')
      
      // Constants for upload configuration - optimized for reliability
      const API_BATCH_SIZE = 10             // Smaller API batches to reduce connection issues
      const API_CALL_DELAY = 500            // Longer delay between API calls
      
      // Only proceed with image processing if there are new images
      if (selectedFiles.length > 0) {
        // 2. Preprocess images before upload (in parallel)
        console.time('Image Preprocessing')
        const filesToProcess = selectedFiles.slice(0, 50) // Enforce 50 image limit
        const totalFiles = filesToProcess.length
        let processedFiles = 0
        
        // Prepare all file names and paths in advance
        const fileInfos = filesToProcess.map((file, index) => {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
          return {
            file,
            fileName,
            filePath: `collections/${editCollectionId}/${fileName}`,
            processed: false,
            url: null as string | null,
            originalIndex: (file as any).originalOrder || index // Use stored originalOrder if available
          }
        })
        
        // Sort fileInfos by originalIndex to ensure correct order
        fileInfos.sort((a, b) => a.originalIndex - b.originalIndex)
        
        console.log('Edit mode - file infos created with indices:', fileInfos.map(info => 
          `[${info.originalIndex}] ${info.file.name}`
        ))
        
        console.timeEnd('Image Preprocessing')
        
        // 3. Process uploads in smaller batches for better reliability
        console.time('Storage Uploads')
        const allImageUrls: Array<{url: string, originalIndex: number}> = []
        
        // Function to upload with retry mechanism and optimizations
        const uploadFileWithRetry = async (fileInfo: typeof fileInfos[0], retryCount = 0): Promise<string | null> => {
          try {
            const { error: uploadError } = await supabase.storage
              .from('photos')
              .upload(fileInfo.filePath, fileInfo.file)
              
            if (uploadError) {
              throw uploadError
            }
            
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('photos')
              .getPublicUrl(fileInfo.filePath)
            
            return publicUrl
          } catch (error) {
            if (retryCount < MAX_RETRIES) {
              // Longer delay before retry with exponential backoff
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)))
              return uploadFileWithRetry(fileInfo, retryCount + 1)
            }
            console.error('Upload failed after retries:', error)
            return null
          }
        }
        
        // Process uploads in smaller batches for better reliability
        for (let i = 0; i < fileInfos.length; i += STORAGE_BATCH_SIZE) {
          // Get current batch
          const currentBatch = fileInfos.slice(i, i + STORAGE_BATCH_SIZE)
          
          // Process batch in parallel
          const batchPromises = currentBatch.map(fileInfo => uploadFileWithRetry(fileInfo))
          const batchResults = await Promise.all(batchPromises)
          
          // Process results
          batchResults.forEach((url, index) => {
            if (url) {
              currentBatch[index].url = url
              currentBatch[index].processed = true
              allImageUrls.push({ url, originalIndex: currentBatch[index].originalIndex })
            }
          })
          
          // Update progress
          processedFiles += currentBatch.length
          setUploadProgress(Math.round((processedFiles / totalFiles) * 100))
          
          // Add a delay between batches to prevent overwhelming the server
          if (i + STORAGE_BATCH_SIZE < fileInfos.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        console.timeEnd('Storage Uploads')
        
        // 4. Process database updates in a single API call for new images
        console.time('Database Updates')
        if (allImageUrls.length > 0) {
          try {
            // Sort by original index to maintain upload order
            allImageUrls.sort((a, b) => a.originalIndex - b.originalIndex)
            
            console.log('Sorted image URLs for API call:', 
              allImageUrls.map(item => `${item.originalIndex}: ${item.url.substring(0, 30)}...`))
            
            // Send all new images in a single API call
            const response = await fetch(`/api/collections/${editCollectionId}/photos`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                images: allImageUrls.map(item => item.url),
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to add photos');
            }
            
            const result = await response.json();
            console.log(`Added ${result.addedCount} new photos to collection in a single operation`);
          } catch (error) {
            console.error('Failed to add new photos:', error);
            toast.error(`Error adding new photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        console.timeEnd('Database Updates')
        
        // 5. Calculate success metrics and update UI
        console.time('UI Updates')
        const successRate = (allImageUrls.length / totalFiles) * 100
        
        // Update the collection in state with the new photos
        setCollections(collections.map(c => {
          if (c.id === editCollectionId) {
            // Combine existing photos (that weren't deleted) with new photos
            const existingPhotosList = c.photos.filter(photo => 
              !photosToDelete.includes(photo.id)
            )
            
            const newPhotosList = allImageUrls.map(item => ({ 
              id: Math.random().toString(), 
              url: item.url 
            }))
            
            return { 
              ...updatedCollection, 
              photos: [...existingPhotosList, ...newPhotosList],
              hasWatermark: c.hasWatermark 
            }
          }
          return c
        }))
        
        // Reset state
        setIsEditDialogOpen(false)
        setSelectedFiles([])
        setPreviewImages([])
        setExistingPhotos([])
        setPhotosToDelete([])
        
        // Show appropriate success message based on results
        if (allImageUrls.length === 0) {
          toast.warning('Collection updated but no new images were uploaded')
        } else if (successRate < 100) {
          toast.success(`Collection updated with ${allImageUrls.length} of ${totalFiles} new images`)
        } else {
          toast.success('Collection updated successfully with all new images')
        }
        console.timeEnd('UI Updates')
      } else {
        // No new images to upload
        setIsEditDialogOpen(false)
        setSelectedFiles([])
        setPreviewImages([])
        setExistingPhotos([])
        setPhotosToDelete([])
        toast.success('Collection updated successfully')
      }
    } catch (error) {
      console.error('Error updating collection:', error)
      toast.error(`Failed to update collection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      clearTimeout(timeoutId)
      setIsEditing(false)
    }
  }

  const submitDeleteCollection = async () => {
    try {
      setIsDeleting(true)
      
      // Find the collection to get photo count for progress indication
      const collectionToDelete = collections.find(c => c.id === deleteCollectionId)
      const photoCount = collectionToDelete?.photos?.length || 0
      
      if (photoCount > 0) {
        setIsDeletingPhotos(true)
        setDeletingProgress(0)
        
        // Show progress indication based on estimated time
        // This is just a visual indicator as we can't track the actual server-side deletion progress
        const estimatedTimePerPhoto = 50 // milliseconds
        const totalEstimatedTime = photoCount * estimatedTimePerPhoto
        
        // Update progress every 100ms
        const interval = setInterval(() => {
          setDeletingProgress(prev => {
            const newProgress = prev + (100 / (totalEstimatedTime / 100))
            return newProgress > 95 ? 95 : newProgress // Cap at 95% until confirmed deleted
          })
        }, 100)
        
        // Add a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (isDeleting) {
            clearInterval(interval)
            setIsDeleting(false)
            setIsDeletingPhotos(false)
            toast.error('Delete operation timed out. Please try again.')
          }
        }, 60000) // 1 minute timeout
        
        // Clean up interval when component unmounts or when done
        setTimeout(() => {
          clearInterval(interval)
          clearTimeout(timeoutId)
        }, totalEstimatedTime)
      }
      
      const response = await fetch(`/api/collections/${deleteCollectionId}`, {
        method: 'DELETE',
      })
      
      // Clear any remaining intervals
      setDeletingProgress(100)
      setIsDeletingPhotos(false)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete collection')
      }
      
      setCollections(collections.filter(c => c.id !== deleteCollectionId))
      setIsDeleteDialogOpen(false)
      toast.success('Collection deleted successfully')
    } catch (error) {
      console.error('Error deleting collection:', error)
      toast.error(`Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
      setIsDeletingPhotos(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">All Collections</h1>
          <p className="text-gray-600 mt-1">Browse the best photo collections</p>
        </div>
        {!adminLoading && isAdmin && (
          <div className="flex gap-2">
            {selectMode && (
              <>
                <Button 
                  variant="outline" 
                  onClick={selectAllCollections}
                  className="text-sm"
                >
                  {selectedCollections.length === collections.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBatchDelete}
                  disabled={selectedCollections.length === 0}
                  className="text-sm"
                >
                  Delete Selected ({selectedCollections.length})
                </Button>
              </>
            )}
            <Button 
              variant={selectMode ? "secondary" : "outline"} 
              onClick={toggleSelectMode}
              className="text-sm"
            >
              <CheckSquare className="mr-2 h-4 w-4" /> {selectMode ? 'Cancel' : 'Select Multiple'}
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Collection
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg">Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="mb-4">
            <FolderPlus className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">No collections yet</h2>
          <p className="text-gray-500 mb-6">Create your first collection to start organizing your photos</p>
          {!adminLoading && isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Collection
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {collections.map(collection => (
            <Card 
              key={collection.id} 
              className={`h-full overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 ${
                selectedCollections.includes(collection.id) 
                  ? 'border-primary' 
                  : 'hover:border-primary/50'
              }`}
            >
              {!adminLoading && isAdmin && selectMode && (
                <div 
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => toggleCollectionSelection(collection.id, e)}
                >
                  <Checkbox 
                    checked={selectedCollections.includes(collection.id)}
                    className="h-5 w-5 border-2 border-white bg-white/80"
                  />
                </div>
              )}
              <Link 
                href={`/collections/${collection.id}`} 
                className="block h-full"
                onClick={(e) => {
                  if (selectMode) {
                    e.preventDefault()
                    toggleCollectionSelection(collection.id, e)
                  }
                }}
              >
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  <CollectionThumbnail collection={collection} />
                  {collection.hasWatermark && (
                    <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
                      Watermarked
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-lg mb-1 truncate">{collection.name}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 h-10">
                      {collection.description || 'No description'}
                    </p>
                  </div>
                  {!adminLoading && isAdmin && !selectMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                          e.preventDefault();
                          handleEditCollection(collection);
                        }}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive" 
                          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                            e.preventDefault();
                            handleDeleteCollection(collection.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {new Date(collection.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {collection.photos.length} {collection.photos.length === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Collection Dialog */}
      {isAdmin && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateCollection} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collectionName">Name</Label>
              <Input 
                id="collectionName" 
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Enter collection name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="collectionDescription">Description (optional)</Label>
              <Textarea 
                id="collectionDescription" 
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                placeholder="Enter a description for your collection"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="collectionImages">Upload Images</Label>
              <Input
                id="collectionImages"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="mb-2"
                disabled={isCreating}
              />
              
              {/* Image count indicator */}
              <div className="flex justify-between text-sm text-gray-500">
                <span><span className="font-medium">{selectedFiles.length}</span> of 50 images selected</span>
                {selectedFiles.length > 0 && (
                  <Button 
                    type="button" 
                    onClick={() => {
                      setSelectedFiles([]);
                      setPreviewImages([]);
                    }}
                    className="text-white"
                  >
                    Clear all
                  </Button>
                )}
              </div>
              
              {/* Image previews */}
              {previewImages.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Images to Add</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {previewImages
                      .sort((a, b) => a.originalIndex - b.originalIndex)
                      .map((image) => (
                      <div key={image.id} className="relative group">
                        <div className="h-24 w-24 rounded-md overflow-hidden relative">
                          <Image
                            src={image.preview}
                            alt="Preview"
                            className="h-full w-full object-cover"
                            width={100}
                            height={100}
                          />
                          {isImageLoading[image.id] && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isCreating}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {uploadProgress > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1 text-xs">
                    <span>Uploading images...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setSelectedFiles([]);
                  setPreviewImages([]);
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newCollectionName.trim()}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create Collection'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* Edit Collection Dialog */}
      {isAdmin && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Collection</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={submitEditCollection} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editCollectionName">Name</Label>
                <Input 
                  id="editCollectionName" 
                  value={editCollectionName}
                  onChange={(e) => setEditCollectionName(e.target.value)}
                  placeholder="Enter collection name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editCollectionDescription">Description (optional)</Label>
                <Textarea 
                  id="editCollectionDescription" 
                  value={editCollectionDescription}
                  onChange={(e) => setEditCollectionDescription(e.target.value)}
                  placeholder="Enter a description for your collection"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editCollectionImages">Manage Images</Label>
                <Input
                  id="editCollectionImages"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="mb-2"
                  disabled={isEditing}
                />
                
                {/* Image count indicator */}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>
                    <span className="font-medium">{selectedFiles.length}</span> of 50 new images selected
                    {existingPhotos.length > 0 && ` (${existingPhotos.length} existing)`}
                  </span>
                  {selectedFiles.length > 0 && (
                    <Button 
                      type="button" 
                      onClick={() => {
                        setSelectedFiles([]);
                        setPreviewImages([]);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      Clear new images
                    </Button>
                  )}
                </div>
                
                {/* Existing Photos */}
                {existingPhotos.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">Existing Photos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {existingPhotos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <div className="h-24 w-24 rounded-md overflow-hidden">
                            <Image
                              src={photo.url}
                              alt="Collection photo"
                              className="h-full w-full object-cover"
                              width={100}
                              height={100}
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeExistingPhoto(photo.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* New Image previews */}
                {previewImages.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">New Photos to Add</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {previewImages
                        .sort((a, b) => a.originalIndex - b.originalIndex)
                        .map((image) => (
                        <div key={image.id} className="relative group">
                          <div className="h-24 w-24 rounded-md overflow-hidden relative">
                            <Image
                              src={image.preview}
                              alt="Preview"
                              className="h-full w-full object-cover"
                              width={100}
                              height={100}
                            />
                            {isImageLoading[image.id] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeImage(image.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadProgress > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between mb-1 text-xs">
                      <span>Uploading images...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedFiles([]);
                    setPreviewImages([]);
                    setExistingPhotos([]);
                    setPhotosToDelete([]);
                  }}
                  disabled={isEditing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing || !editCollectionName.trim()}>
                  {isEditing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    'Update Collection'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Collection Dialog */}
      {isAdmin && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Collection</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <p className="mb-4">Are you sure you want to delete this collection? This action cannot be undone.</p>
              
              {isDeletingPhotos && (
                <div className="mt-4 mb-4">
                  <div className="flex justify-between mb-1 text-xs">
                    <span>Deleting images from storage...</span>
                    <span>{Math.round(deletingProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${deletingProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={submitDeleteCollection}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                    </>
                  ) : (
                    'Delete Collection'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Batch Delete Dialog */}
      {isAdmin && (
        <Dialog open={isBatchDeleteDialogOpen} onOpenChange={setIsBatchDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Multiple Collections</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <p className="mb-4">
                Are you sure you want to delete {selectedCollections.length} selected collections? 
                This action cannot be undone and will delete all photos within these collections.
              </p>
              
              {isBatchDeleting && (
                <div className="mt-4 mb-4">
                  <div className="flex justify-between mb-1 text-xs">
                    <span>Deleting collections...</span>
                    <span>{Math.round(deletingProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${deletingProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBatchDeleteDialogOpen(false)}
                  disabled={isBatchDeleting}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={submitBatchDeleteCollections}
                  disabled={isBatchDeleting}
                >
                  {isBatchDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                    </>
                  ) : (
                    `Delete ${selectedCollections.length} Collections`
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default CollectionsPage 