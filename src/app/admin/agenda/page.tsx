'use client'

import dynamic from 'next/dynamic'

const AgendaView = dynamic(() => import('@/components/admin/AgendaView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-beauty-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Cargando agenda...</p>
      </div>
    </div>
  ),
})

export default function AgendaPage() {
  return <AgendaView />
}
