import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EspecialistaPanel from '@/components/especialista/EspecialistaPanel'

export const dynamic = 'force-dynamic'

export default async function EspecialistaDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/especialista/login')

  // Bloquear acceso si es admin — debe usar /admin
  if (user.user_metadata?.rol === 'admin') redirect('/admin')

  return (
    <EspecialistaPanel
      userEmail={user.email ?? ''}
      userName={user.user_metadata?.nombre ?? ''}
      especialistaId={user.user_metadata?.especialista_id ?? undefined}
    />
  )
}
