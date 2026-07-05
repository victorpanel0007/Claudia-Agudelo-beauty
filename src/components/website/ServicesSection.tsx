'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { formatCurrency } from '@/lib/utils'
import { Clock, ChevronDown } from 'lucide-react'

const FEATURED = [
  { label: 'Peluquería',             icon: '✂️',  cat: 'peluqueria' },
  { label: 'Manicura',               icon: '💅',  cat: 'manicura' },
  { label: 'Maquillaje',             icon: '💄',  cat: 'maquillaje' },
  { label: 'Cejas & Pestañas',       icon: '👁️',  cat: 'cejas' },
  { label: 'Tratamientos Capilares', icon: '💇‍♀️', cat: 'peinados' },
  { label: 'Depilación',             icon: '✨',  cat: 'depilacion' },
]

export default function ServicesSection() {
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  return (
    <section id="servicios" className="py-14 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-beauty-secondary text-xs sm:text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Nuestros Servicios
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-beauty-text-dark mb-3">
            Nuestros Servicios
          </h2>
          <div className="gold-divider w-20 mx-auto mt-4" />
        </div>

        {/* Featured service icons grid — 2 cols on mobile, 3 on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mb-8 sm:mb-12">
          {FEATURED.map((item, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setSelectedCat(selectedCat === item.cat ? null : item.cat)}
              className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
                selectedCat === item.cat
                  ? 'border-beauty-secondary bg-beauty-bg shadow-card'
                  : 'border-beauty-primary/30 bg-beauty-bg/50 hover:border-beauty-primary hover:bg-beauty-bg'
              }`}
              aria-pressed={selectedCat === item.cat}
            >
              {/* Icon circle */}
              <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-2 transition-all ${
                selectedCat === item.cat
                  ? 'border-beauty-secondary bg-white'
                  : 'border-beauty-primary/40 bg-white'
              }`}>
                <span className="text-2xl sm:text-3xl">{item.icon}</span>
              </div>
              <p className={`font-medium text-xs sm:text-sm text-center leading-tight transition-colors ${
                selectedCat === item.cat ? 'text-beauty-secondary' : 'text-beauty-text'
              }`}>
                {item.label}
              </p>
              {selectedCat === item.cat && (
                <ChevronDown size={14} className="text-beauty-secondary" />
              )}
            </motion.button>
          ))}
        </div>

        {/* Service list — shown when a category is selected */}
        {selectedCat && (() => {
          const servicios = SERVICIOS_DATA.filter(s => s.cat === selectedCat)
          const cat = CATEGORIAS.find(c => c.id === selectedCat)
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 sm:mb-10"
            >
              <h3 className="font-serif text-lg sm:text-xl font-bold text-beauty-text-dark mb-4 text-center">
                {cat?.icono} {cat?.nombre}
              </h3>
              {/* 1 col on mobile, 2 on sm, 3 on lg */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {servicios.map((servicio, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-beauty-primary/30 p-4 shadow-card hover:shadow-card-hover transition-all">
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
        <div className="text-center mt-6 sm:mt-8">
          <a href="#reservar"
            className="bg-beauty-primary text-white font-semibold px-8 sm:px-10 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center gap-2 min-h-[52px]">
            Agenda tu Cita
          </a>
        </div>
      </div>
    </section>
  )
}
