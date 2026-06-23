import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeader from '@/components/admin/AdminHeader'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Panel Admin — Claudia Agudelo Beauty',
  robots: 'noindex',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar userEmail={user.email ?? ''} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader userEmail={user.email ?? ''} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
