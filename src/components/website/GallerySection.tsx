'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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

  useEffect(() => {
    fetch('/api/galeria')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setFotos(data) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const usarFotos = fotos.length > 0

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

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {usarFotos ? (
            fotos.map((foto, i) => (
              <motion.div
                key={foto.id}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '100px' }}
                transition={{ delay: i * 0.05 }}
                className="relative aspect-square rounded-2xl overflow-hidden shadow-card group cursor-pointer"
              >
                <Image
                  src={foto.url}
                  alt={foto.descripcion || foto.categoria}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                  <span className="text-white text-xs font-semibold">{foto.descripcion || foto.categoria}</span>
                </div>
              </motion.div>
            ))
          ) : loaded ? (
            FALLBACK.map((item, i) => (
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
            ))
          ) : (
            // Skeleton mientras carga
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-beauty-rosa-claro/40 animate-pulse" />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
