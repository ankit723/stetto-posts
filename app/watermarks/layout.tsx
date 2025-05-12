import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'Watermarks | Photo Watermark',
  description: 'Manage your watermarks for your photo collections',
}

export default async function WatermarksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated
  const supabase = createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login?next=/watermarks')
  }
  
  return (
    <div>
      {children}
    </div>
  )
} 