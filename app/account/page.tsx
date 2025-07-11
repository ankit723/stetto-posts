'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { logout } from '@/app/auth/actions'
import WatermarkedCollections from '@/components/account/WatermarkedCollections'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, User, Settings, Folder, Image as ImageIcon } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  user_metadata?: {
    first_name?: string
    last_name?: string
  }
}

export default function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const router = useRouter()
  const supabase = createClient()

  const getUser = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        router.push('/auth/login')
        return
      }
      
      setUser(user as UserProfile)
    } catch (error) {
      console.error('Error fetching user:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router, supabase.auth])

  useEffect(() => {
    getUser()
  }, [getUser])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userDisplayName = user.user_metadata?.first_name && user.user_metadata?.last_name 
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    : user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Account Settings</h1>
                <p className="text-muted-foreground">Welcome back, {userDisplayName}</p>
              </div>
            </div>
            <form action={logout as any} className="mt-4 sm:mt-0">
              <Button 
                type="submit"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                      activeTab === 'profile' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('watermarked')}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                      activeTab === 'watermarked' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>Watermarked</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('collections')}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                      activeTab === 'collections' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Folder className="h-4 w-4" />
                    <span>Collections</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('preferences')}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                      activeTab === 'preferences' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Preferences</span>
                  </button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-4">Profile Information</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                            <p className="mt-1 text-lg font-medium">{user.email}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                            <p className="mt-1 text-lg font-medium">{userDisplayName}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">First Name</label>
                            <p className="mt-1 text-lg font-medium">
                              {user.user_metadata?.first_name || 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                            <p className="mt-1 text-lg font-medium">
                              {user.user_metadata?.last_name || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Watermarked Collections Tab - Lazy loaded */}
                {activeTab === 'watermarked' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Watermarked Collections</h2>
                      <p className="text-muted-foreground mb-6">
                        View all collections you've applied watermarks to.
                      </p>
                    </div>
                    <WatermarkedCollections />
                  </div>
                )}

                {/* Collections Tab */}
                {activeTab === 'collections' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Your Collections</h2>
                      <p className="text-muted-foreground mb-6">
                        Manage all collections you've created.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Link href="/collections">
                        <Button className="w-full sm:w-auto">
                          <Folder className="mr-2 h-4 w-4" />
                          View All Collections
                        </Button>
                      </Link>
                      <Link href="/collections" state={{ openCreateDialog: true }}>
                        <Button variant="outline" className="w-full sm:w-auto">
                          Create New Collection
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Preferences Tab */}
                {activeTab === 'preferences' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Preferences</h2>
                      <p className="text-muted-foreground mb-6">
                        Customize your experience and manage your watermarks.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Link href="/watermarks">
                          <Button variant="outline" className="w-full sm:w-auto">
                            <ImageIcon className="mr-2 h-4 w-4" />
                            Manage Watermarks
                          </Button>
                        </Link>
                      </div>
                      
                      <div className="pt-6 border-t">
                        <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Card className="p-4">
                            <h4 className="font-medium mb-2">Download Speed</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              Optimized for fast processing with parallel downloads
                            </p>
                            <div className="text-xs text-green-600 font-medium">
                              ✓ 70-80% faster downloads enabled
                            </div>
                          </Card>
                          <Card className="p-4">
                            <h4 className="font-medium mb-2">Storage Usage</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              Your uploaded photos and watermarks
                            </p>
                            <Link href="/collections">
                              <Button size="sm" variant="outline">View Storage</Button>
                            </Link>
                          </Card>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 