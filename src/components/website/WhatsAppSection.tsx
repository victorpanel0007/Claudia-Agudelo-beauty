'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

// Simulated conversation flow
const CONVERSATION_STEPS = [
  {
    id: 'welcome',
    direction: 'in',
    text: 'Hola',
    delay: 0,
  },
  {
    id: 'menu',
    direction: 'out',
    text: `🤖 *MENÚ PRINCIPAL*

¡Hola! 👋 Bienvenido(a) a *Claudia Agudelo Beauty* 💖

Por favor responde con el número del servicio que deseas:

1️⃣ Manicura y Pedicura
2️⃣ Maquillaje
3️⃣ Masajes
4️⃣ Limpieza Facial
5️⃣ Cejas y Pestañas
6️⃣ Peinados
7️⃣ Barbería
8️⃣ Depilación Corporal
9️⃣ Peluquería`,
    delay: 600,
  },
  {
    id: 'cat-select',
    direction: 'in',
    text: '1',
    delay: 1400,
  },
  {
    id: 'services',
    direction: 'out',
    text: `💅 *MANICURA Y PEDICURA*

1️⃣ Manos tradicionales — $24.000
2️⃣ Pies tradicionales — $24.000
3️⃣ Manos y pies tradicionales — $45.000
4️⃣ Manos semipermanente — $46.000
5️⃣ Manos y pies semipermanente — $82.000
...

✍️ Escribe el número del servicio`,
    delay: 2000,
  },
  {
    id: 'serv-select',
    direction: 'in',
    text: '4',
    delay: 3000,
  },
  {
    id: 'ask-name',
    direction: 'out',
    text: `💅 *Manos semipermanente*\n\n💵 Precio: *$46.000*\n⏱️ Duración: 90 min\n\n✍️ Por favor escribe tu *nombre completo*:`,
    delay: 3600,
  },
  {
    id: 'name',
    direction: 'in',
    text: 'María González',
    delay: 4600,
  },
  {
    id: 'ask-date',
    direction: 'out',
    text: `👋 Hola *María González*!\n\n📅 ¿Qué fecha prefieres?\n\nFormato: *DD/MM/AAAA*\nEjemplo: 15/07/2025`,
    delay: 5200,
  },
  {
    id: 'date',
    direction: 'in',
    text: '20/06/2025',
    delay: 6200,
  },
  {
    id: 'ask-specialist',
    direction: 'out',
    text: `📅 Fecha: *Viernes 20 de junio de 2025*\n\n👩 ¿Qué especialista prefieres?\n\n1️⃣ Claudia\n2️⃣ Andrea\n3️⃣ Cualquiera disponible`,
    delay: 6800,
  },
  {
    id: 'specialist',
    direction: 'in',
    text: '3',
    delay: 7800,
  },
  {
    id: 'slots',
    direction: 'out',
    text: `🕐 *Horarios disponibles* para Viernes 20 jun:\n\n1️⃣ 09:00 AM — Claudia\n2️⃣ 10:30 AM — Andrea\n3️⃣ 11:00 AM — Claudia\n4️⃣ 02:00 PM — Andrea\n\n✍️ Escribe el número del horario:`,
    delay: 8400,
  },
  {
    id: 'slot-select',
    direction: 'in',
    text: '2',
    delay: 9400,
  },
  {
    id: 'confirm',
    direction: 'out',
    text: `✅ *Cita reservada correctamente*

👤 Cliente: *María González*
💅 Servicio: *Manos semipermanente*
👩 Especialista: *Andrea*
📅 Fecha: *Viernes 20 de junio de 2025*
⏰ Hora: *10:30 AM*
💵 Valor: *$46.000*

Gracias por elegir *Claudia Agudelo Beauty* 💖`,
    delay: 10000,
  },
]

const FEATURES = [
  {
    icon: '🤖',
    title: 'Recepcionista Virtual 24/7',
    desc: 'Atiende a tus clientas en cualquier momento del día, sin intervención manual.',
  },
  {
    icon: '📅',
    title: 'Agenda Automática',
    desc: 'Detecta horarios libres, evita conflictos y bloquea el espacio en tiempo real.',
  },
  {
    icon: '💬',
    title: 'Confirmación Instantánea',
    desc: 'La cita se guarda en Supabase y aparece en el panel admin inmediatamente.',
  },
  {
    icon: '⏰',
    title: 'Recordatorios Automáticos',
    desc: 'Envía recordatorio 24h y 2h antes de cada cita sin que hagas nada.',
  },
  {
    icon: '👩',
    title: 'Selección de Especialista',
    desc: 'La clienta elige a Claudia, Andrea o la primera disponible automáticamente.',
  },
  {
    icon: '💵',
    title: 'Precios Inteligentes',
    desc: 'Muestra precio fijo, precio desde, o solicita valoración según el servicio.',
  },
]

