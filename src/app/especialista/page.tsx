import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import EspecialistaPanel from '@/components/especialista/EspecialistaPanel'

export const dynamic = 'force-dynamic'

export default async function EspecialistaDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/especialista/login')

  // Bloquear acceso si es admin — debe usar /admin
  if (user.user_metadata?.rol === 'admin') redirect('/admin')

  // Verificar que la especialista sigue activa en la BD
  const especialistaId = user.user_metadata?.especialista_id as string | undefined
  if (especialistaId) {
    const adminClient = await createAdminClient()
    const { data: esp } = await adminClient
      .from('especialistas')
      .select('activo')
      .eq('id', especialistaId)
      .maybeSingle()

    // Si fue desactivada, mostrar mensaje en lugar del panel
    if (!esp || esp.activo === false) {
      return (
        <div className="min-h-screen bg-beauty-bg flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-card p-8 max-w-sm w-full text-center space-y-4">
            <div className="text-5xl">🔴</div>
            <h1 className="text-xl font-bold text-beauty-text">Cuenta desactivada</h1>
            <p className="text-beauty-text-muted text-sm">
              Tu cuenta de especialista ha sido desactivada.<br />
              Contacta al administrador para más información.
            </p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>
      )
    }
  }

  return (
    <EspecialistaPanel
      userEmail={user.email ?? ''}
      userName={user.user_metadata?.nombre ?? ''}
      especialistaId={especialistaId}
    />
  )
}
