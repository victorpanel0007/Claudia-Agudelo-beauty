'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

const WA_LINK = 'https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0'

const IMG_MAP: Record<string, string> = {
  'Manicura y Pedicura':  '/servicios/manicura.png',
  'Maquillaje':           '/servicios/maquillaje.png',
  'Masajes':              '/servicios/masajes.png',
  'Limpieza Facial':      '/servicios/limpieza-facial.png',
  'Cejas y Pestañas':     '/servicios/cejas.png',
  'Peinados':             '/servicios/peinados.png',
  'Barbería':             '/servicios/barberia.png',
  'Depilación Corporal':  '/servicios/depilacion.png',
  'Peluquería':           '/servicios/peluqueria.png',
  'Podología':            '/servicios/podologia.png',
}

const PALETA = [
  'bg-pink-100','bg-pink-50','bg-yellow-50','bg-purple-50','bg-emerald-50',
  'bg-blue-50','bg-orange-50','bg-teal-50','bg-rose-50','bg-cyan-50',
]
const CIRCLE = [
  'bg-pink-300','bg-rose-300','bg-yellow-300','bg-purple-300','bg-emerald-300',
  'bg-blue-300','bg-orange-300','bg-teal-300','bg-rose-300','bg-cyan-300',
]

interface Categoria { id: string; nombre: string; icono: string; orden: number }
interface Props { categorias: Categoria[]; imagenesMap: Record<string, string> }

export default function ServicesSection({ categorias }: Props) {
  return (
    <section id="servicios" className="py-16 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="text-center mb-12">
          <p className="text-beauty-secondary text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3">♥ Lo que ofrecemos</p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-beauty-text-dark mb-4">
            Nuestros <span className="text-beauty-primary">Servicios</span>
          </h2>
          <p className="text-beauty-text-muted text-sm sm:text-base max-w-md mx-auto">
            Especialistas en belleza con años de experiencia. Todo lo que necesitas en un solo lugar.
          </p>
          <div className="gold-divider w-20 mx-auto mt-5" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map((cat, i) => {
            const localImg  = IMG_MAP[cat.nombre] ?? null
            const bgColor   = PALETA[i % PALETA.length]
            const circleClr = CIRCLE[i % CIRCLE.length]

            return (
              <motion.a
                key={cat.id}
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05 }}
                className={`relative overflow-hidden rounded-2xl cursor-pointer group hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 min-h-[110px] ${localImg ? '' : bgColor}`}
                style={localImg ? { aspectRatio: '16/7' } : {}}
              >
                {localImg ? (
                  /* ── Imagen completa sin nada encima ── */
                  <>
                    <Image
                      src={localImg}
                      alt={cat.nombre}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {/* Flecha aparece solo al hover */}
                    <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-beauty-primary/90 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </div>
                  </>
                ) : (
                  /* ── Sin imagen: pastel con logo y texto ── */
                  <div className="flex flex-row items-center h-full">
                    <div className="shrink-0 w-[90px] flex items-center justify-center py-4 pl-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden shadow-md border-2 border-white">
                        <Image src="/logo.png" alt="Logo" width={64} height={64} className="w-full h-full object-cover" sizes="64px" />
                      </div>
                    </div>
                    <div className="flex-1 py-4 pr-10 min-w-0">
                      <h3 className="font-bold text-gray-800 text-sm leading-snug mb-1">{cat.nombre}</h3>
                      <p className="text-gray-500 text-xs">Toca para agendar tu cita →</p>
                    </div>
                    <div className={`w-20 h-20 rounded-full ${circleClr} opacity-30 absolute -right-4 bottom-0`} />
                    <div className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-beauty-primary/80 flex items-center justify-center shadow-sm">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </div>
                  </div>
                )}
              </motion.a>
            )
          })}
        </div>

        <div className="text-center mt-12">
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            className="bg-beauty-primary text-white font-semibold px-10 py-4 rounded-full text-base hover:bg-beauty-primary-dark transition-all shadow-beauty hover:shadow-beauty-lg inline-flex items-center gap-2">
            💅 Apartar Cita
          </a>
        </div>
      </div>
    </section>
  )
}
