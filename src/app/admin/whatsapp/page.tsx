'use client'

import dynamic from 'next/dynamic'

const WhatsAppAdminView = dynamic(() => import('@/components/admin/WhatsAppAdminView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-beauty-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Cargando panel WhatsApp...</p>
      </div>
    </div>
  ),
})

export default function WhatsAppAdminPage() {
  return <WhatsAppAdminView />
}
