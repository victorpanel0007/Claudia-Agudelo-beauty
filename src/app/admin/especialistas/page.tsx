'use client'

import dynamic from 'next/dynamic'

const EspecialistasView = dynamic(() => import('@/components/admin/EspecialistasView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-beauty-gold border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  ),
})

export default function EspecialistasPage() {
  return <EspecialistasView />
}