function WhatsAppBubble({
  message,
  visible,
}: {
  message: (typeof CONVERSATION_STEPS)[0]
  visible: boolean
}) {
  if (!visible) return null
  const isOut = message.direction === 'out'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isOut ? 'justify-start' : 'justify-end'} mb-2`}
    >
      {isOut && (
        <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center mr-2 mt-auto shrink-0">
          <span className="text-white text-xs font-bold">CA</span>
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-sm ${
          isOut
            ? 'bg-white text-gray-800 rounded-tl-sm'
            : 'bg-[#DCF8C6] text-gray-800 rounded-tr-sm'
        }`}
      >
        {message.text.split('*').map((part, i) =>
          i % 2 === 1
            ? <strong key={i}>{part}</strong>
            : <span key={i}>{part}</span>
        )}
        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOut ? 'text-gray-400 justify-start' : 'text-gray-400 justify-end'}`}>
          {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          {!isOut && <span className="text-blue-400">✓✓</span>}
        </div>
      </div>
    </motion.div>
  )
}

export default function WhatsAppSection() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [running, setRunning] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [])

  function startDemo() {
    if (running) return
    setRunning(true)
    setVisibleCount(0)
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    CONVERSATION_STEPS.forEach((step, i) => {
      const t = setTimeout(() => setVisibleCount(i + 1), step.delay)
      timersRef.current.push(t)
    })

    const reset = setTimeout(() => {
      setRunning(false)
    }, CONVERSATION_STEPS[CONVERSATION_STEPS.length - 1].delay + 3000)
    timersRef.current.push(reset)
  }

  return (
    <section id="whatsapp" className="py-20 bg-beauty-bg overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-beauty-secondary text-sm font-medium tracking-widest uppercase mb-3">
            WhatsApp Automático
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-beauty-text-dark mb-4">
            Tu Recepcionista Virtual
            <span className="block text-beauty-primary">Inteligente 🤖</span>
          </h2>
          <p className="text-beauty-text text-base max-w-xl mx-auto">
            El bot atiende, agenda y confirma citas por WhatsApp de forma completamente automática,
            sincronizando todo en tiempo real con el panel administrativo.
          </p>
          <div className="gold-divider w-24 mx-auto mt-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Phone frame */}
              <div className="w-72 bg-[#111B21] rounded-[2.5rem] shadow-2xl border-4 border-gray-700 overflow-hidden">
                {/* Status bar */}
                <div className="bg-[#1F2C34] px-5 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">CA</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-xs font-semibold">Claudia Agudelo Beauty</p>
                    <p className="text-green-400 text-[10px]">en línea</p>
                  </div>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>

                {/* Chat area */}
                <div
                  className="bg-[#0B141A] h-[480px] overflow-y-auto p-3 flex flex-col"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='200' height='200' fill='%230B141A'/%3E%3C/svg%3E")`,
                  }}
                >
                  {visibleCount === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <button
                        onClick={startDemo}
                        className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-5 py-3 rounded-full transition-all flex items-center gap-2 shadow-lg"
                      >
                        <span>▶</span> Ver demo en vivo
                      </button>
                    </div>
                  )}

                  {CONVERSATION_STEPS.slice(0, visibleCount).map(step => (
                    <WhatsAppBubble key={step.id} message={step} visible />
                  ))}

                  {running && visibleCount < CONVERSATION_STEPS.length && (
                    <div className="flex justify-start mb-2">
                      <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-gray-400">
                        <span className="animate-pulse">escribiendo...</span>
                      </div>
                    </div>
                  )}

                  {visibleCount >= CONVERSATION_STEPS.length && (
                    <div className="text-center mt-4">
                      <button
                        onClick={() => { setVisibleCount(0); setRunning(false) }}
                        className="text-green-400 text-xs underline"
                      >
                        ↺ Repetir demo
                      </button>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="bg-[#1F2C34] px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 bg-[#2A3942] rounded-full px-3 py-1.5 text-[11px] text-gray-500">
                    Escribe un mensaje...
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Sync badge */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -right-4 top-1/3 bg-beauty-secondary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-beauty"
              >
                ⚡ Sync en tiempo real
              </motion.div>
            </div>
          </div>

          {/* Features grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white border border-beauty-primary/25 hover:border-beauty-secondary/50 rounded-2xl p-4 transition-all shadow-card"
                >
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h4 className="text-beauty-text-dark font-semibold text-sm mb-1">{f.title}</h4>
                  <p className="text-beauty-text-muted text-xs leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Flow steps */}
            <div className="bg-white border border-beauty-primary/20 rounded-2xl p-5 shadow-card">
              <h4 className="text-beauty-secondary font-semibold text-sm mb-4">
                Flujo completo de reserva
              </h4>
              <div className="space-y-3">
                {[
                  { n: '1', label: 'Clienta escribe "Hola"', sub: 'Activa el menú automáticamente' },
                  { n: '2', label: 'Elige categoría y servicio', sub: 'Navega por las 9 categorías' },
                  { n: '3', label: 'Ingresa nombre y fecha', sub: 'Conversación guiada paso a paso' },
                  { n: '4', label: 'Elige especialista', sub: 'Claudia, Andrea o cualquier disponible' },
                  { n: '5', label: 'Selecciona horario', sub: 'Solo muestra horas realmente libres' },
                  { n: '6', label: 'Cita confirmada ✅', sub: 'Guardada en Supabase + aparece en admin' },
                ].map((step) => (
                  <div key={step.n} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-beauty-secondary/15 border border-beauty-secondary/40 flex items-center justify-center shrink-0">
                      <span className="text-beauty-secondary text-xs font-bold">{step.n}</span>
                    </div>
                    <div>
                      <p className="text-beauty-text-dark text-xs font-medium">{step.label}</p>
                      <p className="text-beauty-text-muted text-[11px]">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
