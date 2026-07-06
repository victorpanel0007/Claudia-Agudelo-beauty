'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  { name: 'María González',   service: 'Manicura Semipermanente', rating: 5, text: 'Claudia es una artista. Mis uñas quedaron perfectas, el detalle y el cuidado que pone en cada trabajo es increíble. ¡Siempre vuelvo!', initials: 'MG' },
  { name: 'Valentina Torres', service: 'Maquillaje Social',       rating: 5, text: 'Claudia tiene un talento único, supo exactamente lo que quería y el resultado superó mis expectativas. Me sentí hermosa todo el día.', initials: 'VT' },
  { name: 'Laura Martínez',   service: 'Masaje de Relajación',   rating: 5, text: 'El masaje con Claudia fue espectacular. Salí completamente renovada y relajada. Sin duda la mejor profesional que he visitado.', initials: 'LM' },
  { name: 'Sofía Ramírez',    service: 'Lifting de Pestañas',     rating: 5, text: 'Claudia logró un resultado natural y duradero que enamoré. Ya no necesito pestañina. Su trabajo habla por sí solo. 100% recomendada.', initials: 'SR' },
  { name: 'Catalina López',   service: 'Keratina',                rating: 5, text: 'Mi cabello nunca había lucido tan bien gracias a Claudia. La keratina duró más de 3 meses impecable. ¡Volveré siempre con ella!', initials: 'CL' },
  { name: 'Daniela Herrera',  service: 'Peinado de Novia',        rating: 5, text: 'Para mi boda confié en Claudia y fue la mejor decisión de mi vida. Profesional, puntual, talentosa y con un trato muy especial.', initials: 'DH' },
]

export default function TestimonialsSection() {
  return (
    <section id="testimonios" className="py-14 sm:py-20 bg-beauty-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-beauty-secondary text-xs sm:text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Testimonios
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-beauty-text-dark mb-2">
            Lo que Dicen <span className="text-beauty-primary">Nuestras Clientas</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        {/* 1 col on mobile, 2 on sm, 3 on lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '100px' }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl border border-beauty-primary/25 p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-all"
            >
              <Quote size={18} className="text-beauty-primary/40 mb-3" />
              <p className="text-beauty-text text-sm leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>

              <div className="flex items-center gap-3 pt-3 border-t border-beauty-primary/20">
                <div className="w-10 h-10 rounded-full bg-beauty-primary flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs">{t.initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-beauty-text-dark text-sm truncate">{t.name}</p>
                  <p className="text-beauty-text-muted text-xs truncate">{t.service}</p>
                  <div className="flex gap-0.5 mt-1">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={11} className={j < t.rating ? 'text-beauty-secondary fill-beauty-secondary' : 'text-beauty-primary/30'} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
