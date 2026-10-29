'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

const WA_LINK = 'https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0'

interface Categoria { id: string; nombre: string; icono: string; orden: number }
interface Props { categorias: Categoria[]; imagenesMap: Record<string, string> }

export default function ServicesSection({ categorias }: Props) {
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState(0)

  // Cicla automáticamente por cada servicio cada 1.2s
  useEffect(() => {
    if (reducedMotion || categorias.length === 0) return
    const timer = setInterval(() => {
      setActive(a => (a + 1) % categorias.length)
    }, 1200)
    return () => clearInterval(timer)
  }, [categorias.length, reducedMotion])

  // Con prefers-reduced-motion: los elementos aparecen directamente sin animación
  const cardVariants = {
    hidden:  reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <section id="servicios" className="py-16 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Header — aparece primero */}
        <motion.div
          className="text-center mb-12"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <p className="text-white/80 text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3 drop-shadow">
            ♥ Lo que ofrecemos
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            Nuestros <span className="text-beauty-primary">Servicios</span>
          </h2>
          <p className="text-white/80 text-sm sm:text-base max-w-md mx-auto drop-shadow">
            Especialistas en belleza con años de experiencia. Todo lo que necesitas en un solo lugar.
          </p>
          <div className="gold-divider w-20 mx-auto mt-5" />
        </motion.div>

        {/* Grid de tarjetas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categorias.map((cat, i) => (
            <motion.a
              key={cat.id}
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: reducedMotion ? 0 : 0.75,
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: reducedMotion ? 0 : (i % 3) * 0.1,
              }}
              whileHover={reducedMotion ? {} : { y: -4, transition: { duration: 0.25 } }}
              className={`group flex flex-col items-center justify-center text-center py-8 px-4 cursor-pointer rounded-2xl border transition-all duration-500 hover:border-white/40 hover:bg-white/10 hover:backdrop-blur-sm hover:shadow-lg ${
                active === i
                  ? 'border-white/50 bg-white/10 backdrop-blur-sm shadow-lg scale-105'
                  : 'border-transparent'
              }`}
              style={{ background: 'transparent' }}
            >
              {/* Número decorativo dorado */}
              <span
                className="text-xs font-semibold tracking-[0.3em] mb-3 transition-opacity duration-300 group-hover:opacity-100 opacity-60"
                style={{ color: '#C9A96E' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Línea dorada superior */}
              <div
                className="w-8 h-px mb-4 transition-all duration-500 group-hover:w-14"
                style={{ backgroundColor: '#C9A96E' }}
              />

              {/* Nombre del servicio */}
              <h3
                className="font-serif text-xl sm:text-2xl font-bold leading-snug drop-shadow-sm transition-all duration-300 group-hover:tracking-wide"
                style={{ color: '#ffffff' }}
              >
                {cat.nombre}
              </h3>

              {/* Línea dorada inferior */}
              <div
                className="w-8 h-px mt-4 transition-all duration-500 group-hover:w-14"
                style={{ backgroundColor: '#C9A96E' }}
              />
            </motion.a>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-12"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
        >
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-beauty-primary text-white font-semibold px-10 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center gap-2"
          >
            💅 Apartar Cita
          </a>
        </motion.div>

      </div>
    </section>
  )
}
