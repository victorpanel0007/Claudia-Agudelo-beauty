'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const AUTOPLAY_MS = 3500
const CARD_W   = 54
const SIDE_W   = 20
const GAP_PX   = 10

interface FotoGaleria { url: string; categoria: string; descripcion: string | null }
interface Props { fotos: FotoGaleria[] }

export default function GallerySection({ fotos = [] }: Props) {
  const items = fotos.filter(f => !!f.url)

  const total = items.length
  const [current, setCurrent]   = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trackRef  = useRef<HTMLDivElement>(null)

  // Autoplay
  function resetTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (total < 2) return
    timerRef.current = setTimeout(() => setCurrent(c => (c + 1) % total), AUTOPLAY_MS)
  }
  useEffect(() => {
    resetTimer()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total])

  function goTo(idx: number) {
    setCurrent((idx + total) % total)
  }

  // Teclado en lightbox
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox(p => p !== null ? (p + 1) % total : null)
      if (e.key === 'ArrowLeft')  setLightbox(p => p !== null ? (p - 1 + total) % total : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, total])

  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  if (total === 0) return null

  return (
    <section id="galeria" className="py-16 sm:py-24">
      <div className="max-w-xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-white/80 text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3 drop-shadow">
            ♥ Especialidades
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            Nuestro <span className="text-beauty-primary">Trabajo</span>
          </h2>
          <p className="text-white/80 text-sm sm:text-base max-w-md mx-auto drop-shadow">
            Cada servicio es una experiencia diseñada para que te sientas hermosa y segura.
          </p>
          <div className="gold-divider w-20 mx-auto mt-5" />
        </div>

        {/* ── Carrusel ─────────────────────────────────────────────── */}
        <div className="relative">

          {/* Ventana visible — oculta lo que queda fuera */}
          <div className="overflow-hidden rounded-2xl">
            {/* Track — se desplaza con CSS transform */}
            <div
              ref={trackRef}
              className="flex items-center"
              style={{
                gap: `${GAP_PX}px`,
                // Desplazamiento: cada tarjeta ocupa CARD_W% + GAP, centrada
                transform: `translateX(calc(${SIDE_W}% - ${current} * (${CARD_W}% + ${GAP_PX}px) + ${GAP_PX / 2}px))`,
                transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
                willChange: 'transform',
              }}
            >
              {items.map((item, i) => {
                const isActive = i === current
                return (
                  <div
                    key={i}
                    onClick={() => isActive ? setLightbox(i) : goTo(i)}
                    className="flex-shrink-0 cursor-pointer"
                    style={{ width: `${CARD_W}%` }}
                  >
                    <motion.div
                      animate={{
                        scale:   isActive ? 1 : 0.9,
                        opacity: isActive ? 1 : 0.45,
                      }}
                      transition={{ duration: 0.4 }}
                      className="rounded-2xl overflow-hidden shadow-xl bg-black/5"
                    >
                      {/* Contenedor de altura fija uniforme — imagen centrada con object-contain */}
                      <div className="relative w-full h-64 sm:h-72">
                        <Image
                          src={item.url}
                          alt={`${item.categoria} — ${item.descripcion}`}
                          fill
                          className="object-contain"
                          sizes="(max-width: 640px) 54vw, 380px"
                          priority={i === 0}
                        />
                      </div>
                    </motion.div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Flechas — fuera del overflow:hidden */}
          <button
            onClick={() => goTo(current - 1)}
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all z-10 shadow-lg"
            aria-label="Anterior"
          ><ChevronLeft size={18} /></button>
          <button
            onClick={() => goTo(current + 1)}
            className="absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all z-10 shadow-lg"
            aria-label="Siguiente"
          ><ChevronRight size={18} /></button>
        </div>

        {/* Nombre debajo — categoría + trabajo */}
        <div className="text-center mt-6 h-12">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-white/55 text-xs tracking-widest uppercase drop-shadow">
              {items[current].categoria}
            </p>
            <p className="font-serif text-white text-xl font-bold drop-shadow-lg mt-0.5">
              {items[current].descripcion}
            </p>
          </motion.div>
        </div>

        {/* Puntos */}
        <div className="flex justify-center gap-2 mt-4">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir a ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-6 h-2 bg-beauty-primary' : 'w-2 h-2 bg-white/35 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <a
            href="https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-beauty-primary text-white font-semibold px-10 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg"
          >
            ✨ Reserva tu turno
          </a>
        </div>
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={items[lightbox].url}
              alt={`${items[lightbox].categoria} — ${items[lightbox].descripcion}`}
              width={1200}
              height={900}
              className="w-full h-auto max-h-[78vh] object-contain rounded-2xl shadow-2xl"
              sizes="100vw"
              priority
            />
            <div className="text-center mt-4">
              <p className="text-white/50 text-xs tracking-widest uppercase">{items[lightbox].categoria}</p>
              <p className="font-serif text-white text-xl font-bold mt-1">{items[lightbox].descripcion}</p>
            </div>
          </div>

          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
            aria-label="Cerrar"><X size={20} /></button>

          <button onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + total) % total) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
            aria-label="Anterior"><ChevronLeft size={22} /></button>
          <button onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % total) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
            aria-label="Siguiente"><ChevronRight size={22} /></button>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
            {lightbox + 1} / {total}
          </p>
        </div>
      )}
    </section>
  )
}
