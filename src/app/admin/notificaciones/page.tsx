import NotificacionesView from '@/components/admin/NotificacionesView'
import RecordatoriosConfig from '@/components/admin/RecordatoriosConfig'

export const metadata = { title: 'Notificaciones — Admin' }

export default function NotificacionesPage() {
  return (
    <div className="space-y-8">
      <RecordatoriosConfig />
      <NotificacionesView />
    </div>
  )
}
