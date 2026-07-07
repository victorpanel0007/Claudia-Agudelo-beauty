'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cita, Cliente, Especialista, Servicio } from '@/types/database'
import { formatCurrency, formatTime, formatDate } from '@/lib/utils'
import { SERVICIOS_DATA } from '@/lib/services-data'
import {
  Plus, X, Clock, ChevronLeft, ChevronRight,
  MessageCircle, Phone, Mail, Check, AlertCircle,
  Search, Loader2, CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  format, addDays, startOfWeek, parseISO,
  addWeeks, subWeeks, isToday,
} from 'date-fns'
import { es } from 'date-fns/locale'

// ── Constants ───────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8–19

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmada: { label: 'Confirmada',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   dot: 'bg-green-500' },
  pendiente:  { label: 'Pendiente',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
  en_proceso: { label: 'En proceso',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
  completada: { label: 'Completada',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  cancelada:  { label: 'Cancelada',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       dot: 'bg-red-400' },
  no_asistio: { label: 'No asistió',  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',     dot: 'bg-gray-400' },
  reagendada: { label: 'Reagendada',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
}

/**
 * Paleta de colores por especialista.
 * Se asigna automáticamente y es siempre consistente por nombre.
 * Cada entrada: [bgClass, textClass, dotClass, emoji, hex (para border inline)]
 */
const ESP_PALETTE: Array<{ bg: string; text: string; dot: string; emoji: string; badge: string }> = [
  { bg: 'bg-pink-100',    text: 'text-pink-700',   dot: 'bg-pink-500',   emoji: '🌸', badge: 'bg-pink-100 text-pink-700 border-pink-200' },
  { bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-500', emoji: '💜', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  { bg: 'bg-sky-100',     text: 'text-sky-700',    dot: 'bg-sky-500',    emoji: '🩵', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
  { bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-500',  emoji: '🌼', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700',dot: 'bg-emerald-500',emoji: '🌿', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { bg: 'bg-rose-100',    text: 'text-rose-700',   dot: 'bg-rose-500',   emoji: '🌹', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
]

/** Devuelve siempre el mismo color para el mismo nombre de especialista */
function getEspColor(nombre?: string | null) {
  if (!nombre) return ESP_PALETTE[0]
  let hash = 0
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  return ESP_PALETTE[Math.abs(hash) % ESP_PALETTE.length]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function citaTop(fecha: string): number {
  const d = new Date(fecha)
  const colombiaStr = d.toLocaleString('en-US', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const [h, m] = colombiaStr.split(':').map(Number)
  return ((h - 8) * 60 + m) * (64 / 60)
}

function citaHeight(inicio: string, fin: string): number {
  const s = new Date(inicio)
  const e = new Date(fin)
  const mins = (e.getTime() - s.getTime()) / 60000
  return Math.max(mins * (64 / 60), 40)
}

// Compare two dates as the same calendar day in Colombia timezone
function isSameDayColombia(dateStr: string, day: Date): boolean {
  const d = new Date(dateStr)
  const dStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const dayStr = day.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  return dStr === dayStr
}

// ── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}

// ── ReminderRow ──────────────────────────────────────────────────────────────
function ReminderRow({ icon, label, time, color }: {
  icon: React.ReactNode
  label: string
  time: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <span className="text-[10px] text-gray-400">{time}</span>
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, iconBg }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-medium leading-tight truncate">{label}</p>
        <p className="text-base font-bold text-gray-800 leading-tight">{value}</p>
        <p className="text-[10px] text-gray-400 leading-tight truncate">{sub}</p>
      </div>
    </div>
  )
}

// ── CitaCard ─────────────────────────────────────────────────────────────────
function CitaCard({ cita, onClick }: { cita: Cita; onClick: () => void }) {
  const st  = STATUS_CONFIG[cita.estado] ?? STATUS_CONFIG.pendiente
  const esp = getEspColor(cita.especialista?.nombre)

  return (
    <button
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-xl border px-2 py-1.5 text-left overflow-hidden
        transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer z-10 ${st.bg}`}
      style={{
        top: citaTop(cita.fecha_inicio),
        height: citaHeight(cita.fecha_inicio, cita.fecha_fin),
      }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {/* Badge de especialista */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${esp.badge}`}>
          {esp.emoji} {cita.especialista?.nombre?.split(' ')[0] ?? '—'}
        </span>
        <p className={`font-semibold text-[11px] truncate ${st.color}`}>{cita.cliente?.nombre}</p>
        <div className={`w-2 h-2 rounded-full shrink-0 ml-auto ${st.dot}`} />
      </div>
      <p className="text-[10px] text-gray-500 truncate">{cita.servicio?.nombre}</p>
      <p className="text-[10px] text-gray-400">
        {formatTime(cita.fecha_inicio)} – {formatTime(cita.fecha_fin)}
      </p>
    </button>
  )
}

// ── DetailPanel ──────────────────────────────────────────────────────────────
function DetailPanel({ cita, onClose, onCompletar, onCancelar, onEliminar }: {
  cita: Cita
  onClose: () => void
  onCompletar: (cita: Cita) => void
  onCancelar: (id: string) => void
  onEliminar: (id: string) => void
}) {
  const st = STATUS_CONFIG[cita.estado] ?? STATUS_CONFIG.pendiente

  return (
    <div className="w-72 bg-white border-l border-gray-100 flex flex-col h-full overflow-y-auto shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <p className="font-semibold text-gray-800 text-sm">Detalles de la cita</p>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
          <X size={16} />
        </button>
      </div>

      {/* Cliente */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-beauty-rosa-claro flex items-center justify-center text-sm font-bold text-beauty-primary shrink-0">
            {getInitials(cita.cliente?.nombre ?? 'C')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">{cita.cliente?.nombre}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.bg} ${st.color}`}>
              {st.label}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {cita.cliente?.telefono && (
            <a
              href={`https://wa.me/57${cita.cliente.telefono}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors"
            >
              <MessageCircle size={14} className="text-green-600" />
            </a>
          )}
          {cita.cliente?.telefono && (
            <a
              href={`tel:${cita.cliente.telefono}`}
              className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
            >
              <Phone size={14} className="text-blue-600" />
            </a>
          )}
          <button className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
            <Mail size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Info servicio */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <InfoRow icon="✂️" label={cita.servicio?.nombre ?? '—'} />
        <InfoRow icon="⏱️" label={`${cita.servicio?.duracion_minutos ?? 0} min`} />
        <InfoRow icon="👩" label={cita.especialista?.nombre ?? '—'} />
        <InfoRow icon="📅" label={formatDate(cita.fecha_inicio)} />
        <InfoRow icon="🕐" label={`${formatTime(cita.fecha_inicio)} – ${formatTime(cita.fecha_fin)}`} />
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Total</span>
          <span className="font-bold text-gray-800 text-sm">
            {cita.valor_final ? formatCurrency(cita.valor_final) : 'Por definir'}
          </span>
        </div>
      </div>

      {/* Observaciones */}
      {cita.observaciones && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Notas</p>
          <p className="text-xs text-gray-600 leading-relaxed">{cita.observaciones}</p>
        </div>
      )}

      {/* Recordatorios */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-3">Recordatorios</p>
        <div className="space-y-2">
          <ReminderRow
            icon={<Check size={12} />}
            label="WhatsApp enviado"
            time={formatTime(cita.fecha_inicio)}
            color="text-green-500"
          />
          <ReminderRow
            icon={<Check size={12} />}
            label="Correo enviado"
            time={formatTime(cita.fecha_inicio)}
            color="text-green-500"
          />
          <ReminderRow
            icon={<AlertCircle size={12} />}
            label="Recordatorio pendiente"
            time="2h antes"
            color="text-amber-500"
          />
        </div>
      </div>

      {/* Acciones */}
      {(cita.estado === 'confirmada' || cita.estado === 'pendiente' || cita.estado === 'en_proceso') && (
        <div className="p-4 mt-auto flex gap-2">
          <button onClick={() => onCancelar(cita.id)}
            className="flex-1 text-xs font-semibold py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onCompletar(cita)}
            className="flex-1 text-xs font-semibold py-2.5 rounded-xl bg-beauty-primary text-white hover:bg-beauty-primary-dark transition-colors">
            Completar
          </button>
        </div>
      )}
      {/* Eliminar permanentemente */}
      <div className="px-4 pb-4">
        <button onClick={() => onEliminar(cita.id)}
          className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-2 rounded-xl transition-colors border border-red-100">
          🗑️ Eliminar cita permanentemente
        </button>
      </div>
    </div>
  )
}

// ── CompletarModal ───────────────────────────────────────────────────────────
function CompletarModal({ cita, onClose, onConfirm }: {
  cita: Cita
  onClose: () => void
  onConfirm: (id: string, valor: number, metodoPago: string) => Promise<void>
}) {
  const [valor, setValor] = useState<string>(
    cita.valor_final?.toString() ?? cita.servicio?.precio?.toString() ?? ''
  )
  const [metodoPago, setMetodoPago] = useState<string>('efectivo')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!valor || isNaN(Number(valor))) {
      toast.error('Ingresa un valor válido')
      return
    }
    setLoading(true)
    await onConfirm(cita.id, Number(valor), metodoPago)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-beauty-text">Completar Cita</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Resumen de la cita */}
        <div className="bg-beauty-bg rounded-xl p-3 mb-4 space-y-1">
          <p className="text-sm font-semibold text-beauty-text">{cita.cliente?.nombre}</p>
          <p className="text-xs text-beauty-text-muted">{cita.servicio?.nombre ?? 'Servicio'}</p>
          <p className="text-xs text-beauty-text-muted">
            {formatTime(cita.fecha_inicio)} — {cita.especialista?.nombre}
          </p>
        </div>

        {/* Campo valor */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-beauty-text mb-2">
            Valor cobrado <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-beauty-text-muted text-sm font-medium">
              $
            </span>
            <input
              type="number"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="Ej: 46000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pl-7 text-lg font-bold text-beauty-text focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20 transition-colors"
              autoFocus
            />
          </div>
          {cita.servicio?.precio && (
            <p className="text-xs text-beauty-text-muted mt-1">
              Precio sugerido: ${Number(cita.servicio.precio).toLocaleString('es-CO')}
            </p>
          )}
        </div>

        {/* Método de pago */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-beauty-text mb-2">
            Método de pago <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMetodoPago('efectivo')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                metodoPago === 'efectivo'
                  ? 'border-beauty-primary bg-beauty-primary/10 text-beauty-primary'
                  : 'border-gray-200 text-beauty-text-muted hover:bg-beauty-bg'
              }`}
            >
              💵 Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMetodoPago('transferencia')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                metodoPago === 'transferencia'
                  ? 'border-beauty-primary bg-beauty-primary/10 text-beauty-primary'
                  : 'border-gray-200 text-beauty-text-muted hover:bg-beauty-bg'
              }`}
            >
              📲 Transferencia
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl border-2 border-beauty-primary/30 text-beauty-text-muted hover:bg-beauty-bg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !valor}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-beauty-borgona text-white hover:bg-beauty-borgona-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NuevaCitaModal ───────────────────────────────────────────────────────────
interface SlotOption {
  hora: string
  fecha_inicio: string
  fecha_fin: string
  especialista_id: string
  especialista_nombre: string
}

function NuevaCitaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [clienteSearch, setClienteSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [step, setStep] = useState(1)

  const [form, setForm] = useState({
    cliente_id: '',
    cliente_nombre: '',
    cliente_telefono: '',
    es_nuevo_cliente: false,
    especialista_id: '',
    servicio_id: '',
    fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
    slot_inicio: '',
    slot_fin: '',
    observaciones: '',
    valor_final: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id,nombre,telefono').order('nombre'),
      supabase.from('especialistas').select('id,nombre,activo,horario_inicio,horario_fin,dias_laborales,created_at').eq('activo', true),
      supabase.from('servicios').select('id,nombre,duracion_minutos,precio,precio_desde,tipo_precio').eq('activo', true).order('nombre'),
    ]).then(([c, e, s]) => {
      if (c.data) setClientes(c.data as Cliente[])
      if (e.data) setEspecialistas(e.data as Especialista[])
      if (s.data && s.data.length > 0) setServicios(s.data as Servicio[])
    })
  }, [supabase])

  // Fallback to local data if DB has no services
  const serviciosLocales: Servicio[] = SERVICIOS_DATA.map((s, i) => ({
    id: `local-${i}`,
    categoria_id: s.cat,
    nombre: s.nombre,
    precio: 'precio' in s ? s.precio : undefined,
    precio_desde: 'precio_desde' in s ? s.precio_desde : undefined,
    tipo_precio: (s.tipo === 'valoracion' ? 'valoracion' : s.tipo) as 'fijo' | 'desde' | 'valoracion',
    duracion_minutos: s.duracion,
    requiere_valoracion: false,
    activo: true,
    created_at: '',
  }))

  const serviciosDisponibles = servicios.length > 0 ? servicios : serviciosLocales

  const clientesFiltrados = clientes
    .filter(
      c =>
        c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
        c.telefono.includes(clienteSearch)
    )
    .slice(0, 6)

  const servicioSeleccionado = serviciosDisponibles.find(s => s.id === form.servicio_id)

  async function buscarSlots() {
    if (!form.fecha || !form.servicio_id) return
    setLoadingSlots(true)
    const duracion = servicioSeleccionado?.duracion_minutos ?? 60
    const params = new URLSearchParams({
      fecha: new Date(form.fecha + 'T12:00:00-05:00').toISOString(),
      duracion: duracion.toString(),
      ...(form.especialista_id ? { especialista_id: form.especialista_id } : {}),
    })
    try {
      const res = await fetch(`/api/disponibilidad?${params}`)
      const data: unknown = await res.json()
      setSlots(Array.isArray(data) ? (data as SlotOption[]) : [])
    } catch {
      setSlots([])
    }
    setLoadingSlots(false)
    setStep(2)
  }

  async function guardar() {
    if (!form.slot_inicio || (!form.cliente_id && !form.es_nuevo_cliente)) {
      toast.error('Completa todos los campos requeridos')
      return
    }
    setLoading(true)
    try {
      let clienteId = form.cliente_id
      if (form.es_nuevo_cliente && form.cliente_nombre) {
        const { data: nuevoCliente, error } = await supabase
          .from('clientes')
          .insert({ nombre: form.cliente_nombre, telefono: form.cliente_telefono })
          .select('id')
          .single()
        if (error) throw error
        clienteId = nuevoCliente.id
      }
      const slotElegido = slots.find(s => s.fecha_inicio === form.slot_inicio)
      const body = {
        cliente_id: clienteId,
        especialista_id: slotElegido?.especialista_id ?? form.especialista_id ?? null,
        servicio_id: form.servicio_id.startsWith('local-') ? null : (form.servicio_id || null),
        fecha_inicio: form.slot_inicio,
        fecha_fin: form.slot_fin,
        observaciones: form.observaciones || null,
        valor_final: form.valor_final ? parseInt(form.valor_final, 10) : null,
        estado: 'confirmada',
        canal: 'admin',
      }
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('¡Cita creada exitosamente! ✓')
      onSaved()
      onClose()
    } catch {
      toast.error('Error al crear la cita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800">Nueva Cita</h3>
            <p className="text-xs text-gray-400">Paso {step} de 2</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex">
          <div className={`h-1 flex-1 transition-all ${step >= 1 ? 'bg-beauty-primary' : 'bg-gray-100'}`} />
          <div className={`h-1 flex-1 transition-all ${step >= 2 ? 'bg-beauty-primary' : 'bg-gray-100'}`} />
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
          {step === 1 && (
            <>
              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Cliente *</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, es_nuevo_cliente: false }))}
                    className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${
                      !form.es_nuevo_cliente
                        ? 'border-beauty-primary bg-beauty-primary/10 text-beauty-primary'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Cliente existente
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, es_nuevo_cliente: true, cliente_id: '' }))}
                    className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${
                      form.es_nuevo_cliente
                        ? 'border-beauty-primary bg-beauty-primary/10 text-beauty-primary'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Cliente nuevo
                  </button>
                </div>

                {form.es_nuevo_cliente ? (
                  <div className="space-y-2">
                    <input
                      value={form.cliente_nombre}
                      onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))}
                      placeholder="Nombre completo *"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                    />
                    <input
                      value={form.cliente_telefono}
                      onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))}
                      placeholder="Teléfono (ej: 3001234567)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={clienteSearch}
                      onChange={e => setClienteSearch(e.target.value)}
                      placeholder="Buscar cliente por nombre o teléfono..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs pl-10 focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                    />
                    {clienteSearch && clientesFiltrados.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                        {clientesFiltrados.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setForm(f => ({ ...f, cliente_id: c.id, cliente_nombre: c.nombre }))
                              setClienteSearch(c.nombre)
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-beauty-bg text-xs flex justify-between items-center border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium text-gray-700">{c.nombre}</span>
                            <span className="text-gray-400">{c.telefono}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {form.cliente_id && (
                      <div className="mt-2 flex items-center gap-2 bg-beauty-primary/10 border border-beauty-primary/30 rounded-xl px-3 py-2">
                        <Check size={14} className="text-beauty-primary" />
                        <span className="text-xs text-beauty-primary font-medium">{form.cliente_nombre}</span>
                        <button
                          onClick={() => setForm(f => ({ ...f, cliente_id: '', cliente_nombre: '' }))}
                          className="ml-auto text-beauty-primary/60 hover:text-beauty-primary"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Servicio */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Servicio *</label>
                <select
                  value={form.servicio_id}
                  onChange={e => setForm(f => ({ ...f, servicio_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                >
                  <option value="">Selecciona un servicio...</option>
                  {serviciosDisponibles.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} — {s.duracion_minutos} min
                      {s.precio ? ` · $${Number(s.precio).toLocaleString('es-CO')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Especialista */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Especialista</label>
                <select
                  value={form.especialista_id}
                  onChange={e => setForm(f => ({ ...f, especialista_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                >
                  <option value="">Cualquier especialista disponible</option>
                  {especialistas.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Fecha *</label>
                <input
                  type="date"
                  value={form.fecha}
                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs resize-none focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                  rows={2}
                  placeholder="Alergias, preferencias, etc."
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Valor (opcional)</label>
                <input
                  type="number"
                  value={form.valor_final}
                  onChange={e => setForm(f => ({ ...f, valor_final: e.target.value }))}
                  placeholder="Ej: 46000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary focus:ring-2 focus:ring-beauty-primary/20"
                />
              </div>

              <button
                onClick={buscarSlots}
                disabled={!form.fecha || !form.servicio_id || (!form.cliente_id && !form.es_nuevo_cliente)}
                className="w-full bg-beauty-primary text-white font-semibold py-3 rounded-xl text-sm hover:bg-beauty-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingSlots ? (
                  <><Loader2 size={16} className="animate-spin" /> Buscando horarios...</>
                ) : (
                  'Ver disponibilidad →'
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
              >
                <ChevronLeft size={14} /> Volver
              </button>
              <p className="text-xs font-semibold text-gray-600 mb-3">
                Horarios disponibles — {format(new Date(form.fecha + 'T12:00:00-05:00'), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              {slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No hay disponibilidad para esa fecha.</p>
                  <button onClick={() => setStep(1)} className="mt-3 text-beauty-primary text-sm underline">
                    Cambiar fecha
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {slots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setForm(f => ({ ...f, slot_inicio: slot.fecha_inicio, slot_fin: slot.fecha_fin }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.slot_inicio === slot.fecha_inicio
                          ? 'border-beauty-primary bg-beauty-primary/10'
                          : 'border-gray-200 hover:border-beauty-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-xs font-bold text-gray-700">
                        <Clock size={11} /> {slot.hora}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{slot.especialista_nombre}</p>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={guardar}
                disabled={!form.slot_inicio || loading}
                className="w-full bg-beauty-primary text-white font-semibold py-3 rounded-xl text-sm hover:bg-beauty-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                ) : (
                  '✓ Confirmar Cita'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main AgendaView ──────────────────────────────────────────────────────────
export default function AgendaView() {
  const supabase = createClient()
  const [citas, setCitas] = useState<Cita[]>([])
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null)
  const [citaACompletar, setCitaACompletar] = useState<Cita | null>(null)
  const [loading, setLoading] = useState(true)
  // Default to 'day' on mobile — detected via initial render
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showNuevaCita, setShowNuevaCita] = useState(false)
  // Mobile: show list instead of timeline grid
  const [mobileListMode, setMobileListMode] = useState(true)
  // Filtro por especialista (null = todas)
  const [filtroEsp, setFiltroEsp] = useState<string>('todas')

  const loadCitas = useCallback(async () => {
    const { data, error } = await supabase
      .from('citas')
      .select(
        `*, cliente:clientes(nombre,telefono,notas),
        especialista:especialistas(nombre,foto),
        servicio:servicios(nombre,duracion_minutos,precio,precio_desde,tipo_precio)`
      )
      .neq('estado', 'cancelada')
      .order('fecha_inicio')
    if (error) console.error('Error cargando citas:', error.message)
    if (data) setCitas(data as Cita[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadCitas()
    const ch = supabase
      .channel('agenda-rt-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'citas' }, () => loadCitas())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'citas' }, () => loadCitas())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'citas' }, () => loadCitas())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadCitas, supabase])

  async function cancelarCita(id: string) {
    const { error } = await supabase.from('citas').update({ estado: 'cancelada' }).eq('id', id)
    if (error) {
      toast.error('Error al cancelar')
    } else {
      toast.success('Cita cancelada')
      setSelectedCita(null)
      loadCitas()
    }
  }

  async function eliminarCita(id: string) {
    if (!confirm('¿Eliminar esta cita permanentemente?')) return
    const { error } = await supabase.from('citas').delete().eq('id', id)
    if (error) toast.error('Error al eliminar')
    else { toast.success('🗑️ Cita eliminada'); setSelectedCita(null); loadCitas() }
  }

  async function eliminarTodasLasCitas() {
    if (!confirm('⚠️ ¿Eliminar TODAS las citas? Esta acción no se puede deshacer.')) return
    if (!confirm('¿Estás completamente segura? Se eliminarán TODAS las citas.')) return
    const { error } = await supabase.from('citas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) toast.error('Error: ' + error.message)
    else { toast.success('🗑️ Agenda limpiada'); loadCitas() }
  }

  function solicitarCompletar(cita: Cita) {
    setCitaACompletar(cita)
  }

  async function completarCita(id: string, valor: number, metodoPago: string) {
    const { error } = await supabase
      .from('citas')
      .update({ estado: 'completada', valor_final: valor, metodo_pago: metodoPago })
      .eq('id', id)
    if (error) {
      toast.error('Error al completar')
    } else {
      toast.success(`Cita completada ✓ — ${formatCurrency(valor)}`)
      setSelectedCita(null)
      setCitaACompletar(null)
      loadCitas()
    }
  }

  // ── Date navigation helpers ─────────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayView = [currentDate]
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const monthDays = Array.from({ length: monthEnd.getDate() }, (_, i) => addDays(monthStart, i))
  const visibleDays = viewMode === 'day' ? dayView : viewMode === 'month' ? monthDays : weekDays

  function goNext() {
    if (viewMode === 'day') setCurrentDate(d => addDays(d, 1))
    else if (viewMode === 'week') setCurrentDate(d => addWeeks(d, 1))
    else setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  function goPrev() {
    if (viewMode === 'day') setCurrentDate(d => addDays(d, -1))
    else if (viewMode === 'week') setCurrentDate(d => subWeeks(d, 1))
    else setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  const toolbarTitle =
    viewMode === 'day'
      ? format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })
      : format(viewMode === 'week' ? weekStart : currentDate, 'MMMM yyyy', { locale: es })

  // ── Stats ───────────────────────────────────────────────────────────────
  const today = new Date()

  // Lista de especialistas únicas para el selector
  const especialistasUnicas = Array.from(
    new Set(citas.map(c => c.especialista?.nombre).filter((n): n is string => !!n))
  ).sort()

  // Citas filtradas por especialista seleccionada
  const citasFiltradas = filtroEsp === 'todas'
    ? citas
    : citas.filter(c => c.especialista?.nombre === filtroEsp)

  const citasHoy       = citasFiltradas.filter(c => isSameDayColombia(c.fecha_inicio, today))
  const citasDiaActual = citasFiltradas.filter(c => isSameDayColombia(c.fecha_inicio, currentDate))
  const pendientes     = citasFiltradas.filter(c => c.estado === 'pendiente')
  const confirmadas    = citasFiltradas.filter(c => c.estado === 'confirmada')
  const ingresosDia    = citasHoy
    .filter(c => c.estado === 'completada')
    .reduce((s, c) => s + (c.valor_final ?? 0), 0)

  // Sub-label del filtro activo
  const filtroLabel = filtroEsp === 'todas' ? 'general' : filtroEsp.split(' ')[0]

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* ── Title bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Agenda</h2>
          <p className="text-xs text-gray-400">Gestiona tus citas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={eliminarTodasLasCitas}
            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-2.5 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
            <span className="hidden sm:inline">🗑️ Limpiar</span>
            <span className="sm:hidden">🗑️</span>
          </button>
          <button onClick={() => setShowNuevaCita(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-beauty-primary text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl hover:bg-beauty-primary-dark transition-colors shadow-sm">
            <Plus size={15} />
            <span className="hidden sm:inline">Nueva Cita</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5 sm:gap-2 mb-2">
        <StatCard icon={<span>📅</span>} label="Citas Hoy"    value={citasHoy.length}           sub={filtroLabel}  iconBg="bg-pink-50" />
        <StatCard icon={<span>⏳</span>} label="Pendientes"   value={pendientes.length}          sub="por confirmar" iconBg="bg-amber-50" />
        <StatCard icon={<span>✅</span>} label="Confirmadas"  value={confirmadas.length}         sub="activas"       iconBg="bg-green-50" />
        <StatCard icon={<span>💵</span>} label="Ingresos"     value={formatCurrency(ingresosDia)} sub="del día"      iconBg="bg-blue-50" />
        <StatCard icon={<span>👩</span>} label="Especialistas" value={especialistasUnicas.length || '—'} sub="activas" iconBg="bg-purple-50" />
      </div>

      {/* ── Selector de especialista ────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          onClick={() => setFiltroEsp('todas')}
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            filtroEsp === 'todas'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          👥 Todas
        </button>
        {especialistasUnicas.map(nombre => {
          const c = getEspColor(nombre)
          const activo = filtroEsp === nombre
          return (
            <button
              key={nombre}
              onClick={() => setFiltroEsp(nombre)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                activo
                  ? `${c.bg} ${c.text} border-current`
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {c.emoji} {nombre.split(' ')[0]}
            </button>
          )
        })}
      </div>

      {/* ── MOBILE LIST VIEW ───────────────────────────────────────── */}
      <div className="sm:hidden flex flex-col flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0">
        {/* Mobile toolbar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(new Date())}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 min-h-[36px]">
              Hoy
            </button>
            <button onClick={goPrev} className="p-2 hover:bg-gray-100 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goNext} className="p-2 hover:bg-gray-100 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
              <ChevronRight size={16} />
            </button>
          </div>
          <p className="font-semibold text-gray-700 text-xs capitalize flex-1 text-center truncate">
            {format(currentDate, "EEE d 'de' MMM", { locale: es })}
          </p>
          {/* Mobile: toggle list/grid mode */}
          <button
            onClick={() => setMobileListMode(v => !v)}
            className="text-[10px] font-medium px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 min-h-[36px] shrink-0"
          >
            {mobileListMode ? 'Grid' : 'Lista'}
          </button>
        </div>

        {/* Mobile appointment list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
            </div>
          ) : citasDiaActual.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-gray-400 text-sm">
                Sin citas para {isToday(currentDate) ? 'hoy' : format(currentDate, "EEE d 'de' MMM", { locale: es })}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {citasDiaActual.map(cita => {
                const st  = STATUS_CONFIG[cita.estado] ?? STATUS_CONFIG.pendiente
                const esp = getEspColor(cita.especialista?.nombre)
                return (
                  <button key={cita.id} onClick={() => setSelectedCita(cita)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left min-h-[60px] active:bg-gray-100 transition-colors">
                    {/* Franja de color de especialista */}
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${esp.dot}`} />
                    <div className="bg-beauty-primary/10 rounded-xl px-2.5 py-2 text-center shrink-0 min-w-[52px]">
                      <p className="text-beauty-primary font-bold text-xs">{formatTime(cita.fecha_inicio)}</p>
                      <p className="text-beauty-text-muted text-[10px]">{formatTime(cita.fecha_fin)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-semibold text-gray-800 text-sm truncate">{cita.cliente?.nombre}</p>
                      </div>
                      <p className="text-gray-500 text-xs truncate">{cita.servicio?.nombre}</p>
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-0.5 ${esp.badge}`}>
                        {esp.emoji} {cita.especialista?.nombre?.split(' ')[0] ?? '—'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, s]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-[10px] text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DESKTOP CALENDAR + DETAIL PANEL ───────────────────────── */}
      <div className="hidden sm:flex flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0">

        {/* Calendar column */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(new Date())}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                Hoy
              </button>
              <button onClick={goPrev} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="font-semibold text-gray-700 text-sm capitalize">{toolbarTitle}</p>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(
                [
                  { label: 'Día',    value: 'day'   },
                  { label: 'Semana', value: 'week'  },
                  { label: 'Mes',    value: 'month' },
                ] as const
              ).map(v => (
                <button
                  key={v.value}
                  onClick={() => setViewMode(v.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    viewMode === v.value
                      ? 'bg-white shadow-sm text-beauty-primary'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month view */}
          {viewMode === 'month' ? (
            <div className="flex-1 overflow-auto p-3">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before day 1 */}
                {Array.from({ length: monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1 }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-xl bg-gray-50/50" />
                ))}
                {monthDays.map(day => {
                  const citasDia = citasFiltradas.filter(c => isSameDayColombia(c.fecha_inicio, day))
                  const isHoy = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={`h-20 rounded-xl border p-1.5 overflow-hidden cursor-pointer hover:border-beauty-primary/40 transition-all ${
                        isHoy ? 'border-beauty-primary bg-beauty-primary/5' : 'border-gray-100 bg-white'
                      }`}
                      onClick={() => { setCurrentDate(day); setViewMode('day') }}
                    >
                      <p className={`text-xs font-bold mb-1 ${isHoy ? 'text-beauty-primary' : 'text-gray-600'}`}>
                        {format(day, 'd')}
                      </p>
                      <div className="space-y-0.5">
                        {citasDia.slice(0, 2).map(c => {
                          const st = STATUS_CONFIG[c.estado] ?? STATUS_CONFIG.pendiente
                          return (
                            <div
                              key={c.id}
                              onClick={e => { e.stopPropagation(); setSelectedCita(c) }}
                              className={`text-[10px] truncate px-1.5 py-0.5 rounded-md border ${st.bg} ${st.color} cursor-pointer`}
                            >
                              {formatTime(c.fecha_inicio)} {c.cliente?.nombre?.split(' ')[0]}
                            </div>
                          )
                        })}
                        {citasDia.length > 2 && (
                          <p className="text-[10px] text-gray-400 pl-1">+{citasDia.length - 2} más</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Day / Week grid */
            <div className="flex flex-1 overflow-auto">
              {/* Hours column */}
              <div className="w-16 shrink-0 border-r border-gray-100">
                <div className="h-10 border-b border-gray-100" />
                {HOURS.map(h => {
                  const ampm = h >= 12 ? 'PM' : 'AM'
                  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                  return (
                    <div key={h} className="h-16 border-b border-gray-50 flex items-start justify-end pr-2 pt-1">
                      <span className="text-[11px] text-gray-400">{h12}:00 {ampm}</span>
                    </div>
                  )
                })}
              </div>

              {/* Day columns */}
              {visibleDays.map(day => {
                const citasDia = citasFiltradas.filter(c => isSameDayColombia(c.fecha_inicio, day))
                const dayIsToday = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 min-w-0 border-r border-gray-100 last:border-r-0"
                  >
                    <div
                      className={`h-10 border-b border-gray-100 flex flex-col items-center justify-center sticky top-0 z-20 ${
                        dayIsToday ? 'bg-beauty-primary/10' : 'bg-white'
                      }`}
                    >
                      <span className="text-[10px] text-gray-400 uppercase font-medium">
                        {format(day, 'EEE', { locale: es })} {format(day, 'd')}
                      </span>
                      {dayIsToday && <div className="w-1.5 h-1.5 rounded-full bg-beauty-primary mt-0.5" />}
                    </div>
                    <div className="relative">
                      {HOURS.map(h => (
                        <div key={h} className="h-16 border-b border-gray-50" />
                      ))}
                      {!loading && citasDia.map(cita => (
                        <CitaCard key={cita.id} cita={cita} onClick={() => setSelectedCita(cita)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Legend + occupancy */}
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3">
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, s]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  <span className="text-[11px] text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-gray-500">
                Ocupación: {Math.min(Math.round((citasHoy.length / 10) * 100), 100)}%
              </span>
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-beauty-primary rounded-full transition-all"
                  style={{ width: `${Math.min(Math.round((citasHoy.length / 10) * 100), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Detail panel — sidebar en desktop únicamente */}
        {selectedCita && (
          <div className="hidden sm:block">
            <DetailPanel
              cita={selectedCita}
              onClose={() => setSelectedCita(null)}
              onCompletar={solicitarCompletar}
              onCancelar={cancelarCita}
              onEliminar={eliminarCita}
            />
          </div>
        )}
      </div>

      {/* Modal detalle cita — MÓVIL (fuera del contenedor desktop para que fixed funcione) */}
      {selectedCita && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <DetailPanel
              cita={selectedCita}
              onClose={() => setSelectedCita(null)}
              onCompletar={solicitarCompletar}
              onCancelar={cancelarCita}
              onEliminar={eliminarCita}
            />
          </div>
        </div>
      )}

      {/* Completar modal */}
      {citaACompletar && (
        <CompletarModal
          cita={citaACompletar}
          onClose={() => setCitaACompletar(null)}
          onConfirm={completarCita}
        />
      )}

      {/* Nueva cita modal */}
      {showNuevaCita && (
        <NuevaCitaModal
          onClose={() => setShowNuevaCita(false)}
          onSaved={loadCitas}
        />
      )}
    </div>
  )
}
