'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'

export default function HeroSection() {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden bg-beauty-bg pt-20">
      {/* Blobs decorativos — no bloquean render */}
      <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-beauty-rosa-claro/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-beauty-secondary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Texto — sin animación para mejor LCP */}
          <div className="animate-fade-in">
            <p className="text-beauty-secondary text-sm font-medium tracking-widest uppercase mb-4">
              ✦ Salón de Belleza Premium ✦
            </p>

            <h1 className="font-serif text-5xl sm:text-6xl font-bold text-beauty-text leading-tight mb-4">
              Realzamos<br />
              tu belleza
              <span className="block text-beauty-borgona italic font-serif mt-1 text-4xl sm:text-5xl">
                y tu esencia
              </span>
            </h1>

            <p className="text-beauty-text text-base leading-relaxed mb-8 max-w-md">
              En nuestro salón, cada detalle está pensado para que te sientas única, hermosa y renovada.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#reservar"
                className="bg-beauty-primary text-white font-semibold px-8 py-4 rounded-full text-sm hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center justify-center gap-2">
                Agenda tu Cita
              </a>
              <a href={`https://wa.me/57${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '3022197673'}?text=Hola`}
                target="_blank" rel="noopener noreferrer"
                className="border-2 border-beauty-primary/40 text-beauty-primary font-semibold px-8 py-4 rounded-full text-sm hover:bg-beauty-primary/10 transition-all inline-flex items-center justify-center gap-2">
                💬 WhatsApp
              </a>
            </div>
          </div>

          {/* Logo círculo — solo en desktop */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="w-80 h-80 rounded-full overflow-hidden border-4 border-beauty-primary/20 shadow-beauty-lg">
              <Image
                src="/WhatsApp Image 2026-06-18 at 8.53.37 PM_1254x1254.png"
                alt="Claudia Agudelo Beauty Logo"
                width={320}
                height={320}
                className="w-full h-full object-cover"
                priority
                sizes="320px"
                quality={85}
              />
            </div>

            {/* Flores flotantes — lazy con motion */}
            <motion.span animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}
              className="absolute top-4 right-10 text-3xl">🌸</motion.span>
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.5, delay: 0.5 }}
              className="absolute top-16 left-0 text-2xl">🌺</motion.span>
            <motion.span animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 4, delay: 1 }}
              className="absolute bottom-10 right-0 text-2xl">💐</motion.span>
            <motion.span animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 2.8, delay: 0.8 }}
              className="absolute bottom-4 left-8 text-3xl">🌷</motion.span>

            {/* Stats */}
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.5 }}
              className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-card p-4 border border-beauty-primary/20">
              <p className="font-serif text-2xl font-bold text-beauty-secondary">500+</p>
              <p className="text-beauty-text text-xs mt-0.5">Clientas felices</p>
            </motion.div>

            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4, delay: 1 }}
              className="absolute -top-4 -left-6 bg-white rounded-2xl shadow-card p-4 border border-beauty-primary/20">
              <p className="text-xl mb-1">⭐⭐⭐⭐⭐</p>
              <p className="text-beauty-text text-xs">Valoración 5 estrellas</p>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-beauty-primary/50">
        <ChevronDown size={28} />
      </motion.div>
    </section>
  )
}
