'use client'

import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Phone, Clock, Instagram } from 'lucide-react'

const PLACE_ID   = 'ChIJ5X_5kGiDRo4RkW1pI9FPUGs'
const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`
const MAPS_URL   = 'https://maps.app.goo.gl/Zp81HQMAva6wmwUM7'
const EMBED_URL  = `https://maps.google.com/maps?q=Claudia+Agudelo+beauty+Sabaneta&output=embed&z=16&hl=es`

interface Review {
  author_name: string
  profile_photo_url: string
  rating: number
  relative_time_description: string
  text: string
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} viewBox="0 0 20 20" width={size} height={size}
          fill={i <= rating ? '#F4B400' : '#E0E0E0'}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  )
}

// Colores para avatares sin foto
const AVATAR_COLORS = ['#E8A87C','#85C1E9','#82E0AA','#C39BD3','#F1948A','#76D7C4','#F7DC6F']

function Avatar({ name, photo, size = 36 }: { name: string; photo?: string; size?: number }) {
  const [err, setErr] = useState(false)
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  if (photo && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name} onError={() => setErr(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} />
    )
  }
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 text-white font-bold"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating]   = useState(5)
  const [total, setTotal]     = useState(38)
  const [loading, setLoading] = useState(true)
  const [hasReviews, setHasReviews] = useState(false)
  const [current, setCurrent] = useState(0)
  const touchX = useRef(0)

  useEffect(() => {
    fetch('/api/resenas')
      .then(r => r.json())
      .then(d => {
        if (d.reviews?.length) {
          setReviews(d.reviews)
          setRating(d.rating ?? 5)
          setTotal(d.total ?? 38)
          setHasReviews(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxIdx = Math.max(0, reviews.length - 1)
  const prev = () => setCurrent(c => Math.max(0, c - 1))
  const next = () => setCurrent(c => Math.min(maxIdx, c + 1))

  return (
    <section id="testimonios" className="py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ── Título ───────────────────────────────────────────── */}
        <div className="mb-10">
          <p className="text-white/60 text-xs font-semibold tracking-[0.25em] uppercase mb-2 drop-shadow">
            ♥ Visítanos
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-white drop-shadow-lg leading-tight">
            Visítanos en{' '}
            <span className="italic" style={{ color: '#C5A675' }}>Sabaneta</span>
          </h2>
        </div>

        {/* ── Tres columnas ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_240px_1fr] gap-5 items-start">

          {/* ── Col 1: Tarjeta de reseñas Google ─────────────── */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col" style={{ minHeight: 380 }}>

            {/* Cabecera Google */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
              <GoogleIcon size={22} />
              <span className="font-bold text-gray-800 text-base tracking-tight">Google</span>
              <span className="font-bold text-gray-800 text-lg ml-1">{rating.toFixed(1)}</span>
              <Stars rating={Math.round(rating)} size={13} />
              <span className="text-gray-400 text-xs ml-auto">{total} reseñas</span>
            </div>

            {/* Lista de reseñas */}
            <div className="flex-1 overflow-hidden relative">
              {loading ? (
                <div className="p-5 space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                      <div className="h-2 bg-gray-100 rounded w-full mb-1" />
                      <div className="h-2 bg-gray-100 rounded w-5/6" />
                    </div>
                  ))}
                </div>
              ) : hasReviews ? (
                <>
                  {/* Carrusel vertical de reseñas */}
                  <div
                    className="transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateY(-${current * 108}px)` }}
                    onTouchStart={e => { touchX.current = e.touches[0].clientY }}
                    onTouchEnd={e => {
                      const d = touchX.current - e.changedTouches[0].clientY
                      if (Math.abs(d) > 30) d > 0 ? next() : prev()
                    }}
                  >
                    {reviews.map((r, i) => (
                      <div key={i} className="px-5 py-3 border-b border-gray-50">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar name={r.author_name} photo={r.profile_photo_url} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-800 font-semibold text-xs truncate">{r.author_name}</p>
                            <div className="flex items-center gap-2">
                              <Stars rating={r.rating} size={10} />
                              <span className="text-gray-400 text-[10px]">{r.relative_time_description}</span>
                            </div>
                          </div>
                        </div>
                        {r.text && (
                          <p className="text-gray-600 text-[11px] leading-relaxed line-clamp-2 pl-8">
                            &ldquo;{r.text}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Flechas */}
                  {reviews.length > 3 && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button onClick={prev} disabled={current === 0}
                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-30 transition-all">
                        <ChevronLeft size={12} className="text-gray-600" />
                      </button>
                      <button onClick={next} disabled={current === maxIdx}
                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-30 transition-all">
                        <ChevronRight size={12} className="text-gray-600" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Sin reseñas aún — placeholder elegante */
                <div className="p-5 space-y-3">
                  {[
                    { ini: 'M', name: 'Mariana R.', time: 'Hace 2 semanas', text: '¡Excelente atención y resultados! El lugar es hermoso y muy profesional.' },
                    { ini: 'A', name: 'Andréa C.', time: 'Hace 8 semanas', text: 'Muy buen servicio, ambiente relajante y personal super amable.' },
                    { ini: 'V', name: 'Valentina M.', time: 'Hace 3 meses', text: 'Me encantó la experiencia, sin duda volvere. Todo impecable.' },
                  ].map((t, i) => (
                    <div key={i} className="border-b border-gray-50 pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: AVATAR_COLORS[i] }}>
                          {t.ini}
                        </div>
                        <div>
                          <p className="text-gray-800 font-semibold text-xs">{t.name}</p>
                          <div className="flex items-center gap-1.5">
                            <Stars rating={5} size={10} />
                            <span className="text-gray-400 text-[10px]">{t.time}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-500 text-[11px] leading-relaxed pl-9 line-clamp-2">&ldquo;{t.text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer — botón ver todas */}
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer"
              className="mx-4 mb-4 mt-2 text-center py-2.5 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-all flex items-center justify-center gap-1.5">
              <GoogleIcon size={13} />
              Ver todas las reseñas en Google
            </a>
          </div>

          {/* ── Col 2: Info de contacto ───────────────────────── */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.15)',
              minHeight: 380,
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
                <a href="tel:+573022197673" className="text-white text-sm font-medium hover:text-beauty-champagne transition-colors">
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
                <a href="https://www.instagram.com/claudiaagudelobeauty" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-110"
                  style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
                  aria-label="Instagram">
                  <Instagram size={16} />
                </a>
                <a href="https://www.tiktok.com/@claudiaagudelobeauty" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white transition-all hover:scale-110"
                  aria-label="TikTok">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.01-.05z"/>
                  </svg>
                </a>
                <a href="https://www.facebook.com/share/14d4ZJDy6n8/" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white transition-all hover:scale-110"
                  aria-label="Facebook">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* CTA dejar reseña */}
            <a href={REVIEW_URL} target="_blank" rel="noopener noreferrer"
              className="mt-auto w-full text-center py-3 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg,#C5A675,#A8854F)', color: '#fff', boxShadow: '0 4px 16px rgba(197,166,117,0.3)' }}>
              ⭐ Escríbenos una reseña
            </a>
          </div>

          {/* ── Col 3: Mapa ──────────────────────────────────── */}
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
