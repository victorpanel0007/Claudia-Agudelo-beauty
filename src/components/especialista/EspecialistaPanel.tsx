'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { formatTime, formatCurrency } from '@/lib/utils'
import type { Cita, Servicio, Especialista } from '@/types/database'
import {
  LogOut, Clock, Calendar, CheckCircle, RefreshCw,
  Plus, X, Search, Check, CreditCard, DollarSign,
} from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'agenda' | 'nueva-cita' | 'comisiones'

interface CitaComision {
  id: string
  fecha_inicio: string
  fecha_fin: string
  valor_final: number | null
  porcentaje_comision: number | null
  comision_especialista: number | null
  pago_estado: string | null
  servicio: { nombre: string } | null
}

interface PagoHistorial {
  id: string
  fecha: string
  periodo: string
  valor_pagado: number
  metodo_pago: string
  observaciones: string | null
}

interface SlotOption {
  hora: string
  fecha_inicio: string
  fecha_fin: string
  especialista_id: string
  especialista_nombre: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS = {
  confirmada: { label: 'Confirmada', cls: 'bg-green-100 text-green-700 border-green-200' },
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  completada: { label: 'Completada', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700 border-red-200' },
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function dayLabel(fechaKey: string) {
  const hoy = todayStr()
  const manana = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if (fechaKey === hoy) return 'Hoy'
  if (fechaKey === manana) return 'Mañana'
  return format(new Date(`${fechaKey}T12:00:00-05:00`), "EEEE d 'de' MMMM", { locale: es })
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EspecialistaPanel({ userEmail, userName, especialistaId }: {
  userEmail: string
  userName: string
  especialistaId?: string
}) {
  const [tab, setTab] = useState<Tab>('agenda')
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [espId, setEspId] = useState<string | null>(especialistaId ?? null)
  const supabase = createClient()
  const router = useRouter()

  // ── Resolve especialista ID on mount ──────────────────────────────────────
  useEffect(() => {
    if (especialistaId) { setEspId(especialistaId); return }
    supabase.from('especialistas').select('id,nombre').eq('activo', true).then(({ data }) => {
      if (!data) return
      const nombre = userName || userEmail.split('@')[0]
      const found = data.find(e =>
        e.nombre.toLowerCase().includes(nombre.toLowerCase()) ||
        nombre.toLowerCase().includes(e.nombre.toLowerCase())
      )
      if (found) setEspId(found.id)
    })
  }, [especialistaId, userName, userEmail, supabase])

  // ── Load agenda ───────────────────────────────────────────────────────────
  const loadCitas = useCallback(async (silent = false) => {
    if (!espId) return
    if (!silent) setLoading(true); else setRefreshing(true)
    const hoyStr = todayStr()
    const hoy = new Date(`${hoyStr}T00:00:00-05:00`)
    const { data } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre), servicio:servicios(nombre,duracion_minutos,precio,precio_desde,tipo_precio), especialista:especialistas(nombre)')
      .eq('especialista_id', espId)
      .in('estado', ['confirmada', 'pendiente', 'en_proceso'])
      .gte('fecha_inicio', hoy.toISOString())
      .order('fecha_inicio', { ascending: true })
    setCitas((data as Cita[]) || [])
    setLoading(false); setRefreshing(false)
  }, [supabase, espId])

  useEffect(() => {
    loadCitas()
    const ch = supabase.channel('esp-citas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadCitas(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadCitas, supabase])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function marcarEnProceso(id: string) {
    await supabase.from('citas').update({ estado: 'en_proceso' }).eq('id', id)
    toast.success('Cita iniciada')
    loadCitas(true)
  }
  async function marcarCompletada(id: string) {
    await supabase.from('citas').update({ estado: 'completada' }).eq('id', id)
    toast.success('¡Cita completada! ✓')
    loadCitas(true)
  }
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/especialista/login')
  }

  // ── Grupos por día ────────────────────────────────────────────────────────
  const grupos: Record<string, Cita[]> = {}
  citas.forEach(c => {
    const key = new Date(c.fecha_inicio).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(c)
  })
  const citasHoy = citas.filter(c =>
    new Date(c.fecha_inicio).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) === todayStr()
  )

  return (
    <div className="min-h-screen bg-beauty-bg">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-beauty-primary/20 px-4 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-beauty-primary/30">
              <Image src="/logo.png" alt="Logo" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-beauty-text-dark text-sm">{userName || userEmail.split('@')[0]}</p>
              <p className="text-beauty-text-muted text-xs">Especialista</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadCitas(true)} disabled={refreshing}
              className="p-2 rounded-xl hover:bg-beauty-bg transition-colors text-beauty-text-muted">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors border border-red-100">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-beauty-primary/20 sticky top-[73px] z-20">
        <div className="max-w-2xl mx-auto flex">
          {([
            { key: 'agenda',      label: 'Mi Agenda',    icon: Calendar },
            { key: 'nueva-cita',  label: 'Nueva Cita',   icon: Plus },
            { key: 'comisiones',  label: 'Comisiones',   icon: DollarSign },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-beauty-primary text-beauty-primary'
                  : 'border-transparent text-beauty-text-muted hover:text-beauty-text'
              }`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {tab === 'agenda'     && <AgendaTab citas={citas} citasHoy={citasHoy} grupos={grupos} loading={loading} onIniciar={marcarEnProceso} onCompletar={marcarCompletada} />}
        {tab === 'nueva-cita' && <NuevaCitaTab espId={espId} onSaved={() => { loadCitas(true); setTab('agenda') }} />}
        {tab === 'comisiones' && <ComisionesTab espId={espId} />}
      </div>
    </div>
  )
}

// ── AgendaTab ──────────────────────────────────────────────────────────────

function AgendaTab({ citas, citasHoy, grupos, loading, onIniciar, onCompletar }: {
  citas: Cita[]
  citasHoy: Cita[]
  grupos: Record<string, Cita[]>
  loading: boolean
  onIniciar: (id: string) => void
  onCompletar: (id: string) => void
}) {
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-beauty-primary/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-beauty-primary" />
            <span className="text-xs font-medium text-beauty-text-muted">Citas hoy</span>
          </div>
          <p className="text-2xl font-bold text-beauty-text-dark">{citasHoy.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-beauty-primary/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-beauty-secondary" />
            <span className="text-xs font-medium text-beauty-text-muted">Próximas</span>
          </div>
          <p className="text-2xl font-bold text-beauty-text-dark">{citas.length}</p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-beauty-primary/20 p-4 animate-pulse h-28" />)}
        </div>
      ) : citas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-beauty-primary/20 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">🌸</p>
          <p className="font-semibold text-beauty-text-dark">No tienes citas pendientes</p>
          <p className="text-beauty-text-muted text-sm mt-1">Cuando lleguen nuevas citas aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grupos).map(([fecha, citasDia]) => (
            <div key={fecha}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${
                  isToday(parseISO(fecha + 'T12:00:00-05:00'))
                    ? 'bg-beauty-primary text-white'
                    : 'bg-beauty-secondary/20 text-beauty-secondary'
                }`}>{dayLabel(fecha)}</span>
                <span className="text-xs text-beauty-text-muted">{citasDia.length} cita{citasDia.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {citasDia.map(cita => {
                  const st = STATUS[cita.estado as keyof typeof STATUS] || STATUS.pendiente
                  return (
                    <div key={cita.id} className="bg-white rounded-2xl border border-beauty-primary/20 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="bg-beauty-primary/10 rounded-xl px-3 py-1.5">
                            <p className="font-bold text-beauty-primary text-sm">{formatTime(cita.fecha_inicio)}</p>
                          </div>
                          <span className="text-beauty-text-muted text-xs">→ {formatTime(cita.fecha_fin)}</span>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-beauty-rosa-claro flex items-center justify-center shrink-0 text-sm font-bold text-beauty-primary">
                          {(cita.cliente?.nombre || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-beauty-text-dark text-sm">{cita.cliente?.nombre || '—'}</p>
                          <p className="text-beauty-text-muted text-xs truncate">{cita.servicio?.nombre || 'Servicio no especificado'}</p>
                          {cita.servicio?.duracion_minutos && (
                            <p className="text-beauty-text-muted text-xs flex items-center gap-1 mt-0.5">
                              <Clock size={10} /> {cita.servicio.duracion_minutos} min
                              {cita.valor_final ? ` · ${formatCurrency(cita.valor_final)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {cita.observaciones && (
                        <div className="mt-3 bg-beauty-bg rounded-xl p-2.5">
                          <p className="text-xs text-beauty-text-muted">{cita.observaciones}</p>
                        </div>
                      )}
                      {(cita.estado === 'confirmada' || cita.estado === 'pendiente') && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-beauty-primary/10">
                          <button onClick={() => onIniciar(cita.id)}
                            className="flex-1 text-xs font-semibold py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                            Iniciar
                          </button>
                          <button onClick={() => onCompletar(cita.id)}
                            className="flex-1 text-xs font-semibold py-2 rounded-xl bg-beauty-primary text-white hover:bg-beauty-primary-dark transition-colors flex items-center justify-center gap-1">
                            <CheckCircle size={13} /> Completar
                          </button>
                        </div>
                      )}
                      {cita.estado === 'en_proceso' && (
                        <div className="mt-3 pt-3 border-t border-beauty-primary/10">
                          <button onClick={() => onCompletar(cita.id)}
                            className="w-full text-xs font-semibold py-2 rounded-xl bg-beauty-primary text-white hover:bg-beauty-primary-dark transition-colors flex items-center justify-center gap-1">
                            <CheckCircle size={13} /> Marcar como completada
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── NuevaCitaTab ───────────────────────────────────────────────────────────

function NuevaCitaTab({ espId, onSaved }: { espId: string | null; onSaved: () => void }) {
  const supabase = createClient()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientesSugeridos, setClientesSugeridos] = useState<{ id: string; nombre: string }[]>([])

  const [form, setForm] = useState({
    cliente_id: '',
    cliente_nombre: '',
    es_nuevo: false,
    servicio_id: '',
    fecha: todayStr(),
    slot_inicio: '',
    slot_fin: '',
    observaciones: '',
  })

  useEffect(() => {
    supabase.from('servicios').select('id,nombre,duracion_minutos,precio,precio_desde,tipo_precio').eq('activo', true).order('nombre')
      .then(({ data }) => { if (data) setServicios(data as Servicio[]) })
  }, [supabase])

  // Buscar clientes — solo nombre, sin teléfono (respeta privacidad)
  useEffect(() => {
    if (clienteSearch.length < 2) { setClientesSugeridos([]); return }
    supabase.from('clientes').select('id,nombre').ilike('nombre', `%${clienteSearch}%`).limit(5)
      .then(({ data }) => setClientesSugeridos((data || []) as { id: string; nombre: string }[]))
  }, [clienteSearch, supabase])

  const servicioSel = servicios.find(s => s.id === form.servicio_id)

  async function buscarSlots() {
    if (!form.fecha || !form.servicio_id) { toast.error('Selecciona servicio y fecha'); return }
    setLoadingSlots(true)
    const duracion = servicioSel?.duracion_minutos ?? 60
    const params = new URLSearchParams({
      fecha: new Date(form.fecha + 'T12:00:00-05:00').toISOString(),
      duracion: duracion.toString(),
      ...(espId ? { especialista_id: espId } : {}),
    })
    try {
      const res = await fetch(`/api/disponibilidad?${params}`)
      const data = await res.json()
      setSlots(Array.isArray(data) ? data : [])
    } catch { setSlots([]) }
    setLoadingSlots(false)
    setStep(2)
  }

  async function guardar() {
    if (!form.slot_inicio) { toast.error('Selecciona un horario'); return }
    if (!form.cliente_id && !form.es_nuevo) { toast.error('Selecciona o ingresa un cliente'); return }
    if (form.es_nuevo && !form.cliente_nombre.trim()) { toast.error('Ingresa el nombre del cliente'); return }
    setSaving(true)
    try {
      let clienteId = form.cliente_id
      if (form.es_nuevo) {
        const { data: nc, error } = await supabase.from('clientes')
          .insert({ nombre: form.cliente_nombre.trim(), telefono: '' }).select('id').single()
        if (error) throw error
        clienteId = nc.id
      }
      const slotSel = slots.find(s => s.fecha_inicio === form.slot_inicio)
      const body = {
        cliente_id: clienteId,
        especialista_id: slotSel?.especialista_id ?? espId ?? null,
        servicio_id: form.servicio_id || null,
        fecha_inicio: form.slot_inicio,
        fecha_fin: form.slot_fin,
        observaciones: form.observaciones || null,
        estado: 'confirmada',
        canal: 'admin',
      }
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('¡Cita creada! ✓')
      onSaved()
    } catch { toast.error('Error al crear la cita') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-beauty-primary/20 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={18} className="text-beauty-primary" />
          <h3 className="font-bold text-beauty-text-dark">Nueva Cita</h3>
          <span className="text-xs text-beauty-text-muted ml-auto">Paso {step} de 2</span>
        </div>
        <div className="flex mb-4">
          <div className={`h-1 flex-1 rounded-l-full transition-all ${step >= 1 ? 'bg-beauty-primary' : 'bg-gray-100'}`} />
          <div className={`h-1 flex-1 rounded-r-full transition-all ${step >= 2 ? 'bg-beauty-primary' : 'bg-gray-100'}`} />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {/* Cliente */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Cliente *</label>
              <div className="flex gap-2 mb-2">
                {['existente','nuevo'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, es_nuevo: t === 'nuevo', cliente_id: '', cliente_nombre: '' }))}
                    className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${
                      (t === 'nuevo') === form.es_nuevo
                        ? 'border-beauty-primary bg-beauty-primary/10 text-beauty-primary'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {t === 'nuevo' ? 'Cliente nuevo' : 'Cliente existente'}
                  </button>
                ))}
              </div>
              {form.es_nuevo ? (
                <input value={form.cliente_nombre}
                  onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))}
                  placeholder="Nombre del cliente *"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary" />
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                  <input value={clienteSearch}
                    onChange={e => { setClienteSearch(e.target.value); setForm(f => ({ ...f, cliente_id: '', cliente_nombre: '' })) }}
                    placeholder="Buscar cliente por nombre..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs pl-8 focus:outline-none focus:border-beauty-primary" />
                  {clienteSearch && clientesSugeridos.length > 0 && !form.cliente_id && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                      {clientesSugeridos.map(c => (
                        <button key={c.id} onClick={() => { setForm(f => ({ ...f, cliente_id: c.id, cliente_nombre: c.nombre })); setClienteSearch(c.nombre) }}
                          className="w-full text-left px-3 py-2.5 hover:bg-beauty-bg text-xs border-b border-gray-50 last:border-0 text-gray-700">
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.cliente_id && (
                    <div className="mt-2 flex items-center gap-2 bg-beauty-primary/10 border border-beauty-primary/30 rounded-xl px-3 py-2">
                      <Check size={14} className="text-beauty-primary" />
                      <span className="text-xs text-beauty-primary font-medium">{form.cliente_nombre}</span>
                      <button onClick={() => { setForm(f => ({ ...f, cliente_id: '', cliente_nombre: '' })); setClienteSearch('') }} className="ml-auto">
                        <X size={12} className="text-beauty-primary/60" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Servicio */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Servicio *</label>
              <select value={form.servicio_id} onChange={e => setForm(f => ({ ...f, servicio_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary">
                <option value="">Selecciona un servicio...</option>
                {servicios.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} — {s.duracion_minutos} min{s.precio ? ` · $${Number(s.precio).toLocaleString('es-CO')}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Fecha *</label>
              <input type="date" value={form.fecha}
                min={todayStr()}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-beauty-primary" />
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Observaciones</label>
              <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs resize-none focus:outline-none focus:border-beauty-primary"
                rows={2} placeholder="Alergias, preferencias, etc." />
            </div>

            <button onClick={buscarSlots} disabled={loadingSlots || !form.servicio_id || !form.fecha}
              className="w-full bg-beauty-primary text-white font-semibold py-3 rounded-xl text-sm hover:bg-beauty-primary-dark transition-all disabled:opacity-50">
              {loadingSlots ? 'Buscando horarios...' : 'Ver horarios disponibles →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <button onClick={() => setStep(1)} className="text-xs text-beauty-primary hover:underline">← Volver</button>
            <p className="text-xs font-semibold text-gray-600">Selecciona un horario</p>
            {slots.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">Sin horarios disponibles para esta fecha</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {slots.map(s => (
                  <button key={s.fecha_inicio}
                    onClick={() => setForm(f => ({ ...f, slot_inicio: s.fecha_inicio, slot_fin: s.fecha_fin }))}
                    className={`p-3 rounded-xl border text-xs font-medium transition-colors ${
                      form.slot_inicio === s.fecha_inicio
                        ? 'border-beauty-primary bg-beauty-primary text-white'
                        : 'border-gray-200 hover:border-beauty-primary hover:bg-beauty-primary/5'
                    }`}>
                    <p className="font-bold">{s.hora}</p>
                    <p className="opacity-75 mt-0.5">{s.especialista_nombre}</p>
                  </button>
                ))}
              </div>
            )}
            {form.slot_inicio && (
              <button onClick={guardar} disabled={saving}
                className="w-full bg-beauty-borgona text-white font-semibold py-3 rounded-xl text-sm hover:bg-beauty-borgona-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? 'Guardando...' : <><CheckCircle size={16} /> Confirmar Cita</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ComisionesTab ──────────────────────────────────────────────────────────

function ComisionesTab({ espId }: { espId: string | null }) {
  const [periodo, setPeriodo] = useState<'semana'|'quincena'|'mes'>('mes')
  const [citas, setCitas] = useState<CitaComision[]>([])
  const [pagos, setPagos] = useState<PagoHistorial[]>([])
  const [porcentaje, setPorcentaje] = useState(40)
  const [loading, setLoading] = useState(true)
  const [showPagos, setShowPagos] = useState(false)

  function getPeriodRange() {
    const hoy = todayStr()
    const d = new Date(hoy + 'T12:00:00-05:00')
    if (periodo === 'semana') {
      const s = new Date(d); s.setDate(d.getDate() - 6)
      return { desde: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), hasta: hoy }
    }
    if (periodo === 'quincena') {
      const s = new Date(d); s.setDate(d.getDate() - 14)
      return { desde: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), hasta: hoy }
    }
    const s = new Date(d.getFullYear(), d.getMonth(), 1)
    return { desde: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), hasta: hoy }
  }

  useEffect(() => {
    if (!espId) return
    setLoading(true)
    const { desde, hasta } = getPeriodRange()
    fetch(`/api/especialista/mis-comisiones?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error('Error cargando comisiones'); return }
        setPorcentaje(d.porcentaje ?? 40)
        setCitas(d.citas ?? [])
        setPagos(d.pagos ?? [])
      })
      .catch(() => toast.error('Error cargando comisiones'))
      .finally(() => setLoading(false))
  }, [espId, periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalFacturado = citas.reduce((a, c) => a + (c.valor_final ?? 0), 0)
  const totalComision  = citas.reduce((a, c) => a + (c.comision_especialista ?? ((c.valor_final ?? 0) * porcentaje / 100)), 0)
  const totalPagado    = pagos.reduce((a, p) => a + p.valor_pagado, 0)
  const saldoPendiente = Math.max(0, totalComision - totalPagado)

  return (
    <div className="space-y-4">
      {/* Período */}
      <div className="flex gap-2">
        {([
          { key: 'semana',   label: 'Semana' },
          { key: 'quincena', label: 'Quincena' },
          { key: 'mes',      label: 'Mes' },
        ] as { key: typeof periodo; label: string }[]).map(b => (
          <button key={b.key} onClick={() => setPeriodo(b.key)}
            className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors ${
              periodo === b.key
                ? 'bg-beauty-primary text-white'
                : 'bg-white border border-beauty-primary/30 text-beauty-text-muted hover:border-beauty-primary'
            }`}>
            {b.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-beauty-primary/20 animate-pulse" />)}</div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Citas realizadas', value: String(citas.length), icon: CheckCircle, color: 'bg-violet-100 text-violet-600' },
              { label: `Mi comisión (${porcentaje}%)`, value: formatCurrency(totalComision), icon: DollarSign, color: 'bg-beauty-rosa-claro text-beauty-borgona' },
              { label: 'Total pagado', value: formatCurrency(totalPagado), icon: CreditCard, color: 'bg-teal-100 text-teal-600' },
              { label: 'Saldo pendiente', value: formatCurrency(saldoPendiente), icon: Clock,
                color: saldoPendiente > 0 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-beauty-primary/20 p-4 shadow-sm">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${card.color}`}>
                  <card.icon size={16} />
                </div>
                <p className="text-base font-bold text-beauty-text-dark">{card.value}</p>
                <p className="text-[11px] text-beauty-text-muted mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Detalle citas */}
          {citas.length > 0 && (
            <div className="bg-white rounded-2xl border border-beauty-primary/20 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <p className="font-semibold text-beauty-text-dark text-sm">Detalle de citas</p>
              </div>
              <div className="divide-y divide-gray-50">
                {citas.map(c => {
                  const com = c.comision_especialista ?? ((c.valor_final ?? 0) * porcentaje / 100)
                  return (
                    <div key={c.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-beauty-text-dark truncate">
                          {(c.servicio as { nombre?: string } | null)?.nombre ?? '—'}
                        </p>
                        <p className="text-[11px] text-beauty-text-muted">
                          {new Date(c.fecha_inicio).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-beauty-borgona">{formatCurrency(com)}</p>
                        <p className="text-[10px] text-beauty-text-muted">de {formatCurrency(c.valor_final ?? 0)}</p>
                      </div>
                      {c.pago_estado === 'pagado' ? (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Pagado</span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">Pendiente</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="p-3 bg-beauty-bg flex items-center justify-between">
                <span className="text-xs font-semibold text-beauty-text-muted">Total facturado</span>
                <span className="text-sm font-bold text-beauty-text-dark">{formatCurrency(totalFacturado)}</span>
              </div>
            </div>
          )}

          {/* Historial pagos */}
          <div className="bg-white rounded-2xl border border-beauty-primary/20 shadow-sm overflow-hidden">
            <button className="w-full p-4 flex items-center justify-between"
              onClick={() => setShowPagos(v => !v)}>
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-beauty-borgona" />
                <p className="font-semibold text-beauty-text-dark text-sm">Historial de pagos</p>
                <span className="text-xs bg-beauty-rosa-claro text-beauty-borgona px-2 py-0.5 rounded-full">{pagos.length}</span>
              </div>
              <span className="text-beauty-text-muted text-xs">{showPagos ? '▲' : '▼'}</span>
            </button>
            {showPagos && (
              pagos.length === 0 ? (
                <div className="p-6 text-center text-beauty-text-muted text-sm border-t border-gray-100">
                  No hay pagos registrados en este período
                </div>
              ) : (
                <div className="divide-y divide-gray-50 border-t border-gray-100">
                  {pagos.map(p => (
                    <div key={p.id} className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                        <CreditCard size={14} className="text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-beauty-text-dark capitalize">{p.metodo_pago}</p>
                        <p className="text-[11px] text-beauty-text-muted">
                          {p.fecha} · {p.periodo}
                          {p.observaciones ? ` · ${p.observaciones}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-teal-600 shrink-0">{formatCurrency(p.valor_pagado)}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
