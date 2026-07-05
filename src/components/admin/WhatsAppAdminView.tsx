'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare, Phone, Send, RefreshCw, CheckCircle,
  Circle, Clock, Users, Zap, Settings, ChevronRight,
} from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Mensaje {
  id: string
  telefono: string
  mensaje: string
  fecha: string
  tipo: 'entrante' | 'saliente' | 'sistema'
  cliente?: { nombre: string }
}

interface ConvGroup {
  telefono: string
  nombre: string
  mensajes: Mensaje[]
  ultimo: string
  noLeidos: number
}

const FLUJO_STEPS = [
  { paso: 1, trigger: 'Hola / inicio', respuesta: 'Menú principal con 9 categorías', icono: '👋' },
  { paso: 2, trigger: 'Número de categoría (1-9)', respuesta: 'Lista de servicios con precios', icono: '📋' },
  { paso: 3, trigger: 'Número de servicio', respuesta: 'Precio, duración y solicita nombre', icono: '💅' },
  { paso: 4, trigger: 'Nombre completo', respuesta: 'Solicita fecha (DD/MM/AAAA)', icono: '👤' },
  { paso: 5, trigger: 'Fecha', respuesta: 'Muestra especialistas disponibles', icono: '📅' },
  { paso: 6, trigger: 'Especialista (1/2/3)', respuesta: 'Muestra horarios libres', icono: '👩' },
  { paso: 7, trigger: 'Número de horario', respuesta: 'Cita confirmada + guardada en DB', icono: '✅' },
]

