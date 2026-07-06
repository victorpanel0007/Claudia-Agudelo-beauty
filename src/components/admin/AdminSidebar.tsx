'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Users, Scissors,
  BarChart3, MessageSquare, UserCheck, Menu, X,
  LogOut, Globe, Bell, DollarSign, Images,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin',                icon: LayoutDashboard, label: 'Dashboard',   exact: true },
  { href: '/admin/agenda',         icon: Calendar,        label: 'Agenda' },
  { href: '/admin/clientes',       icon: Users,           label: 'Clientes' },
  { href: '/admin/servicios',      icon: Scissors,        label: 'Servicios' },
  { href: '/admin/especialistas',  icon: UserCheck,       label: 'Especialistas' },
  { href: '/admin/notificaciones', icon: Bell,            label: 'Notificaciones' },
  { href: '/admin/comisiones',     icon: DollarSign,      label: 'Comisiones' },
  { href: '/admin/whatsapp',       icon: MessageSquare,   label: 'WhatsApp' },
  { href: '/admin/galeria',        icon: Images,          label: 'Galería' },
  { href: '/admin/reportes',       icon: BarChart3,       label: 'Reportes' },
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

  // Bottom 5 items shown in mobile bottom nav (most used)
  const bottomNavItems = [
    { href: '/admin',        icon: LayoutDashboard, label: 'Inicio', exact: true },
    { href: '/admin/agenda', icon: Calendar,        label: 'Agenda' },
    { href: '/admin/clientes', icon: Users,         label: 'Clientes' },
    { href: '/admin/comisiones', icon: DollarSign,  label: 'Comisiones' },
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-beauty-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-beauty-rosa-claro border border-beauty-primary/30 flex items-center justify-center shrink-0">
            <span className="text-lg">🌸</span>
          </div>
          <div>
            <p className="font-serif text-beauty-borgona font-bold text-sm leading-tight">Claudia Agudelo</p>
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
              'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
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
            <span className="text-white font-bold text-xs">{userEmail.charAt(0).toUpperCase()}</span>
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
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-beauty-primary/20 min-h-screen sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* ── Mobile: top-left hamburger ──────────────────────────────── */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 bg-beauty-primary text-white w-11 h-11 rounded-xl flex items-center justify-center shadow-beauty"
        aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ── Mobile: bottom navigation bar ──────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-beauty-primary/20 safe-bottom shadow-[0_-2px_16px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch">
          {bottomNavItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-medium transition-colors min-h-[56px]',
                isActive(item)
                  ? 'text-beauty-primary'
                  : 'text-gray-400 hover:text-beauty-borgona'
              )}
            >
              <item.icon size={20} strokeWidth={isActive(item) ? 2.5 : 1.8} />
              <span className="truncate w-full text-center">{item.label}</span>
            </Link>
          ))}
          {/* "Más" button opens full sidebar */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-medium text-gray-400 hover:text-beauty-borgona transition-colors min-h-[56px]"
          >
            <Menu size={20} strokeWidth={1.8} />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile: full sidebar overlay ───────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col shadow-2xl h-full overflow-y-auto">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
