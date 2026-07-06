'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu on resize to desktop
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setIsOpen(false)}>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-beauty-primary/30 shadow-sm shrink-0">
            <Image
              src="/logo.png"
              alt="Claudia Agudelo Beauty"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              priority
              sizes="40px"
              quality={85}
            />
          </div>
          <div className="hidden xs:block">
            <p className="font-serif text-beauty-text-dark font-bold text-sm leading-tight">Claudia Agudelo</p>
            <p className="text-beauty-secondary text-[10px] font-medium tracking-widest uppercase">Beauty</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map(link => (
            <a key={link.href} href={link.href}
              className="text-beauty-text text-xs font-medium hover:text-beauty-primary transition-colors tracking-wide uppercase">
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href={`https://wa.me/573022197673?text=Hola`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-all shadow-sm min-h-[44px]"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>
          <a href="#reservar"
            className="bg-beauty-primary text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-beauty-primary-dark transition-all shadow-sm hover:shadow-beauty min-h-[44px] flex items-center">
            Agenda tu Cita
          </a>
        </div>

        {/* Mobile right side */}
        <div className="lg:hidden flex items-center gap-1">
          {/* Mobile CTA — always visible */}
          <a href="#reservar" onClick={() => setIsOpen(false)}
            className="bg-beauty-primary text-white text-xs font-semibold px-3 py-2 rounded-full min-h-[40px] flex items-center">
            Reservar
          </a>
          {/* Hamburger */}
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
              <a key={link.href} href={link.href} onClick={() => setIsOpen(false)}
                className="text-beauty-text hover:text-beauty-primary hover:bg-beauty-bg transition-colors px-4 py-3.5 rounded-xl text-base font-medium min-h-[52px] flex items-center">
                {link.label}
              </a>
            ))}
            <div className="border-t border-beauty-primary/20 mt-2 pt-3 flex flex-col gap-2">
              <a href="#reservar" onClick={() => setIsOpen(false)}
                className="bg-beauty-primary text-white font-semibold py-3.5 rounded-full text-base text-center hover:bg-beauty-primary-dark transition-all min-h-[52px] flex items-center justify-center">
                💅 Agenda tu Cita
              </a>
              <Link href="/admin" onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 border border-beauty-secondary/50 text-beauty-secondary py-3 rounded-xl text-sm font-semibold hover:bg-beauty-secondary/10 transition-colors min-h-[48px]">
                Panel Administrativo
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