export default function WhatsAppAdminView() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [conversaciones, setConversaciones] = useState<ConvGroup[]>([])
  const [selectedConv, setSelectedConv] = useState<ConvGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'conversaciones' | 'flujo' | 'config'>('conversaciones')
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [instanceStatus, setInstanceStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  const supabase = createClient()

  const groupConversations = useCallback((msgs: Mensaje[]) => {
    const groups: Record<string, ConvGroup> = {}
    for (const m of msgs) {
      if (!groups[m.telefono]) {
        groups[m.telefono] = {
          telefono: m.telefono,
          nombre: m.cliente?.nombre || m.telefono,
          mensajes: [],
          ultimo: m.fecha,
          noLeidos: 0,
        }
      }
      groups[m.telefono].mensajes.push(m)
      if (new Date(m.fecha) > new Date(groups[m.telefono].ultimo)) {
        groups[m.telefono].ultimo = m.fecha
      }
      if (m.tipo === 'entrante') groups[m.telefono].noLeidos++
    }
    return Object.values(groups).sort(
      (a, b) => new Date(b.ultimo).getTime() - new Date(a.ultimo).getTime()
    )
  }, [])

  const loadMensajes = useCallback(async () => {
    const { data } = await supabase
      .from('mensajes_whatsapp')
      .select('*, cliente:clientes(nombre)')
      .order('fecha', { ascending: false })
      .limit(200)

    const msgs = (data as Mensaje[]) || []
    setMensajes(msgs)
    setConversaciones(groupConversations(msgs))
    setLoading(false)
  }, [supabase, groupConversations])

  useEffect(() => {
    loadMensajes()
    setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`)

    // Check Evolution API status
    checkInstanceStatus()

    // Realtime
    const channel = supabase
      .channel('whatsapp-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_whatsapp' }, () => {
        loadMensajes()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadMensajes, supabase])

  async function checkInstanceStatus() {
    try {
      const res = await fetch('/api/whatsapp/status')
      const data = await res.json()
      setInstanceStatus(data.connected ? 'connected' : 'disconnected')
    } catch {
      setInstanceStatus('disconnected')
    }
  }

  async function sendTestMessage() {
    if (!testPhone || !testMsg) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: testPhone, mensaje: testMsg }),
      })
      if (res.ok) {
        toast.success('Mensaje enviado correctamente')
        setTestMsg('')
      } else {
        toast.error('Error al enviar. Verifica la configuración.')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSending(false)
    }
  }

  const statsToday = mensajes.filter(m => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return new Date(m.fecha) >= today
  })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-beauty-text flex items-center gap-2">
            <MessageSquare size={22} className="text-green-500" />
            WhatsApp Bot
          </h2>
          <p className="text-gray-500 text-sm hidden sm:block">Automatización y monitoreo de conversaciones</p>
        </div>
        <div className="flex items-center gap-2">
          {instanceStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Bot activo
            </span>
          ) : instanceStatus === 'disconnected' ? (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              Sin conexión
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-semibold px-3 py-1.5 rounded-full">
              <RefreshCw size={12} className="animate-spin" />
              Verificando...
            </span>
          )}
          <button
            onClick={() => { loadMensajes(); checkInstanceStatus() }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Mensajes hoy', value: statsToday.length, icon: MessageSquare, color: 'text-blue-600 bg-blue-100' },
          { label: 'Recibidos hoy', value: statsToday.filter(m => m.tipo === 'entrante').length, icon: Phone, color: 'text-green-600 bg-green-100' },
          { label: 'Enviados hoy', value: statsToday.filter(m => m.tipo === 'saliente').length, icon: Send, color: 'text-purple-600 bg-purple-100' },
          { label: 'Conversaciones', value: conversaciones.length, icon: Users, color: 'text-beauty-secondary bg-beauty-rosa-claro' },
        ].map(s => (
          <div key={s.label} className="beauty-card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <p className="text-xl font-bold text-beauty-text">{s.value}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit">
        {[
          { key: 'conversaciones', label: 'Conversaciones', icon: MessageSquare },
          { key: 'flujo', label: 'Flujo del Bot', icon: Zap },
          { key: 'config', label: 'Configuración', icon: Settings },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-beauty-text shadow-sm'
                : 'text-gray-500 hover:text-beauty-text'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Conversaciones */}
      {activeTab === 'conversaciones' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[400px] lg:h-[500px]">
          {/* Conversation list */}
          <div className="beauty-card overflow-hidden flex flex-col max-h-[300px] lg:max-h-none">
            <div className="p-3 border-b border-gray-100">
              <p className="font-semibold text-beauty-text text-sm">
                Conversaciones ({conversaciones.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <div className="p-6 text-center text-gray-400 text-sm">Cargando...</div>
              ) : conversaciones.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageSquare size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">Sin conversaciones aún</p>
                  <p className="text-gray-300 text-xs mt-1">Los mensajes aparecerán aquí en tiempo real</p>
                </div>
              ) : conversaciones.map(conv => (
                <button
                  key={conv.telefono}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                    selectedConv?.telefono === conv.telefono ? 'bg-beauty-rosa-claro border-l-2 border-beauty-secondary' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-green-700 font-bold text-sm">
                        {conv.nombre.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-beauty-text text-sm truncate">{conv.nombre}</p>
                        <p className="text-gray-400 text-[10px] shrink-0 ml-1">{formatTime(conv.ultimo)}</p>
                      </div>
                      <p className="text-gray-400 text-xs truncate">
                        {conv.mensajes[0]?.mensaje?.slice(0, 40)}...
                      </p>
                    </div>
                    {conv.noLeidos > 0 && (
                      <span className="bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {conv.noLeidos}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat view */}
          <div className="lg:col-span-2 beauty-card overflow-hidden flex flex-col min-h-[300px] lg:min-h-0">
            {selectedConv ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-700 font-bold">{selectedConv.nombre.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-beauty-text text-sm">{selectedConv.nombre}</p>
                    <p className="text-gray-400 text-xs">{selectedConv.telefono}</p>
                  </div>
                  <a
                    href={`https://wa.me/57${selectedConv.telefono}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-full hover:bg-green-600 transition-colors flex items-center gap-1"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Abrir WA
                  </a>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                  {[...selectedConv.mensajes].reverse().map(m => (
                    <div key={m.id} className={`flex ${m.tipo === 'saliente' ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                          m.tipo === 'saliente'
                            ? 'bg-white text-gray-800 rounded-tl-sm'
                            : 'bg-beauty-secondary/20 text-gray-800 rounded-tr-sm border border-beauty-secondary/20'
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed">{m.mensaje}</p>
                        <p className={`text-[10px] mt-1 ${m.tipo === 'saliente' ? 'text-gray-400' : 'text-gray-400 text-right'}`}>
                          {formatTime(m.fecha)}
                          {m.tipo === 'saliente' && (
                            <span className="ml-1 bg-green-100 text-green-700 px-1 rounded text-[9px]">BOT</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-300">
                  <MessageSquare size={40} className="mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">Selecciona una conversación</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Flujo */}
      {activeTab === 'flujo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Steps */}
          <div className="beauty-card p-5">
            <h3 className="font-bold text-beauty-text mb-4 flex items-center gap-2">
              <Zap size={18} className="text-beauty-secondary" />
              Flujo de reserva automática
            </h3>
            <div className="space-y-3">
              {FLUJO_STEPS.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-beauty-secondary flex items-center justify-center text-beauty-text font-bold text-sm shrink-0">
                      {step.icono}
                    </div>
                    {i < FLUJO_STEPS.length - 1 && (
                      <div className="w-0.5 h-6 bg-beauty-secondary/20 mt-1" />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-beauty-text mb-1">
                        Paso {step.paso}
                      </p>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">
                            <span className="font-medium text-gray-600">Cliente:</span> {step.trigger}
                          </p>
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-green-600">Bot:</span> {step.respuesta}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commands reference */}
          <div className="space-y-4">
            <div className="beauty-card p-5">
              <h3 className="font-bold text-beauty-text mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-beauty-secondary" />
                Palabras clave de reinicio
              </h3>
              <div className="space-y-2">
                {['hola', 'inicio', 'menu', 'menú', 'cancelar', 'reiniciar', '0'].map(kw => (
                  <div key={kw} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                      {kw}
                    </code>
                    <span className="text-gray-400 text-xs">→ Vuelve al menú principal</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="beauty-card p-5">
              <h3 className="font-bold text-beauty-text mb-3 flex items-center gap-2">
                <Clock size={18} className="text-beauty-secondary" />
                Recordatorios automáticos
              </h3>
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">⏰ 24 horas antes</p>
                  <p className="text-xs text-amber-600 font-mono">
                    {"⏰ Recordatorio de cita\nServicio: {servicio}\nFecha: {fecha}\nHora: {hora}\n\nTe esperamos 💖"}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">⏰ 2 horas antes</p>
                  <p className="text-xs text-blue-600">Mismo mensaje — enviado 2h antes de la cita</p>
                </div>
                <p className="text-xs text-gray-400">
                  Los recordatorios se envían automáticamente vía cron job en Vercel cada 2 horas.
                </p>
              </div>
            </div>

            <div className="beauty-card p-5">
              <h3 className="font-bold text-beauty-text mb-3">Categorías del bot</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['1️⃣', 'Manicura'], ['2️⃣', 'Maquillaje'], ['3️⃣', 'Masajes'],
                  ['4️⃣', 'Facial'], ['5️⃣', 'Cejas'], ['6️⃣', 'Peinados'],
                  ['7️⃣', 'Barbería'], ['8️⃣', 'Depilación'], ['9️⃣', 'Peluquería'],
                ].map(([num, label]) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg">{num}</p>
                    <p className="text-[10px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Configuración */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Webhook URL */}
          <div className="beauty-card p-5">
            <h3 className="font-bold text-beauty-text mb-4 flex items-center gap-2">
              <Settings size={18} className="text-beauty-secondary" />
              Configuración Evolution API
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del Webhook
                </label>
                <div className="flex gap-2">
                  <input
                    value={webhookUrl}
                    readOnly
                    className="input-beauty flex-1 text-xs font-mono bg-gray-50"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl)
                      toast.success('Copiado!')
                    }}
                    className="btn-beauty py-2 px-3 text-xs shrink-0"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Configura esta URL en tu panel de Evolution API → Webhooks
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-beauty-text text-sm">Variables de entorno</p>
                {[
                  { key: 'EVOLUTION_API_URL', desc: 'URL base de Evolution API' },
                  { key: 'EVOLUTION_API_KEY', desc: 'API Key de acceso' },
                  { key: 'EVOLUTION_INSTANCE_NAME', desc: 'Nombre de la instancia' },
                ].map(v => (
                  <div key={v.key} className="flex items-start gap-2">
                    <Circle size={6} className="text-beauty-secondary mt-1.5 shrink-0" />
                    <div>
                      <code className="text-xs font-mono text-beauty-text">{v.key}</code>
                      <p className="text-xs text-gray-400">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-beauty-rosa-claro border border-beauty-primary rounded-xl p-4">
                <p className="text-sm font-semibold text-beauty-text mb-2">Estado del bot</p>
                <div className="flex items-center gap-2">
                  {instanceStatus === 'connected' ? (
                    <>
                      <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-green-700 text-sm font-medium">Evolution API conectada</span>
                    </>
                  ) : instanceStatus === 'disconnected' ? (
                    <>
                      <span className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-red-600 text-sm">Sin conexión — verifica las credenciales</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} className="animate-spin text-gray-400" />
                      <span className="text-gray-500 text-sm">Verificando...</span>
                    </>
                  )}
                </div>
                <button
                  onClick={checkInstanceStatus}
                  className="mt-3 text-xs text-beauty-secondary hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Verificar conexión
                </button>
              </div>
            </div>
          </div>

          {/* Test message sender */}
          <div className="beauty-card p-5">
            <h3 className="font-bold text-beauty-text mb-4 flex items-center gap-2">
              <Send size={18} className="text-beauty-secondary" />
              Enviar mensaje de prueba
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número WhatsApp
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+57</span>
                  <input
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="3001234567"
                    className="input-beauty pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje
                </label>
                <textarea
                  value={testMsg}
                  onChange={e => setTestMsg(e.target.value)}
                  placeholder="Escribe un mensaje de prueba..."
                  className="input-beauty resize-none"
                  rows={4}
                />
              </div>

              <button
                onClick={sendTestMessage}
                disabled={sending || !testPhone || !testMsg}
                className="btn-beauty w-full justify-center disabled:opacity-50"
              >
                {sending ? (
                  <><RefreshCw size={15} className="animate-spin" /> Enviando...</>
                ) : (
                  <><Send size={15} /> Enviar mensaje</>
                )}
              </button>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Prueba rápida del bot:</p>
                <button
                  onClick={() => setTestMsg('Hola')}
                  className="text-xs bg-gray-100 hover:bg-beauty-rosa-claro text-gray-600 hover:text-beauty-secondary px-3 py-1.5 rounded-full transition-colors mr-2"
                >
                  Enviar "Hola"
                </button>
                <button
                  onClick={() => setTestMsg('menu')}
                  className="text-xs bg-gray-100 hover:bg-beauty-rosa-claro text-gray-600 hover:text-beauty-secondary px-3 py-1.5 rounded-full transition-colors"
                >
                  Enviar "menu"
                </button>
              </div>
            </div>
          </div>

          {/* Setup guide */}
          <div className="lg:col-span-2 beauty-card p-5">
            <h3 className="font-bold text-beauty-text mb-4 flex items-center gap-2">
              <ChevronRight size={18} className="text-beauty-secondary" />
              Guía de configuración
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  step: '1',
                  title: 'Crear instancia en Evolution API',
                  items: ['Accede a tu panel de Evolution API', 'Crea una nueva instancia', 'Escanea el QR con WhatsApp'],
                  color: 'border-blue-200 bg-blue-50',
                  num: 'bg-blue-500',
                },
                {
                  step: '2',
                  title: 'Configurar el webhook',
                  items: ['Copia la URL del webhook de arriba', 'En Evolution API → Webhooks', `Pega la URL y activa "messages.upsert"`],
                  color: 'border-beauty-secondary/40 bg-beauty-rosa-claro',
                  num: 'bg-beauty-secondary',
                },
                {
                  step: '3',
                  title: 'Verificar funcionamiento',
                  items: ['Envía "Hola" al número del negocio', 'El bot debe responder con el menú', 'Completa una reserva de prueba'],
                  color: 'border-green-200 bg-green-50',
                  num: 'bg-green-500',
                },
              ].map(g => (
                <div key={g.step} className={`border rounded-xl p-4 ${g.color}`}>
                  <div className={`w-7 h-7 rounded-full ${g.num} text-white text-xs font-bold flex items-center justify-center mb-3`}>
                    {g.step}
                  </div>
                  <p className="font-semibold text-beauty-text text-sm mb-2">{g.title}</p>
                  <ul className="space-y-1">
                    {g.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
