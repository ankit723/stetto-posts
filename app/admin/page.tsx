'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Edit, Save, X, Loader2 } from 'lucide-react'
import { isUserAdmin } from '../auth/actions'
import { redirect, useRouter } from 'next/navigation'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'


interface Photo {
  id: string
  url: string
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

interface PreviewImage {
  id: string
  file: File
  preview: string
}

const AdminPage = () => {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentCollection, setCurrentCollection] = useState<Collection | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([])
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeletingCollection, setIsDeletingCollection] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState<{[key: string]: boolean}>({})
  const router = useRouter()

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

  // Helper function for showing alerts (replace with a proper toast system later)
  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') {
      toast .error(message)
    } else {
      toast.success(message)
    }
  };

  // Fetch collections
  const fetchCollections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/collections')
      const data = await response.json()
      setCollections(data)
    } catch (error) {
      console.error('Error fetching collections:', error)
      showAlert('Failed to load collections. Please refresh the page.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchCollections()
    }
  }, [isAdmin])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
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

  const handleCreateCollection = async () => {
    if (!formData.name || !formData.description) {
      showAlert('Please fill all required fields', 'error')
      return
    }

    try {
      setIsSubmitting(true)
      setUploadProgress(0)
      // First upload images to Supabase storage
      const imageUrls: string[] = []
      
      // Upload each image
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `collections/${fileName}`
        
        const { error: uploadError, data } = await supabase.storage
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
      
      // Create collection with images
      const payload = {
        ...formData,
        images: imageUrls,
      }
      
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create collection')
      }
      
      showAlert('Collection created successfully', 'success')
      
      setFormData({ name: '', description: '' })
      setSelectedFiles([])
      setPreviewImages([])
      setIsModalOpen(false)
      fetchCollections()
    } catch (error) {
      console.error('Error creating collection:', error)
      showAlert('Failed to create collection. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collection?')) {
      return
    }
    
    try {
      setIsDeletingCollection(id)
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete collection')
      }
      
      showAlert('Collection deleted successfully', 'success')
      
      fetchCollections()
    } catch (error) {
      console.error('Error deleting collection:', error)
      showAlert('Failed to delete collection. Please try again.', 'error')
    } finally {
      setIsDeletingCollection(null)
    }
  }

  const handleEditCollection = (collection: Collection) => {
    openEditModal(collection);
  }

  const removeExistingPhoto = (photoId: string) => {
    setExistingPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    setPhotosToDelete((prev) => [...prev, photoId])
  }

  const handleUpdateCollection = async () => {
    if (!formData.name || !formData.description || !currentCollection) {
      showAlert('Please fill all required fields', 'error')
      return
    }
    
    try {
      setIsSubmitting(true)
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
        ...formData,
        newImages: imageUrls,
        existingPhotos: existingPhotos.map(photo => photo.id),
        photosToDelete
      }
      
      const response = await fetch(`/api/collections/${currentCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update collection')
      }
      
      showAlert('Collection updated successfully', 'success')
      
      setFormData({ name: '', description: '' })
      setCurrentCollection(null)
      setIsModalOpen(false)
      setSelectedFiles([])
      setPreviewImages([])
      setExistingPhotos([])
      setPhotosToDelete([])
      fetchCollections()
    } catch (error) {
      console.error('Error updating collection:', error)
      toast.error('Failed to update collection. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancelForm = () => {
    setFormData({ name: '', description: '' })
    setSelectedFiles([])
    setPreviewImages([])
    setExistingPhotos([])
    setPhotosToDelete([])
    setIsCreating(false)
    setIsEditing(false)
    setCurrentCollection(null)
  }

  const openCreateModal = () => {
    setIsCreating(true)
    setIsEditing(false)
    setCurrentCollection(null)
    setFormData({ name: '', description: '' })
    setSelectedFiles([])
    setPreviewImages([])
    setExistingPhotos([])
    setPhotosToDelete([])
    setIsModalOpen(true)
  }

  const openEditModal = (collection: Collection) => {
    setCurrentCollection(collection)
    setFormData({
      name: collection.name,
      description: collection.description,
    })
    setExistingPhotos(collection.photos || [])
    setIsEditing(true)
    setIsCreating(false)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setTimeout(() => {
      cancelForm()
    }, 300)
  }

  const getCollectionThumbnail = (collection: Collection): string => {
    if (collection.photos && collection.photos.length > 0) {
      return collection.photos[0].url
    }
    return '/placeholder-image.svg' // SVG placeholder image
  }

  const handleCollectionClick = (id: string) => {
    router.push(`/collections/${id}`)
  }

  if (adminLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Checking permissions...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-2xl mt-4 font-semibold">Page Not Found</p>
        <p className="text-center max-w-md mt-2 text-gray-500">
          Sorry, but the page you are looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block bg-primary text-white px-6 py-2 rounded-lg shadow hover:bg-primary/80 transition"
        >
          Go to Home
        </Link>
      </div>
    );
  }
  

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Collection Management</h1>
        <Button onClick={openCreateModal} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" /> New Collection
        </Button>
      </div>

      {/* Collections List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p>Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Image src="/placeholder-image.svg" alt="No collections" width={100} height={100} className="h-12 w-12 mx-auto text-gray-400 mb-2" />
          <p className="text-lg text-gray-600">No collections found</p>
          <p className="text-sm text-gray-500 mb-4">Create your first collection to get started</p>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" /> New Collection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Card key={collection.id} className="overflow-hidden" onClick={() => handleCollectionClick(collection.id)}>
              <div className="aspect-video relative overflow-hidden">
                {collection.photos && collection.photos.length > 0 ? (
                  <Image 
                    src={getCollectionThumbnail(collection) || '/placeholder-image.svg'} 
                    width={100}
                    height={100}
                    alt={collection.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <Image src="/placeholder-image.svg" alt="No collection photos" width={100} height={100} className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {collection.photos?.length || 0} photos
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold">{collection.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleEditCollection(collection)}
                    disabled={isDeletingCollection === collection.id}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-red-500 hover:bg-red-50" 
                    onClick={() => handleDeleteCollection(collection.id)}
                    disabled={isDeletingCollection === collection.id}
                  >
                    {isDeletingCollection === collection.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CRUD Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!isSubmitting) setIsModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'Create New Collection' : 'Edit Collection'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Collection name"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Collection description"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Photo Management Section */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {isCreating ? 'Upload Images' : 'Manage Photos'}
              </label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="mb-2"
                disabled={isSubmitting}
              />
              
              {/* Existing Photos (Edit mode) */}
              {isEditing && existingPhotos.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Existing Photos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {existingPhotos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <Image
                          src={photo.url}
                          alt="Collection photo"
                          className="h-24 w-24 object-cover rounded-md"
                          width={100}
                          height={100}
                        />
                        <Button
                          type="button"
                          onClick={() => removeExistingPhoto(photo.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isSubmitting}
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
                        <Button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isSubmitting || isImageLoading[image.id]}
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
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </Button>
            {isCreating ? (
              <Button onClick={handleCreateCollection} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Create Collection
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleUpdateCollection} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Update Collection
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminPage