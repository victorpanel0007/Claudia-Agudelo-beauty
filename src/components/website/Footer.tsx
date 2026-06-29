import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'

const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/claudiaagudelobeauty',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    bg: 'bg-gradient-to-br from-pink-500 to-purple-600',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/14d4ZJDy6n8/',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    bg: 'bg-blue-600',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@claudiaagudelobeauty0',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/>
      </svg>
    ),
    bg: 'bg-black',
  },
]

export default function Footer() {
  return (
    <footer className="bg-beauty-bg border-t border-beauty-primary/20 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Brand */}
          <div className="text-center md:text-left">
            <p className="font-serif text-beauty-text-dark font-bold text-xl">
              Claudia Agudelo Beauty
            </p>
            <p className="text-beauty-text-muted text-sm mt-1">Salón de Belleza Premium</p>
          </div>

          {/* Nav */}
          <nav className="flex flex-wrap justify-center gap-5 text-sm">
            {[
              { href: '#inicio',    label: 'Inicio' },
              { href: '#servicios', label: 'Servicios' },
              { href: '#reservar',  label: 'Reservar' },
              { href: '#galeria',   label: 'Galería' },
              { href: '#contacto',  label: 'Contacto' },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="text-beauty-text hover:text-beauty-primary transition-colors font-medium">
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="gold-divider my-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-beauty-text-muted">
          <p>© 2026 Claudia Agudelo Beauty. Todos los derechos reservados.</p>

          {/* Redes sociales */}
          <div className="flex items-center gap-2">
            {SOCIAL.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center text-white hover:scale-110 transition-transform`}>
                {s.icon}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <p>Hecho con 💖 en Colombia</p>
            <Link href="/admin"
              className="flex items-center gap-1.5 bg-beauty-secondary/10 border border-beauty-secondary/40 text-beauty-secondary hover:bg-beauty-secondary/20 px-3 py-1.5 rounded-full transition-colors font-medium">
              <LayoutDashboard size={12} />
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
