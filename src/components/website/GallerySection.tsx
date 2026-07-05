'use client'

import { motion } from 'framer-motion'

// viewport: once: true + margin para cargar justo antes de entrar en pantalla
const gallery = [
  { emoji: '💅', label: 'Manicura',    bg: 'bg-beauty-rosa-claro' },
  { emoji: '💄', label: 'Maquillaje',  bg: 'bg-beauty-bg' },
  { emoji: '💆‍♀️', label: 'Masajes',    bg: 'bg-beauty-rosa-claro/60' },
  { emoji: '✨', label: 'Facial',      bg: 'bg-beauty-bg' },
  { emoji: '👁️', label: 'Cejas',       bg: 'bg-beauty-rosa-claro' },
  { emoji: '💇‍♀️', label: 'Peinados',   bg: 'bg-beauty-bg' },
  { emoji: '💈', label: 'Barbería',    bg: 'bg-beauty-rosa-claro/60' },
  { emoji: '🪒', label: 'Depilación',  bg: 'bg-beauty-bg' },
  { emoji: '💇', label: 'Peluquería',  bg: 'bg-beauty-rosa-claro' },
]

export default function GallerySection() {
  return (
    <section id="galeria" className="py-14 sm:py-20 bg-beauty-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
<<<<<<< HEAD
          <p className="text-beauty-secondary text-xs sm:text-sm font-medium tracking-widest uppercase mb-3">
=======
          <p className="text-beauty-secondary text-sm font-medium tracking-widest uppercase mb-3">
>>>>>>> 2f2bdad9279844c19f030c971fdf2af4a6837d01
            ♥ Galería
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-beauty-text-dark mb-2">
            Nuestro <span className="text-beauty-primary">Trabajo</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        {/* 2 cols on mobile, 3 on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {gallery.map((item, i) => (
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

        <p className="text-center text-beauty-text-muted text-xs mt-6 sm:mt-8">
          * Las imágenes reales se agregan desde el panel administrativo
        </p>
      </div>
    </section>
  )
}
