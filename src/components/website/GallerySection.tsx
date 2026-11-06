'use client'

import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'

interface FotoGaleria { url: string; categoria: string; descripcion: string | null }
interface Props { fotos: FotoGaleria[] }

// ── Configuración de cada sección ────────────────────────────────────────
const SECCIONES = [
  {
    key: 'Cabello',
    numero: '01',
    titulo: 'Cabello',
    servicios: 'Cortes · Tintes · Balayage · Coloración · Tratamientos · Peinados',
    // px/s — más bajo = más lento
    velocidad: 38,
  },
  {
    key: 'Uñas',
    numero: '02',
    titulo: 'Uñas',
    servicios: 'Manicure · Diseños · Acrílicas · Semipermanentes · Nail Art',
    velocidad: 48,
  },
  {
    key: 'Maquillaje',
    numero: '03',
    titulo: 'Maquillaje',
    servicios: 'Social · Profesional · Eventos · Ocasiones especiales',
    velocidad: 38,
  },
]

// Tamaño de cada foto en el carrusel — responsivo
// clamp(mín, preferido, máx) → se calcula en JS según el ancho de ventana
// En móvil (~375px): ~160px ancho · ~210px alto
// En tablet (~768px): ~240px ancho · ~310px alto
// En desktop (~1440px): ~300px ancho · ~390px alto
const IMG_GAP = 10  // px

function getImgSize() {
  if (typeof window === 'undefined') return { w: 280, h: 360 }
  const vw = window.innerWidth
  if (vw < 480)  return { w: Math.round(vw * 0.44), h: Math.round(vw * 0.57) }
  if (vw < 768)  return { w: Math.round(vw * 0.38), h: Math.round(vw * 0.50) }
  if (vw < 1024) return { w: Math.round(vw * 0.28), h: Math.round(vw * 0.37) }
  return { w: 300, h: 390 }
}

