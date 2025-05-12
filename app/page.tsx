import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin } from './auth/actions'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = await isUserAdmin()

  if (!user) {
    redirect('/auth/login')
  } else if (isAdmin) {
    redirect('/admin')
  } else {
    redirect('/account')
  }
}