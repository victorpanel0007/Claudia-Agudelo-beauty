'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const TRABAJOS = [
  {
    icon: '💅',
    titulo: 'Manicura',
    desc: 'Uñas perfectas en cada acabado: tradicional, semipermanente o acrílico.',
    bg: 'from-pink-50 to-rose-100',
    accent: 'bg-rose-400',
  },
  {
    icon: '💄',
    titulo: 'Maquillaje',
    desc: 'Social, artístico o para novias. Cada look pensado para resaltarte.',
    bg: 'from-fuchsia-50 to-pink-100',
    accent: 'bg-fuchsia-400',
  },
  {
    icon: '✂️',
    titulo: 'Peluquería',
    desc: 'Cortes, coloración, mechas y keratina con los mejores productos.',
    bg: 'from-amber-50 to-yellow-100',
    accent: 'bg-amber-400',
  },
  {
    icon: '👁️',
    titulo: 'Cejas & Pestañas',
    desc: 'Diseño de cejas, laminado, tinte y extensiones de pestañas.',
    bg: 'from-violet-50 to-purple-100',
    accent: 'bg-violet-400',
  },
  {
    icon: '💆‍♀️',
    titulo: 'Tratamientos Capilares',
    desc: 'Nutrición, hidratación y peinados que transforman tu cabello.',
    bg: 'from-emerald-50 to-teal-100',
    accent: 'bg-emerald-400',
  },
  {
    icon: '✨',
    titulo: 'Depilación',
    desc: 'Cera caliente y fría para una piel suave y libre de vello.',
    bg: 'from-sky-50 to-blue-100',
    accent: 'bg-sky-400',
  },
]

interface Props {
  fotos: string[]
}

export default function GallerySection({ fotos = [] }: Props) {
  // Solo las tarjetas que tienen foto real
  const fotosConIndice = fotos
    .map((url, i) => ({ url, index: i }))
    .filter(f => !!f.url)

  const [lightbox, setLightbox] = useState<number | null>(null) // índice dentro de fotosConIndice

  // Cerrar con Escape, navegar con flechas
  useEffect(() => {
    if (lightbox === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')      setLightbox(null)
      if (e.key === 'ArrowRight')  setLightbox(prev => prev !== null ? Math.min(prev + 1, fotosConIndice.length - 1) : null)
      if (e.key === 'ArrowLeft')   setLightbox(prev => prev !== null ? Math.max(prev - 1, 0) : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, fotosConIndice.length])

  // Bloquear scroll del body cuando el lightbox está abierto
  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  const activeFoto = lightbox !== null ? fotosConIndice[lightbox] : null

  return (
    <section id="galeria" className="py-16 sm:py-24 bg-beauty-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-beauty-secondary text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3">
            ♥ Especialidades
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-beauty-text-dark mb-4">
            Nuestro <span className="text-beauty-primary">Trabajo</span>
          </h2>
          <p className="text-beauty-text-muted text-sm sm:text-base max-w-md mx-auto">
            Cada servicio es una experiencia diseñada para que te sientas hermosa y segura.
          </p>
          <div className="gold-divider w-20 mx-auto mt-5" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRABAJOS.map((item, i) => {
            const fotoUrl  = fotos[i] ?? null
            const fotoIdx  = fotoUrl ? fotosConIndice.findIndex(f => f.index === i) : -1

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.07 }}
                className={`relative bg-gradient-to-br ${item.bg} rounded-3xl border border-white/80 shadow-sm hover:shadow-card transition-all duration-300 group overflow-hidden`}
              >
                {/* Círculo decorativo */}
                <div className={`absolute -top-4 -right-4 w-20 h-20 ${item.accent} opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500`} />

                {/* Imagen real — clickeable para abrir lightbox */}
                {fotoUrl && (
                  <button
                    onClick={() => setLightbox(fotoIdx)}
                    className="relative w-full h-44 overflow-hidden rounded-t-3xl block focus:outline-none"
                    aria-label={`Ver imagen de ${item.titulo}`}
                  >
                    <Image
                      src={fotoUrl}
                      alt={item.titulo}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {/* Overlay hint */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
                        Ver imagen
                      </span>
                    </div>
                  </button>
                )}

                {/* Contenido */}
                <div className="p-6">
                  {!fotoUrl && (
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl mb-4 group-hover:scale-105 transition-transform duration-300">
                      {item.icon}
                    </div>
                  )}
                  <h3 className="font-serif font-bold text-beauty-text-dark text-lg mb-2">
                    {item.titulo}
                  </h3>
                  <p className="text-beauty-text-muted text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className={`absolute bottom-0 left-0 right-0 h-1 ${item.accent} opacity-30 rounded-b-3xl`} />
              </motion.div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href="https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-beauty-primary text-white font-semibold px-10 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg"
          >
            ✨ Reserva tu turno
          </a>
        </div>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────── */}
      <AnimatePresence>
        {lightbox !== null && activeFoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            {/* Imagen centrada */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={{ scale: 0.9,    opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative max-w-4xl w-full max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <Image
                key={activeFoto.url}
                src={activeFoto.url}
                alt={TRABAJOS[activeFoto.index]?.titulo ?? 'Imagen'}
                width={1200}
                height={900}
                className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                sizes="100vw"
                priority
              />

              {/* Título */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl px-6 py-4">
                <p className="text-white font-bold text-lg">
                  {TRABAJOS[activeFoto.index]?.titulo}
                </p>
                <p className="text-white/70 text-sm">
                  {TRABAJOS[activeFoto.index]?.desc}
                </p>
              </div>
            </motion.div>

            {/* Botón cerrar */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            {/* Flechas de navegación — solo si hay más de 1 foto */}
            {fotosConIndice.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setLightbox(Math.max(lightbox - 1, 0)) }}
                  disabled={lightbox === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-30"
                  aria-label="Anterior"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setLightbox(Math.min(lightbox + 1, fotosConIndice.length - 1)) }}
                  disabled={lightbox === fotosConIndice.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-30"
                  aria-label="Siguiente"
                >
                  <ChevronRight size={22} />
                </button>

                {/* Contador */}
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
                  {lightbox + 1} / {fotosConIndice.length}
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