// ── Componente principal ─────────────────────────────────────────────────
export default function GallerySection({ fotos = [] }: Props) {
  const items = fotos.filter(f => !!f.url)
  const reducedMotion = useReducedMotion()

  // Estado global de pausa — compartido por todos los carruseles
  const [pausado, setPausado] = useState(false)

  // Lightbox
  const [lightbox, setLightbox] = useState<{ list: FotoGaleria[]; idx: number } | null>(null)
  const lbTotal = lightbox?.list.length ?? 0

  // Abrir lightbox → pausar todo
  const abrirLightbox = useCallback((list: FotoGaleria[], idx: number) => {
    setLightbox({ list, idx })
    setPausado(true)
  }, [])

  // Cerrar lightbox → reanudar todo
  const cerrarLightbox = useCallback(() => {
    setLightbox(null)
    setPausado(false)
  }, [])

  // Teclado en lightbox
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     cerrarLightbox()
      if (e.key === 'ArrowRight') setLightbox(p => p ? { ...p, idx: (p.idx + 1) % lbTotal } : null)
      if (e.key === 'ArrowLeft')  setLightbox(p => p ? { ...p, idx: (p.idx - 1 + lbTotal) % lbTotal } : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, lbTotal, cerrarLightbox])

  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  if (items.length === 0) return null

  return (
    <section
      id="galeria"
      className="py-16 sm:py-24 overflow-hidden relative"
    >

      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-14">
        <div className="text-center">
          <p className="text-white/80 text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3 drop-shadow">
            ♥ Especialidades
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            Nuestro <span className="text-beauty-champagne">Trabajo</span>
          </h2>
          <p className="text-white/80 text-sm sm:text-base max-w-md mx-auto drop-shadow">
            Cada servicio es una experiencia diseñada para que te sientas hermosa y segura.
          </p>
          <div className="gold-divider w-20 mx-auto mt-5" />
        </div>
      </div>

      {/* Tres secciones */}
      <div className="space-y-12">
        {SECCIONES.map(sec => {
          const lista = items.filter(
            f => f.categoria?.toLowerCase() === sec.key.toLowerCase()
          )
          return (
            <SeccionCarrusel
              key={sec.key}
              numero={sec.numero}
              titulo={sec.titulo}
              servicios={sec.servicios}
              fotos={lista}
              velocidad={reducedMotion ? 0 : sec.velocidad}
              pausadoGlobal={pausado}
              onPausar={() => setPausado(true)}
              onReanudar={() => { if (!lightbox) setPausado(false) }}
              onOpenLightbox={(idx) => abrirLightbox(lista, idx)}
            />
          )
        })}
      </div>

      {/* CTA */}
      <div className="text-center mt-14">
        <a
          href="https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-beauty-champagne text-white font-semibold px-10 py-4 rounded-full text-base hover:bg-beauty-web-accent-dark transition-all shadow-beauty hover:shadow-beauty-lg"
        >
          ✨ Reserva tu turno
        </a>
      </div>

      {/* ── Barra Instagram ──────────────────────────────────────────── */}
      <div className="mt-16 w-full" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-3 flex-wrap">
          <span className="text-white/60 text-xs sm:text-sm tracking-wide">
            ¿Quieres ver más? Síguenos en Instagram
          </span>
          {/* Ícono Instagram */}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white" className="opacity-60 shrink-0">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          {/* Handle con píldora */}
          <a
            href="https://www.instagram.com/claudiaagudelobeauty"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/30 text-white text-xs sm:text-sm font-semibold tracking-widest uppercase hover:bg-white/10 transition-all"
            aria-label="Ir al Instagram de Claudia Agudelo Beauty"
          >
            @claudiaagudelobeauty
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[99999] bg-black/92 flex items-center justify-center p-4"
          onClick={cerrarLightbox}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <Image
              src={lightbox.list[lightbox.idx].url}
              alt={lightbox.list[lightbox.idx].descripcion || ''}
              width={1200} height={900}
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl"
              sizes="100vw"
              priority
            />
            {lightbox.list[lightbox.idx].descripcion && (
              <p className="text-center font-serif text-white text-lg font-bold mt-4 drop-shadow">
                {lightbox.list[lightbox.idx].descripcion}
              </p>
            )}
          </div>

          <button onClick={cerrarLightbox}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
            aria-label="Cerrar"><X size={20} /></button>
          <button onClick={e => { e.stopPropagation(); setLightbox(p => p ? { ...p, idx: (p.idx - 1 + lbTotal) % lbTotal } : null) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
            aria-label="Anterior"><ChevronLeft size={22} /></button>
          <button onClick={e => { e.stopPropagation(); setLightbox(p => p ? { ...p, idx: (p.idx + 1) % lbTotal } : null) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
            aria-label="Siguiente"><ChevronRight size={22} /></button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
            {lightbox.idx + 1} / {lbTotal}
          </p>
        </div>
      )}
    </section>
  )
}

// ── Sección individual con carrusel infinito ─────────────────────────────
function SeccionCarrusel({
  numero,
  titulo,
  servicios,
  fotos,
  velocidad,
  pausadoGlobal,
  onPausar,
  onReanudar,
  onOpenLightbox,
}: {
  numero: string
  titulo: string
  servicios: string
  fotos: FotoGaleria[]
  velocidad: number
  pausadoGlobal: boolean
  onPausar: () => void
  onReanudar: () => void
  onOpenLightbox: (idx: number) => void
}) {
  const trackRef  = useRef<HTMLDivElement>(null)
  const rafRef    = useRef<number>(0)
  const offsetRef = useRef(0)
  const lastTsRef = useRef<number | null>(null)
  const [imgSize, setImgSize] = useState({ w: 280, h: 360 })

  // Calcular tamaño al montar y al redimensionar
  useEffect(() => {
    function update() { setImgSize(getImgSize()) }
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  const IMG_W = imgSize.w
  const IMG_H = imgSize.h

  const copiaW = fotos.length * (IMG_W + IMG_GAP)

  useEffect(() => {
    if (velocidad === 0 || fotos.length === 0) return
    function tick(ts: number) {
      if (!pausadoGlobal) {
        if (lastTsRef.current !== null) {
          const delta = ts - lastTsRef.current
          offsetRef.current -= (velocidad * delta) / 1000
          if (offsetRef.current <= -copiaW) {
            offsetRef.current += copiaW
          }
        }
        lastTsRef.current = ts
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${offsetRef.current}px)`
        }
      } else {
        lastTsRef.current = null
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [velocidad, fotos.length, copiaW, pausadoGlobal])

  // Duplicar la lista solo visualmente — sin tocar Supabase
  const copias = fotos.length > 0 ? [...fotos, ...fotos, ...fotos] : []

  // Si no hay fotos
  if (fotos.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-baseline gap-4 mb-4">
          <span className="font-serif text-4xl font-bold opacity-30" style={{ color: '#C9A96E' }}>{numero}</span>
          <h3 className="font-serif text-2xl font-bold text-white drop-shadow">{titulo}</h3>
        </div>
        <div className="flex items-center justify-center h-40 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-white/30 text-sm tracking-widest uppercase">Próximamente</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Cabecera de sección */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-1 sm:gap-5">
          <div className="flex items-baseline gap-3">
            <span
              className="font-serif text-5xl font-bold leading-none select-none"
              style={{ color: '#C9A96E', opacity: 0.45 }}
            >{numero}</span>
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
              {titulo}
            </h3>
          </div>
          <p className="text-white/50 text-xs sm:text-sm tracking-wide pb-0.5">
            {servicios}
          </p>
        </div>
        {/* Línea dorada */}
        <div className="mt-3 h-px w-full opacity-20" style={{ backgroundColor: '#C9A96E' }} />
      </div>

      {/* Carrusel — ocupa todo el ancho */}
      <div
        className="relative overflow-hidden"
        onMouseEnter={onPausar}
        onMouseLeave={onReanudar}
        style={{ height: IMG_H + 2 }}      >
        {/* Track — contiene las copias duplicadas */}
        <div
          ref={trackRef}
          className="flex absolute top-0 left-0"
          style={{ gap: IMG_GAP, willChange: 'transform' }}
        >
          {copias.map((foto, i) => {
            // El índice real dentro de la copia original
            const idxReal = i % fotos.length
            return (
              <button
                key={i}
                onClick={() => onOpenLightbox(idxReal)}
                className="flex-shrink-0 relative overflow-hidden group focus:outline-none"
                style={{
                  width: IMG_W,
                  height: IMG_H,
                  borderRadius: 14,
                }}
                aria-label={i < fotos.length ? (foto.descripcion || titulo) : undefined}
                tabIndex={i < fotos.length ? 0 : -1}
              >
                <Image
                  src={foto.url}
                  alt={foto.descripcion || titulo}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes={`(max-width: 480px) 44vw, (max-width: 768px) 38vw, (max-width: 1024px) 28vw, 300px`}
                  // Solo precarga las primeras imágenes reales
                  priority={i < 6}
                />
                {/* Overlay sutil */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 rounded-xl" />
              </button>
            )
          })}
        </div>

        {/* Degradados en los bordes para efecto fade */}
        <div className="absolute inset-y-0 left-0 w-12 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.3), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-12 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.3), transparent)' }} />
      </div>
    </div>
  )
}
