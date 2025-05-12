'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, FolderPlus, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/utils/supabase/client'
import { isUserAdmin } from '../auth/actions'
import Image from 'next/image'
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

const CollectionsPage = () => {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)

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

  const handleCreateCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!newCollectionName.trim()) {
      toast.error('Please enter a name for the collection')
      return
    }
    
    try {
      setIsCreating(true)
      
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCollectionName,
          description: newCollectionDescription,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create collection')
      }
      
      const newCollection = await response.json()
      
      setCollections([...collections, { ...newCollection, photos: [], hasWatermark: false }])
      setIsAddDialogOpen(false)
      setNewCollectionName('')
      setNewCollectionDescription('')
      toast.success('Collection created successfully')
    } catch (error) {
      console.error('Error creating collection:', error)
      toast.error('Failed to create collection. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Collections</h1>
          <p className="text-gray-600 mt-1">Browse and manage your photo collections</p>
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
            <Link key={collection.id} href={`/collections/${collection.id}`}>
              <Card className="h-full overflow-hidden hover:shadow-md transition-shadow duration-300 cursor-pointer">
                <div className="aspect-video bg-gray-100 relative">
                  {collection.photos.length > 0 ? (
                    <Image
                      src={collection.photos[0].url} 
                      alt={collection.name}
                      className="w-full h-full object-cover"
                      width={100}
                      height={100}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                  {collection.hasWatermark && (
                    <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
                      Watermarked
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium text-lg mb-1 truncate">{collection.name}</h3>
                  <p className="text-gray-500 text-sm line-clamp-2 h-10">
                    {collection.description || 'No description'}
                  </p>
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
            </Link>
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
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
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
    </div>
  )
}

export default CollectionsPage 