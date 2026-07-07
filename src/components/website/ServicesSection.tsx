'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { Clock, ChevronDown } from 'lucide-react'

interface CatAPI  { id: string; nombre: string; icono: string; orden: number }
interface SvcAPI  {
  id: string; nombre: string
  tipo_precio: 'fijo' | 'desde' | 'valoracion'
  precio?: number | null; precio_desde?: number | null
  duracion_minutos: number; categoria_id: string
  categoria?: CatAPI
}

// Íconos fijos para las tarjetas de categoría destacada
const CAT_ICONS: Record<string, string> = {
  'Manicura y Pedicura': '💅', 'Maquillaje': '💄', 'Masajes': '💆‍♀️',
  'Limpieza Facial': '✨', 'Cejas y Pestañas': '👁️', 'Peinados': '💇‍♀️',
  'Barbería': '💈', 'Depilación Corporal': '🪒', 'Peluquería': '✂️', 'Podología': '🦶',
}

// Categorías que aparecen en la grilla de inicio (las 6 más relevantes)
const FEATURED_NAMES = [
  'Peluquería', 'Manicura y Pedicura', 'Maquillaje',
  'Cejas y Pestañas', 'Peinados', 'Depilación Corporal',
]

export default function ServicesSection() {
  const [categorias, setCategorias] = useState<CatAPI[]>([])
  const [servicios,  setServicios]  = useState<SvcAPI[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/categorias').then(r => r.json()),
      fetch('/api/servicios?activo=true').then(r => r.json()),
    ]).then(([cats, svcs]) => {
      if (Array.isArray(cats)) setCategorias(cats)
      if (Array.isArray(svcs)) setServicios(svcs)
    }).catch(() => {})
  }, [])

  const featured = categorias.filter(c => FEATURED_NAMES.includes(c.nombre))
  const selectedCat = categorias.find(c => c.id === selectedId)
  const svcsDecat = servicios.filter(s => s.categoria_id === selectedId)

  return (
    <section id="servicios" className="py-14 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        <div className="text-center mb-10 sm:mb-14">
          <p className="text-beauty-secondary text-xs sm:text-sm font-medium tracking-widest uppercase mb-3">♥ Nuestros Servicios</p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-beauty-text-dark mb-3">Nuestros Servicios</h2>
          <div className="gold-divider w-20 mx-auto mt-4" />
        </div>

        {/* Grid de categorías */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mb-8 sm:mb-12">
          {(featured.length ? featured : FEATURED_NAMES.map((n,i) => ({ id: String(i), nombre: n, icono: CAT_ICONS[n] ?? '✨', orden: i }))).map((cat, i) => (
            <motion.button key={cat.id}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              onClick={() => setSelectedId(selectedId === cat.id ? null : cat.id)}
              className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
                selectedId === cat.id
                  ? 'border-beauty-secondary bg-beauty-bg shadow-card'
                  : 'border-beauty-primary/30 bg-beauty-bg/50 hover:border-beauty-primary hover:bg-beauty-bg'
              }`}>
              <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-2 transition-all ${
                selectedId === cat.id ? 'border-beauty-secondary bg-white' : 'border-beauty-primary/40 bg-white'
              }`}>
                <span className="text-2xl sm:text-3xl">{CAT_ICONS[cat.nombre] ?? cat.icono ?? '✨'}</span>
              </div>
              <p className={`font-medium text-xs sm:text-sm text-center leading-tight transition-colors ${
                selectedId === cat.id ? 'text-beauty-secondary' : 'text-beauty-text'
              }`}>{cat.nombre}</p>
              {selectedId === cat.id && <ChevronDown size={14} className="text-beauty-secondary" />}
            </motion.button>
          ))}
        </div>

        {/* Lista de servicios de la categoría seleccionada */}
        {selectedId && selectedCat && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8 sm:mb-10">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-beauty-text-dark mb-4 text-center">
              {CAT_ICONS[selectedCat.nombre] ?? selectedCat.icono} {selectedCat.nombre}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {svcsDecat.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-beauty-primary/30 p-4 shadow-card hover:shadow-card-hover transition-all">
                  <p className="font-semibold text-beauty-text-dark text-sm leading-tight mb-2">{s.nombre}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-beauty-primary/20">
                    <div className="flex items-center gap-1 text-beauty-text-muted">
                      <Clock size={12} /><span className="text-xs">{s.duracion_minutos} min</span>
                    </div>
                    <div>
                      {s.tipo_precio === 'fijo' && s.precio ? (
                        <span className="text-beauty-secondary font-bold text-sm">{formatCurrency(s.precio)}</span>
                      ) : s.tipo_precio === 'desde' && s.precio_desde ? (
                        <span className="text-beauty-secondary font-bold text-sm">Desde {formatCurrency(s.precio_desde)}</span>
                      ) : (
                        <span className="text-beauty-text-muted text-xs italic">A consultar</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="text-center mt-6 sm:mt-8">
          <a href="#reservar" className="bg-beauty-primary text-white font-semibold px-8 sm:px-10 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center gap-2 min-h-[52px]">
            Agenda tu Cita
          </a>
        </div>
      </div>
    </section>
  )
}
