'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, User, CalendarDays, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '#inicio',    label: 'Inicio' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#galeria',   label: 'Galería' },
  { href: '#contacto',  label: 'Contacto' },
]

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeLink, setActiveLink] = useState('#inicio')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 1024) setIsOpen(false) }
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled
        ? 'bg-white/95 backdrop-blur-md shadow-sm py-2'
        : 'bg-white/90 backdrop-blur-sm py-3'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 lg:grid lg:grid-cols-[auto_1fr_auto]">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0" onClick={() => setIsOpen(false)}>
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-beauty-primary/30 shadow-sm shrink-0">
            <Image
              src="/logo.png"
              alt="Claudia Agudelo Beauty"
              width={56}
              height={56}
              className="w-full h-full object-cover"
              priority
              sizes="56px"
              quality={85}
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 justify-center">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setActiveLink(link.href)}
              className={cn(
                'text-sm font-semibold tracking-wide uppercase transition-colors relative pb-0.5',
                activeLink === link.href
                  ? 'text-beauty-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-beauty-primary after:rounded-full'
                  : 'text-beauty-text hover:text-beauty-primary'
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <Link href="/admin"
            className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-gray-50 transition-all h-11">
            <User size={16} />
            Ingresar
          </Link>
          <a href="#reservar"
            className="flex items-center gap-2 bg-beauty-primary text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-beauty-primary-dark transition-all shadow-sm hover:shadow-beauty h-11">
            <CalendarDays size={16} />
            Agenda tu cita
            <ChevronRight size={15} />
          </a>
        </div>

        {/* Mobile right side */}
        <div className="lg:hidden flex items-center gap-2">
          <a href="#reservar" onClick={() => setIsOpen(false)}
            className="flex items-center gap-1.5 bg-beauty-primary text-white text-xs font-semibold px-4 py-2.5 rounded-full min-h-[40px]">
            <CalendarDays size={14} />
            Reservar
          </a>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-beauty-text p-2.5 rounded-xl hover:bg-beauty-bg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-t border-beauty-primary/20 shadow-lg animate-slide-down">
          <nav className="flex flex-col p-3 gap-1">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} onClick={() => { setIsOpen(false); setActiveLink(link.href) }}
                className={cn(
                  'hover:bg-beauty-bg transition-colors px-4 py-3.5 rounded-xl text-base font-medium min-h-[52px] flex items-center',
                  activeLink === link.href ? 'text-beauty-primary font-semibold' : 'text-beauty-text hover:text-beauty-primary'
                )}>
                {link.label}
              </a>
            ))}
            <div className="border-t border-beauty-primary/20 mt-2 pt-3 flex flex-col gap-2">
              <a href="#reservar" onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 bg-beauty-primary text-white font-semibold py-3.5 rounded-full text-base hover:bg-beauty-primary-dark transition-all min-h-[52px]">
                <CalendarDays size={18} />
                Agenda tu Cita
                <ChevronRight size={16} />
              </a>
              <Link href="/admin" onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors min-h-[48px]">
                <User size={16} />
                Ingresar al panel
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
