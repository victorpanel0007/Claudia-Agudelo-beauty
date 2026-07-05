'use client'

import { MapPin, Phone, Clock, Instagram, Facebook } from 'lucide-react'

export default function ContactSection() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '3022197673'

  return (
    <section id="contacto" className="py-14 sm:py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-beauty-secondary text-xs sm:text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Contacto
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-beauty-text-dark mb-2">
            Encuéntranos &{' '}
            <span className="text-beauty-primary">Contáctanos</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">

          {/* Left: info */}
          <div className="space-y-5 sm:space-y-6">
            {/* Location */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-beauty-rosa-claro border border-beauty-primary/30 flex items-center justify-center shrink-0">
                <MapPin className="text-beauty-primary" size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-beauty-text-dark mb-1">Ubicación</h4>
                <p className="text-beauty-text text-sm">Colombia</p>
                <p className="text-beauty-text-muted text-xs mt-0.5">Agenda tu cita y te enviamos la dirección exacta</p>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-beauty-rosa-claro border border-beauty-primary/30 flex items-center justify-center shrink-0">
                <Phone className="text-beauty-primary" size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-beauty-text-dark mb-1">WhatsApp</h4>
                <a href={`https://wa.me/57${waNumber}?text=Hola`} target="_blank" rel="noopener noreferrer"
                  className="text-beauty-secondary hover:underline text-sm font-medium inline-block py-1">
                  +57 {waNumber}
                </a>
                <p className="text-beauty-text-muted text-xs mt-0.5">Respuesta inmediata</p>
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-beauty-rosa-claro border border-beauty-primary/30 flex items-center justify-center shrink-0">
                <Clock className="text-beauty-primary" size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-beauty-text-dark mb-1">Horario</h4>
                <div className="text-sm text-beauty-text space-y-0.5">
                  <p>Lunes — Viernes: 9:00 AM — 7:00 PM</p>
                  <p>Sábado: 9:00 AM — 7:00 PM</p>
                  <p className="text-beauty-text-muted">Domingo: Cerrado</p>
                </div>
              </div>
            </div>

            {/* Social — larger tap targets */}
            <div className="flex gap-3 pt-1 flex-wrap">
              <a href="https://www.instagram.com/claudiaagudelobeauty" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-sm">
                <Instagram size={20} />
              </a>
              <a href="https://www.facebook.com/share/14d4ZJDy6n8/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-sm">
                <Facebook size={20} />
              </a>
              <a href="https://www.tiktok.com/@claudiaagudelobeauty0" target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-white hover:scale-110 transition-transform shadow-sm">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/>
                </svg>
              </a>
              <a href={`https://wa.me/57${waNumber}?text=Hola`} target="_blank" rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-sm">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            </div>

            {/* Mobile CTA */}
            <div className="lg:hidden pt-2">
              <a href="#reservar"
                className="bg-beauty-primary text-white font-semibold px-8 py-4 rounded-full text-base flex items-center justify-center gap-2 min-h-[52px] shadow-beauty hover:bg-beauty-primary-dark transition-all">
                💅 Agenda tu Cita Ahora
              </a>
            </div>
          </div>

          {/* Right: map */}
          <div className="rounded-2xl overflow-hidden border border-beauty-primary/25 shadow-card flex flex-col">
            <div className="relative w-full">
              <iframe
                src="https://maps.google.com/maps?q=Claudia+Agudelo+Beauty&output=embed&z=15"
                width="100%"
                height="280"
                style={{ border: 0, display: 'block' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Claudia Agudelo Beauty - Ubicación"
              />
            </div>
            <div className="bg-beauty-bg p-4 text-center border-t border-beauty-primary/20">
              <a
                href="https://maps.app.goo.gl/Zp81HQMAva6wmwUM7"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-beauty-primary text-white font-semibold px-6 py-3 rounded-full text-sm inline-flex items-center gap-2 hover:bg-beauty-primary-dark transition-all min-h-[48px]"
              >
                <MapPin size={14} /> Ver en Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
