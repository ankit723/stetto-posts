'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import Image from 'next/image'

interface Watermark {
  id: string
  url: string
  createdAt: string
  isWatermark: boolean
}

const WatermarksPage = () => {
  const [watermarks, setWatermarks] = useState<Watermark[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newWatermarkName, setNewWatermarkName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchWatermarks()
  }, [])

  const fetchWatermarks = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB')
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleAddWatermark = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }
    
    if (!newWatermarkName.trim()) {
      toast.error('Please enter a name for the watermark')
      return
    }
    
    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', newWatermarkName)
      
      const response = await fetch('/api/watermarks', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload watermark')
      }
      
      const newWatermark = await response.json()
      
      setWatermarks([newWatermark, ...watermarks])
      setIsAddDialogOpen(false)
      setNewWatermarkName('')
      setSelectedFile(null)
      toast.success('Watermark added successfully')
    } catch (error) {
      console.error('Error adding watermark:', error)
      toast.error('Failed to add watermark. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteWatermark = async (id: string) => {
    try {
      setDeletingId(id)
      
      const response = await fetch(`/api/watermarks/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete watermark')
      }
      
      setWatermarks(watermarks.filter(watermark => watermark.id !== id))
      toast.success('Watermark deleted successfully')
    } catch (error) {
      console.error('Error deleting watermark:', error)
      toast.error('Failed to delete watermark. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Watermarks</h1>
          <p className="text-gray-600 mt-1">Manage your watermarks for your photo collections</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Watermark
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg">Loading watermarks...</p>
        </div>
      ) : watermarks.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="mb-4">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">No watermarks yet</h2>
          <p className="text-gray-500 mb-6">Add your first watermark to start protecting your photos</p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Watermark
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {watermarks.map(watermark => (
            <Card key={watermark.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center p-4">
                <Image 
                  src={watermark.url} 
                  alt={`Watermark ${watermark.id}`}
                  className="max-w-full max-h-full object-contain"
                  width={100}
                  height={100}
                />
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium truncate">Watermark {watermark.id.substring(0, 8)}</h3>
                    <p className="text-xs text-gray-500">
                      {new Date(watermark.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteWatermark(watermark.id)}
                    disabled={deletingId === watermark.id}
                  >
                    {deletingId === watermark.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Watermark Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Watermark</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddWatermark} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="watermarkName">Name</Label>
              <Input 
                id="watermarkName" 
                value={newWatermarkName}
                onChange={(e) => setNewWatermarkName(e.target.value)}
                placeholder="Enter watermark name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="watermarkFile">Watermark Image</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center">
                      <Image 
                        src={URL.createObjectURL(selectedFile)} 
                        alt="Preview" 
                        className="max-h-40 max-w-full object-contain"
                        width={100}
                        height={100}
                      />
                    </div>
                    <p className="text-sm text-gray-500">{selectedFile.name}</p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      Click to upload or drag and drop<br />
                      PNG or JPG (max 5MB)
                    </p>
                    <Input 
                      id="watermarkFile" 
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => document.getElementById('watermarkFile')?.click()}
                    >
                      Select File
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading || !selectedFile}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  'Add Watermark'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WatermarksPage 