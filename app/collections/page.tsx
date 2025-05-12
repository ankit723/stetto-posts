'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, FolderPlus, Image as ImageIcon, Edit, Trash2, MoreVertical, Upload, X } from 'lucide-react'
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

  const supabase = createClient()

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    
    const files = Array.from(e.target.files)
    setSelectedFiles((prevFiles) => [...prevFiles, ...files])
    
    // Create preview URLs with loading state
    const newPreviews = files.map((file) => {
      const id = Math.random().toString(36).substring(2)
      // Set loading state for this image
      setIsImageLoading(prev => ({...prev, [id]: true}))
      
      const preview = URL.createObjectURL(file)
      
      // Create an image object to detect when it's loaded
      const imgElement = document.createElement('img')
      imgElement.onload = () => {
        setIsImageLoading(prev => ({...prev, [id]: false}))
      }
      imgElement.src = preview
      
      return {
        id,
        file,
        preview,
      }
    })
    
    setPreviewImages((prevPreviews) => [...prevPreviews, ...newPreviews])
  }

  const removeImage = (id: string) => {
    setPreviewImages((prevPreviews) => prevPreviews.filter((image) => image.id !== id))
    // Also remove from selectedFiles
    const imageToRemove = previewImages.find((image) => image.id === id)
    if (imageToRemove) {
      setSelectedFiles((prevFiles) => 
        prevFiles.filter((file) => file !== imageToRemove.file)
      )
    }
  }

  const removeExistingPhoto = (photoId: string) => {
    setExistingPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    setPhotosToDelete((prev) => [...prev, photoId])
  }

  const handleCreateCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!newCollectionName.trim()) {
      toast.error('Please enter a name for the collection')
      return
    }
    
    try {
      setIsCreating(true)
      setUploadProgress(0)
      
      // First upload images to Supabase storage
      const imageUrls: string[] = []
      
      // Upload each image
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `collections/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file)
          
        if (uploadError) {
          throw uploadError
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath)
          
        imageUrls.push(publicUrl)
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
      }
      
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCollectionName,
          description: newCollectionDescription,
          images: imageUrls,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create collection')
      }
      
      const newCollection = await response.json()
      
      setCollections([...collections, { ...newCollection, hasWatermark: false }])
      setIsAddDialogOpen(false)
      setNewCollectionName('')
      setNewCollectionDescription('')
      setSelectedFiles([])
      setPreviewImages([])
      toast.success('Collection created successfully')
    } catch (error) {
      console.error('Error creating collection:', error)
      toast.error('Failed to create collection. Please try again.')
    } finally {
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

  const submitEditCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!editCollectionName.trim()) {
      toast.error('Please enter a name for the collection')
      return
    }
    
    try {
      setIsEditing(true)
      setUploadProgress(0)
      
      // Upload new images if any
      const imageUrls: string[] = []
      
      // Upload each new image
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `collections/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file)
          
        if (uploadError) {
          throw uploadError
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath)
          
        imageUrls.push(publicUrl)
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
      }
      
      const payload = {
        name: editCollectionName,
        description: editCollectionDescription,
        newImages: imageUrls,
        existingPhotos: existingPhotos.map(photo => photo.id),
        photosToDelete
      }
      
      const response = await fetch(`/api/collections/${editCollectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update collection')
      }
      
      // Fetch the updated collection
      const updatedCollection = await response.json()
      
      setCollections(collections.map(c => 
        c.id === editCollectionId ? { ...updatedCollection, hasWatermark: c.hasWatermark } : c
      ))
      
      // Reset state
      setIsEditDialogOpen(false)
      setSelectedFiles([])
      setPreviewImages([])
      setExistingPhotos([])
      setPhotosToDelete([])
      toast.success('Collection updated successfully')
    } catch (error) {
      console.error('Error updating collection:', error)
      toast.error('Failed to update collection. Please try again.')
    } finally {
      setIsEditing(false)
    }
  }

  const submitDeleteCollection = async () => {
    try {
      setIsDeleting(true)
      
      const response = await fetch(`/api/collections/${deleteCollectionId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete collection')
      }
      
      setCollections(collections.filter(c => c.id !== deleteCollectionId))
      setIsDeleteDialogOpen(false)
      toast.success('Collection deleted successfully')
    } catch (error) {
      console.error('Error deleting collection:', error)
      toast.error('Failed to delete collection. Please try again.')
    } finally {
      setIsDeleting(false)
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
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Collection
          </Button>
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
              className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 hover:border-primary/50"
            >
              <Link href={`/collections/${collection.id}`} className="block h-full">
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
                  {!adminLoading && isAdmin && (
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
              
              {/* Image previews */}
              {previewImages.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Images to Add</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {previewImages.map((image) => (
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
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isCreating}
                        >
                          <X className="h-4 w-4" />
                        </button>
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
                          <button
                            type="button"
                            onClick={() => removeExistingPhoto(photo.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isEditing}
                          >
                            <X className="h-4 w-4" />
                          </button>
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
                      {previewImages.map((image) => (
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
                          <button
                            type="button"
                            onClick={() => removeImage(image.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isEditing}
                          >
                            <X className="h-4 w-4" />
                          </button>
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
    </div>
  )
}

export default CollectionsPage 