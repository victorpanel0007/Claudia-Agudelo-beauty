'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  BarChart3,
  MessageSquare,
  UserCheck,
  Menu,
  X,
  LogOut,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/admin/agenda', icon: Calendar, label: 'Agenda' },
  { href: '/admin/clientes', icon: Users, label: 'Clientes' },
  { href: '/admin/servicios', icon: Scissors, label: 'Servicios' },
  { href: '/admin/especialistas', icon: UserCheck, label: 'Especialistas' },
  { href: '/admin/whatsapp', icon: MessageSquare, label: 'WhatsApp Bot' },
  { href: '/admin/reportes', icon: BarChart3, label: 'Reportes' },
]

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(item: (typeof navItems)[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-beauty-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-beauty-rosa-claro border border-beauty-primary/30 flex items-center justify-center shrink-0">
            <span className="text-lg">🌸</span>
          </div>
          <div>
            <p className="font-serif text-beauty-borgona font-bold text-sm leading-tight">
              Claudia Agudelo
            </p>
            <p className="text-beauty-text-muted text-xs tracking-widest uppercase">Beauty • Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive(item)
                ? 'bg-beauty-primary text-white shadow-beauty'
                : 'text-beauty-text hover:bg-beauty-rosa-claro/40 hover:text-beauty-borgona'
            )}
          >
            <item.icon size={18} />
            {item.label}
            {item.href === '/admin/whatsapp' && (
              <span className="ml-auto bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                BOT
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* User + footer */}
      <div className="p-3 border-t border-beauty-primary/20 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-beauty-bg mb-1">
          <div className="w-8 h-8 rounded-full bg-beauty-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-beauty-text truncate">{userEmail}</p>
            <p className="text-[10px] text-beauty-text-muted">Administrador</p>
          </div>
        </div>

        <Link href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-beauty-text-muted hover:bg-beauty-rosa-claro/40 transition-colors">
          <Globe size={16} />
          Ver sitio web
        </Link>

        <button onClick={handleSignOut} disabled={signingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
          <LogOut size={16} />
          {signingOut ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-beauty-primary/20 min-h-screen sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-beauty-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-beauty"
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col shadow-2xl h-full">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
