'use client'

import { motion } from 'framer-motion'
import { Tag, Clock } from 'lucide-react'

const promotions = [
  {
    title: '2x1 en Manicura',
    description: 'Ven con una amiga y pagan solo una. Todos los lunes y martes.',
    discount: '50%',
    validUntil: 'Tiempo limitado',
    accent: 'border-beauty-primary',
    badgeColor: 'bg-beauty-primary',
  },
  {
    title: 'Combo Spa',
    description: 'Masaje de relajación + Limpieza facial + Manicura. El paquete completo.',
    discount: 'Paquete',
    validUntil: 'Disponible siempre',
    accent: 'border-beauty-secondary/50',
    badgeColor: 'bg-beauty-secondary',
  },
  {
    title: 'Novia Completa',
    description: 'Maquillaje + Peinado + Manicura y Pedicura. Tu día especial merece lo mejor.',
    discount: 'Pack',
    validUntil: 'Reserva con anticipación',
    accent: 'border-beauty-sage/50',
    badgeColor: 'bg-beauty-sage',
  },
]

export default function PromotionsSection() {
  return (
    <section id="promociones" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-beauty-secondary text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Promociones
          </p>
          <h2 className="font-serif text-4xl font-bold text-beauty-text-dark mb-2">
            Ofertas <span className="text-beauty-primary">Especiales</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {promotions.map((promo, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white rounded-2xl border-2 ${promo.accent} p-6 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden`}
            >
              {/* Badge */}
              <div className="absolute top-4 right-4">
                <span className={`${promo.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                  {promo.discount}
                </span>
              </div>

              <Tag size={22} className="text-beauty-secondary mb-3" />
              <h3 className="font-serif font-bold text-beauty-text-dark text-xl mb-2">{promo.title}</h3>
              <p className="text-beauty-text-muted text-sm mb-4 leading-relaxed">{promo.description}</p>

              <div className="flex items-center gap-2 text-beauty-text-muted text-xs mb-5">
                <Clock size={12} />
                <span>{promo.validUntil}</span>
              </div>

              <a href="#reservar"
                className="bg-beauty-primary text-white font-semibold py-2.5 rounded-full text-sm w-full text-center block hover:bg-beauty-primary-dark transition-all">
                Reservar
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
