'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const FALLBACK = [
  { emoji: '💅', label: 'Manicura',   bg: 'bg-beauty-rosa-claro' },
  { emoji: '💄', label: 'Maquillaje', bg: 'bg-beauty-bg' },
  { emoji: '💆‍♀️', label: 'Masajes',   bg: 'bg-beauty-rosa-claro/60' },
  { emoji: '✨', label: 'Facial',     bg: 'bg-beauty-bg' },
  { emoji: '👁️', label: 'Cejas',      bg: 'bg-beauty-rosa-claro' },
  { emoji: '💇‍♀️', label: 'Peinados',  bg: 'bg-beauty-bg' },
  { emoji: '💈', label: 'Barbería',   bg: 'bg-beauty-rosa-claro/60' },
  { emoji: '🪒', label: 'Depilación', bg: 'bg-beauty-bg' },
  { emoji: '💇', label: 'Peluquería', bg: 'bg-beauty-rosa-claro' },
]

interface FotoGaleria {
  id: string
  url: string
  categoria: string
  descripcion: string | null
}

export default function GallerySection() {
  const [fotos, setFotos] = useState<FotoGaleria[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tabActivo, setTabActivo] = useState('Todas')
  const [lightbox, setLightbox] = useState<FotoGaleria | null>(null)

  useEffect(() => {
    fetch('/api/galeria')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setFotos(data) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Cerrar lightbox con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const usarFotos = fotos.length > 0

  // Categorías únicas en orden de aparición
  const categorias = usarFotos
    ? ['Todas', ...Array.from(new Set(fotos.map(f => f.categoria)))]
    : []

  const fotosFiltradas = usarFotos
    ? (tabActivo === 'Todas' ? fotos : fotos.filter(f => f.categoria === tabActivo))
    : []

  return (
    <section id="galeria" className="py-14 sm:py-20 bg-beauty-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-beauty-secondary text-xs sm:text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Galería
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-beauty-text-dark mb-2">
            Nuestro <span className="text-beauty-primary">Trabajo</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        {/* Tabs de categoría */}
        {usarFotos && categorias.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setTabActivo(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  tabActivo === cat
                    ? 'bg-beauty-primary text-white shadow-beauty'
                    : 'bg-white border border-beauty-primary/30 text-beauty-text hover:border-beauty-primary hover:bg-beauty-rosa-claro/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {!loaded ? (
          // Skeleton
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-beauty-rosa-claro/40 animate-pulse" />
            ))}
          </div>
        ) : usarFotos ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tabActivo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
            >
              {fotosFiltradas.map((foto, i) => (
                <motion.button
                  key={foto.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setLightbox(foto)}
                  className="relative aspect-square rounded-2xl overflow-hidden shadow-card group cursor-pointer focus:outline-none focus:ring-2 focus:ring-beauty-primary"
                >
                  <Image
                    src={foto.url}
                    alt={foto.descripcion || foto.categoria}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <span className="text-white text-xs font-semibold leading-tight">
                      {foto.descripcion || foto.categoria}
                    </span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          // Fallback emojis
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {FALLBACK.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '100px' }}
                transition={{ delay: i * 0.05 }}
                className={`aspect-square rounded-2xl ${item.bg} border border-beauty-primary/30
                  flex flex-col items-center justify-center gap-2 sm:gap-3
                  hover:border-beauty-secondary hover:shadow-card
                  transition-all duration-300 cursor-pointer group`}
              >
                <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-300">
                  {item.emoji}
                </span>
                <p className="text-beauty-text text-xs sm:text-sm font-medium">{item.label}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              onClick={e => e.stopPropagation()}
              className="relative max-w-2xl w-full max-h-[85vh] rounded-2xl overflow-hidden cursor-default"
            >
              <Image
                src={lightbox.url}
                alt={lightbox.descripcion || lightbox.categoria}
                width={800}
                height={800}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              {lightbox.descripcion && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-4 py-3">
                  <p className="text-white text-sm font-medium">{lightbox.descripcion}</p>
                  <p className="text-white/60 text-xs">{lightbox.categoria}</p>
                </div>
              )}
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
