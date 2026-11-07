'use client'

import { useEffect } from 'react'
import { MapPin, Phone, Clock, Instagram } from 'lucide-react'

const PLACE_ID   = 'ChIJ5X_5kGiDRo4RkW1pI9FPUGs'
const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`
const MAPS_URL   = 'https://maps.app.goo.gl/Zp81HQMAva6wmwUM7'
const EMBED_URL  = `https://maps.google.com/maps?q=Claudia+Agudelo+beauty+Sabaneta&output=embed&z=16&hl=es`

export default function TestimonialsSection() {
  // Cargar el script de Elfsight una sola vez
  useEffect(() => {
    if (document.querySelector('script[src*="elfsightcdn.com/platform.js"]')) return
    const script = document.createElement('script')
    script.src = 'https://elfsightcdn.com/platform.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  return (
    <section id="testimonios" className="py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-white/80 text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3 drop-shadow">
            ♥ Opiniones
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg">
            Lo que dicen nuestros{' '}
            <span className="text-beauty-champagne">clientes</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        {/* ── Widget Elfsight — reseñas reales de Google ───────── */}
        <div className="rounded-2xl overflow-hidden mb-6">
          <div
            className="elfsight-app-45296987-7d0d-4e25-8d63-35aecc11a68e"
            data-elfsight-app-lazy
          />
        </div>

        {/* Botón dejar reseña */}
        <div className="text-center mb-14">
          <a
            href={REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold px-8 py-3.5 rounded-full text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, #C5A675, #A8854F)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(197,166,117,0.3)',
            }}
          >
            ⭐ Escríbenos una reseña en Google
          </a>
        </div>

        {/* ── Título Visítanos ──────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-white/60 text-xs font-semibold tracking-[0.25em] uppercase mb-2 drop-shadow">
            ♥ Visítanos
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-white drop-shadow-lg leading-tight">
            Visítanos en{' '}
            <span className="italic" style={{ color: '#C5A675' }}>Sabaneta</span>
          </h2>
        </div>

        {/* ── Tres columnas: info + redes + mapa ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">

          {/* ── Col izquierda: contacto + redes ──────────────── */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {/* Dirección */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(197,166,117,0.2)', border: '1px solid rgba(197,166,117,0.3)' }}>
                <MapPin size={15} style={{ color: '#C5A675' }} />
              </div>
              <div>
                <p className="text-white/50 text-[10px] font-semibold tracking-widest uppercase mb-1">Dirección</p>
                <p className="text-white text-sm leading-snug font-medium">Cl. 74 Sur #46-48</p>
                <p className="text-white/70 text-xs">Sabaneta, Antioquia</p>
              </div>
            </div>

            {/* Teléfono */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(197,166,117,0.2)', border: '1px solid rgba(197,166,117,0.3)' }}>
                <Phone size={15} style={{ color: '#C5A675' }} />
              </div>
              <div>
                <p className="text-white/50 text-[10px] font-semibold tracking-widest uppercase mb-1">Teléfono</p>
                <a href="tel:+573022197673"
                  className="text-white text-sm font-medium hover:text-beauty-champagne transition-colors">
                  302 219 7673
                </a>
              </div>
            </div>

            {/* Horario */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(197,166,117,0.2)', border: '1px solid rgba(197,166,117,0.3)' }}>
                <Clock size={15} style={{ color: '#C5A675' }} />
              </div>
              <div>
                <p className="text-white/50 text-[10px] font-semibold tracking-widest uppercase mb-1">Horario</p>
                <p className="text-white text-sm font-medium">Lun – Sáb</p>
                <p className="text-white/70 text-xs">9:00 a. m. – 7:00 p. m.</p>
                <p className="text-white/40 text-xs mt-0.5">Dom: Cerrado</p>
              </div>
            </div>

            {/* Divisor */}
            <div className="h-px w-full" style={{ background: 'rgba(197,166,117,0.2)' }} />

            {/* Redes sociales */}
            <div>
              <p className="text-white/50 text-[10px] font-semibold tracking-widest uppercase mb-3">Síguenos</p>
              <div className="flex gap-2">
                <a href="https://www.instagram.com/claudiaagudelobeauty"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-110"
                  style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
                  aria-label="Instagram">
                  <Instagram size={16} />
                </a>
                <a href="https://www.tiktok.com/@claudiaagudelobeauty"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white transition-all hover:scale-110"
                  aria-label="TikTok">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.01-.05z"/>
                  </svg>
                </a>
                <a href="https://www.facebook.com/share/14d4ZJDy6n8/"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white transition-all hover:scale-110"
                  aria-label="Facebook">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://api.whatsapp.com/send/?phone=573022197673"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-white transition-all hover:scale-110"
                  aria-label="WhatsApp">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Ver en Google Maps */}
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer"
              className="w-full text-center py-2.5 rounded-xl text-xs font-medium text-white/60 hover:text-white border border-white/15 hover:border-white/30 transition-all">
              Ver en Google Maps →
            </a>
          </div>

          {/* ── Col derecha: Mapa ─────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: 380 }}>
            <iframe
              src={EMBED_URL}
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block', minHeight: 380 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Claudia Agudelo Beauty — Ubicación en Sabaneta"
            />
          </div>

        </div>
      </div>
    </section>
  )
}
