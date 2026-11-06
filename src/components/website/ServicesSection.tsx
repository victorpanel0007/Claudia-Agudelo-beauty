'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'

export default function ServicesSection() {
  const reducedMotion = useReducedMotion()

  const fade = reducedMotion
    ? {}
    : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } }

  const slideLeft = reducedMotion
    ? {}
    : { initial: { opacity: 0, x: -32 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true, margin: '-60px' } }

  const slideRight = reducedMotion
    ? {}
    : { initial: { opacity: 0, x: 32 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true, margin: '-60px' } }

  return (
    <section id="servicios" className="py-16 sm:py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Etiqueta superior */}
        <motion.p
          {...fade}
          transition={{ duration: 0.6 }}
          className="text-center text-white/70 text-xs font-semibold tracking-[0.3em] uppercase mb-10 drop-shadow"
        >
          ✦ Sobre Nosotros ✦
        </motion.p>

        {/* Composición principal: foto izquierda + texto derecha */}
        <div className="flex flex-col lg:flex-row items-stretch gap-0 lg:gap-0 rounded-3xl overflow-hidden shadow-2xl">

          {/* ── Fotografía ─────────────────────────────────────────────── */}
          <motion.div
            {...slideLeft}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative w-full lg:w-[48%] min-h-[380px] sm:min-h-[480px] lg:min-h-[580px] flex-shrink-0"
          >
            <Image
              src="/Claudia.png"
              alt="Claudia Agudelo — Fundadora de Claudia Agudelo Beauty"
              fill
              className="object-cover object-top"
              sizes="(max-width: 1024px) 100vw, 48vw"
              priority
            />
            {/* Gradiente lateral para fusionar con el texto en desktop */}
            <div className="hidden lg:block absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-black/40 pointer-events-none" />
            {/* Gradiente inferior en móvil */}
            <div className="lg:hidden absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          </motion.div>

          {/* ── Bloque de texto ────────────────────────────────────────── */}
          <motion.div
            {...slideRight}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.15 }}
            className="relative flex-1 flex items-center"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            {/* Textura dorada sutil de fondo */}
            <div
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                background: 'linear-gradient(135deg, #C5A675 0%, transparent 60%)',
              }}
            />

            <div className="relative z-10 px-8 sm:px-10 lg:px-12 py-10 sm:py-14 lg:py-16">

              {/* Línea dorada decorativa */}
              <div
                className="w-12 h-px mb-6"
                style={{ background: 'linear-gradient(90deg, #C5A675, transparent)' }}
              />

              {/* Título H2 editorial */}
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.6rem] font-bold leading-tight mb-6 drop-shadow-lg">
                <span className="text-white">Un espacio para ti,</span>
                <br />
                <span
                  className="italic"
                  style={{ color: '#C5A675' }}
                >
                  un momento para brillar.
                </span>
              </h2>

              {/* Texto descriptivo */}
              <div className="space-y-4 mb-8">
                <p className="text-white/85 text-sm sm:text-base leading-relaxed">
                  En <strong className="text-white font-semibold">Claudia Agudelo Beauty</strong> creemos
                  que la belleza comienza cuando te regalas un momento para ti. Creamos un espacio donde
                  el cuidado, la calidez y la atención a cada detalle se unen para que te sientas especial.
                </p>
                <p className="text-white/85 text-sm sm:text-base leading-relaxed">
                  Más que un lugar para realzar tu belleza, somos un refugio para desconectarte de la rutina,
                  reconectar contigo y disfrutar de una experiencia pensada para tu bienestar.
                </p>
              </div>

              {/* Línea dorada divisora */}
              <div
                className="w-full h-px mb-6 opacity-30"
                style={{ background: 'linear-gradient(90deg, #C5A675, transparent)' }}
              />

              {/* Frase final */}
              <p
                className="font-serif text-base sm:text-lg italic leading-relaxed"
                style={{ color: '#C5A675' }}
              >
                &ldquo;Tu esencia es única. Nuestro propósito es ayudarte a brillar.&rdquo;
              </p>

              {/* CTA */}
              <div className="mt-8">
                <a
                  href="https://api.whatsapp.com/send/?phone=573022197673&text=Hola%21+Me+gustar%C3%ADa+agendar+una+cita+%EF%BF%BD&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold px-8 py-3.5 rounded-full text-sm transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #C5A675, #A8854F)',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(197,166,117,0.35)',
                  }}
                >
                  💅 Agenda tu cita
                </a>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
