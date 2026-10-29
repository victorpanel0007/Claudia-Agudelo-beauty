'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'

export default function HeroSection() {
  const textRef = useRef<HTMLDivElement>(null)
  const rafRef  = useRef<number>(0)

  useEffect(() => {
    function onScroll() {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const el = textRef.current
        if (!el) return
        const y = window.scrollY
        el.style.transform = `translateY(${-(y * 0.3)}px)`
        el.style.opacity   = String(Math.max(0, 1 - y / 400))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden pt-16">

      {/* Imagen fija — backgroundAttachment:fixed es lo más simple y sin parpadeo */}
      <div
        className="absolute inset-0 -z-0"
        style={{
          backgroundImage: "url('/fondo.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      {/* Overlay — igual que antes */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Texto — se desliza y desvanece al hacer scroll */}
      <div
        ref={textRef}
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full py-10 sm:py-16"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="animate-fade-in text-center lg:text-left max-w-xl">
          <p className="text-white/90 text-xs sm:text-sm font-medium tracking-widest uppercase mb-3 drop-shadow">
            ✦ Salón de Belleza Premium ✦
          </p>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 drop-shadow-lg">
            Realzamos<br />
            tu belleza
            <span className="block text-beauty-primary italic font-serif mt-1 text-3xl sm:text-4xl lg:text-5xl drop-shadow">
              y tu esencia
            </span>
          </h1>

          <p className="text-white/90 text-base leading-relaxed mb-8 drop-shadow">
            En nuestro salón, cada detalle está pensado para que te sientas única, hermosa y renovada.
          </p>

          <a
            href="https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-beauty-primary text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center gap-2 min-h-[52px]"
          >
            💅 Agenda tu Cita
          </a>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 z-10"
      >
        <ChevronDown size={28} />
      </motion.div>
    </section>
  )
}
