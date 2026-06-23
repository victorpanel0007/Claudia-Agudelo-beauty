import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EspecialistaPanel from '@/components/especialista/EspecialistaPanel'

export default async function EspecialistaDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/especialista/login')

  return <EspecialistaPanel userEmail={user.email ?? ''} userName={user.user_metadata?.nombre ?? ''} />
}
