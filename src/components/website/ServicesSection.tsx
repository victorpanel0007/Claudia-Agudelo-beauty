'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { formatCurrency } from '@/lib/utils'
import { Clock } from 'lucide-react'

// Íconos elegantes para cada categoría
const CAT_ICONS: Record<string, string> = {
  manicura:    '✂️',
  maquillaje:  '💄',
  masajes:     '💆‍♀️',
  facial:      '✨',
  cejas:       '👁️',
  peinados:    '💇‍♀️',
  barberia:    '💈',
  depilacion:  '🪒',
  peluqueria:  '💇',
}

// Servicios destacados para mostrar en la vista de ícono (primeros 6 de la imagen)
const FEATURED = [
  { label: 'Peluquería',          icon: '✂️',  cat: 'peluqueria' },
  { label: 'Manicura',            icon: '💅',  cat: 'manicura' },
  { label: 'Maquillaje',          icon: '💄',  cat: 'maquillaje' },
  { label: 'Cejas & Pestañas',    icon: '👁️',  cat: 'cejas' },
  { label: 'Tratamientos Capilares', icon: '💇‍♀️', cat: 'peinados' },
  { label: 'Depilación',          icon: '✨',  cat: 'depilacion' },
]

export default function ServicesSection() {
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  return (
    <section id="servicios" className="py-14 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-beauty-secondary text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Nuestros Servicios
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-beauty-text-dark mb-3">
            Nuestros Servicios
          </h2>
          <div className="gold-divider w-20 mx-auto mt-4" />
        </div>

        {/* Featured service icons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12">
          {FEATURED.map((item, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setSelectedCat(selectedCat === item.cat ? null : item.cat)}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all group cursor-pointer ${
                selectedCat === item.cat
                  ? 'border-beauty-secondary bg-beauty-bg shadow-card'
                  : 'border-beauty-primary/30 bg-beauty-bg/50 hover:border-beauty-primary hover:bg-beauty-bg'
              }`}
            >
              {/* Círculo con ícono */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all ${
                selectedCat === item.cat
                  ? 'border-beauty-secondary bg-white'
                  : 'border-beauty-primary/40 bg-white group-hover:border-beauty-primary'
              }`}>
                <span className="text-3xl">{item.icon}</span>
              </div>
              <p className={`font-medium text-sm text-center transition-colors ${
                selectedCat === item.cat ? 'text-beauty-secondary' : 'text-beauty-text'
              }`}>
                {item.label}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Service list — se muestra si hay categoría seleccionada */}
        {selectedCat && (() => {
          const servicios = SERVICIOS_DATA.filter(s => s.cat === selectedCat)
          const cat = CATEGORIAS.find(c => c.id === selectedCat)
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-10"
            >
              <h3 className="font-serif text-xl font-bold text-beauty-text-dark mb-4 text-center">
                {cat?.icono} {cat?.nombre}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {servicios.map((servicio, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-beauty-primary/30 p-5 shadow-card hover:shadow-card-hover transition-all">
                    <p className="font-semibold text-beauty-text-dark text-sm leading-tight mb-2">{servicio.nombre}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-beauty-primary/20">
                      <div className="flex items-center gap-1 text-beauty-text-muted">
                        <Clock size={12} />
                        <span className="text-xs">{servicio.duracion} min</span>
                      </div>
                      <div>
                        {servicio.tipo === 'fijo' && servicio.precio ? (
                          <span className="text-beauty-secondary font-bold text-sm">{formatCurrency(servicio.precio)}</span>
                        ) : servicio.tipo === 'desde' && servicio.precio_desde ? (
                          <span className="text-beauty-secondary font-bold text-sm">Desde {formatCurrency(servicio.precio_desde)}</span>
                        ) : (
                          <span className="text-beauty-text-muted text-xs italic">A consultar</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )
        })()}

        {/* CTA */}
        <div className="text-center mt-8">
          <a href="#reservar"
            className="bg-beauty-primary text-white font-semibold px-10 py-4 rounded-full text-sm hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center gap-2">
            Agenda tu Cita
          </a>
        </div>
      </div>
    </section>
  )
}
