import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'Collections | Photo Watermark',
  description: 'Browse and manage your photo collections',
}

export default async function CollectionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated
  const supabase = createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login?next=/collections')
  }
  
  return (
    <div>
      {children}
    </div>
  )
} 