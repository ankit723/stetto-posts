'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { logout } from '@/app/auth/actions'
import WatermarkedCollections from '@/components/account/WatermarkedCollections'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      
      if (!user) {
        router.push('/auth/login')
      }
    }
    
    getUser()
  }, [router, supabase.auth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card text-card-foreground overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage your account settings and preferences.</p>
            </div>
            <form action={logout as any}>
              <button 
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="border-t border-border px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h3 className="text-lg font-medium">Profile Information</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                    <p className="mt-1 text-sm">{user.email}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
                    <p className="mt-1 text-sm">
                      {user.user_metadata?.first_name || ''} {user.user_metadata?.last_name || ''}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-border pt-6">
                <Tabs defaultValue="watermarked">
                  <TabsList className="mb-6">
                    <TabsTrigger value="watermarked">Watermarked Collections</TabsTrigger>
                    <TabsTrigger value="collections">My Collections</TabsTrigger>
                    <TabsTrigger value="photos">My Photos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="watermarked" className="mt-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Your Watermarked Collections</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        View all collections you&apos;ve applied watermarks to.
                      </p>
                    </div>
                    <WatermarkedCollections />
                  </TabsContent>
                  <TabsContent value="collections">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Your Collections</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        View all collections you&apos;ve created.
                      </p>
                    </div>
                    <div className="mt-6">
                      <Link
                        href="/collections"
                        className="inline-flex items-center px-4 py-2 border border-input shadow-sm text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      >
                        View Collections
                      </Link>
                    </div>
                  </TabsContent>
                  <TabsContent value="photos">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Your Photos</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Manage your uploaded photos and watermarks.
                      </p>
                    </div>
                    <div className="mt-6">
                      <a
                        href="/watermarks"
                        className="inline-flex items-center px-4 py-2 border border-input shadow-sm text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      >
                        View Photos
                      </a>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 