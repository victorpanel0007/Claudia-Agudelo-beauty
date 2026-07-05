'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, LayoutDashboard } from 'lucide-react'
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
          <a href="#reservar"
            className="bg-beauty-primary text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-beauty-primary-dark transition-all shadow-sm hover:shadow-beauty min-h-[44px] flex items-center">
            Agenda tu Cita
          </a>
          <Link href="/admin"
            className="flex items-center gap-1.5 border border-beauty-secondary/50 text-beauty-secondary text-xs font-medium px-3 py-2 rounded-full hover:bg-beauty-secondary/10 transition-all min-h-[44px]">
            <LayoutDashboard size={13} />Admin
          </Link>
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
                <LayoutDashboard size={15} />Panel Administrativo
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
