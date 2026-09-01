'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { formatTime, formatDate, formatCurrency } from '@/lib/utils'
import type { Cita } from '@/types/database'
import {
  LogOut, Clock, Calendar, CheckCircle, RefreshCw,
  Plus, X, Search, Loader2, ChevronDown, Scissors,
  DollarSign, XCircle, History, BarChart2, Star,
} from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ClienteMin { id: string; nombre: string }           // sin teléfono
interface ServicioMin { id: string; nombre: string; duracion_minutos: number; precio?: number | null }
interface EspecialistaMin { id: string; nombre: string }

const STATUS = {
  confirmada: { label: 'Confirmada', cls: 'bg-green-100 text-green-700 border-green-200' },
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  completada: { label: 'Completada', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700 border-red-200' },
}

function dayLabel(fechaKey: string) {
  const d = new Date(`${fechaKey}T12:00:00-05:00`)
  const hoy   = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const mañana = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if (fechaKey === hoy)   return 'Hoy'
  if (fechaKey === mañana) return 'Mañana'
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

function todayCol() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function EspecialistaPanel({
  userEmail, userName, especialistaId,
}: {
  userEmail: string
  userName:  string
  especialistaId?: string
}) {
  const supabase  = createClient()
  const router    = useRouter()

  // ── Estado principal ────────────────────────────────────────────────────
  const [espId,      setEspId]      = useState<string | null>(null)
  const [citas,      setCitas]      = useState<Cita[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // ── Tabs ────────────────────────────────────────────────────────────────
  type Tab = 'hoy' | 'proximas' | 'anteriores' | 'contabilidad'
  const [tab, setTab] = useState<Tab>('hoy')

  // ── Completar cita ──────────────────────────────────────────────────────
  const [citaACompletar,    setCitaACompletar]    = useState<Cita | null>(null)
  const [valorCompletar,    setValorCompletar]    = useState('')
  const [metodoPagoCompl,   setMetodoPagoCompl]   = useState('efectivo')
  const [savingCompletar,   setSavingCompletar]   = useState(false)

  // ── Nueva cita ──────────────────────────────────────────────────────────
  const [showNuevaCita,     setShowNuevaCita]     = useState(false)
  const [clientes,          setClientes]          = useState<ClienteMin[]>([])
  const [servicios,         setServicios]         = useState<ServicioMin[]>([])
  const [clienteSearch,     setClienteSearch]     = useState('')
  const [clienteDropdown,   setClienteDropdown]   = useState(false)
  const [servicioSearch,    setServicioSearch]    = useState('')
  const [servicioDropdown,  setServicioDropdown]  = useState(false)
  const [ncClienteId,       setNcClienteId]       = useState('')
  const [ncServicioId,      setNcServicioId]      = useState('')
  const [ncFecha,           setNcFecha]           = useState(todayCol())
  const [ncHora,            setNcHora]            = useState('')
  const [ncSlots,           setNcSlots]           = useState<{ hora: string; fecha_inicio: string; fecha_fin: string }[]>([])
  const [loadingSlots,      setLoadingSlots]      = useState(false)
  const [savingCita,        setSavingCita]        = useState(false)
  const [ncStep,            setNcStep]            = useState(1)

  // ── Citas anteriores ────────────────────────────────────────────────────
  const [anteriores,        setAnteriores]        = useState<Cita[]>([])
  const [loadingAnt,        setLoadingAnt]        = useState(false)
  type PeriodoAnt = 'hoy' | 'semana' | 'mes'
  const [periodoAnt,        setPeriodoAnt]        = useState<PeriodoAnt>('mes')

  // ── Mi contabilidad ─────────────────────────────────────────────────────
  const [contab,            setContab]            = useState<{
    total: number; citas: number
    totalPagado: number; saldoPendiente: number
    porcentaje: number
    porDia: { fecha: string; citas: number; total: number; comision: number; pagado: number; pendiente: number }[]
  } | null>(null)
  const [loadingContab,     setLoadingContab]     = useState(false)
  type PeriodoContab = 'hoy' | 'semana' | 'quincena' | 'mes' | 'anio'
  const [periodoContab,     setPeriodoContab]     = useState<PeriodoContab>('mes')

  // ── Servicio extra ──────────────────────────────────────────────────────
  const [showExtra,         setShowExtra]         = useState(false)
  const [exClienteSearch,   setExClienteSearch]   = useState('')
  const [exClienteDropdown, setExClienteDropdown] = useState(false)
  const [exClienteId,       setExClienteId]       = useState('')
  const [exServicioSearch,  setExServicioSearch]  = useState('')
  const [exServicioDropdown,setExServicioDropdown]= useState(false)
  const [exServicioId,      setExServicioId]      = useState('')
  const [exFecha,           setExFecha]           = useState(todayCol())
  const [exValor,           setExValor]           = useState('')
  const [exMetodo,          setExMetodo]          = useState('efectivo')
  const [savingExtra,       setSavingExtra]       = useState(false)

  // ── Resolver especialista ────────────────────────────────────────────────
  const resolveEsp = useCallback(async () => {
    if (especialistaId) { setEspId(especialistaId); return }
    const { data } = await supabase.from('especialistas').select('id, nombre').eq('activo', true)
    const nombre = userName || userEmail.split('@')[0]
    const found = data?.find(e =>
      e.nombre.toLowerCase().includes(nombre.toLowerCase()) ||
      nombre.toLowerCase().includes(e.nombre.toLowerCase())
    )
    if (found) setEspId(found.id)
  }, [especialistaId, userName, userEmail, supabase])

  // ── Carga de citas activas ───────────────────────────────────────────────
  const loadCitas = useCallback(async (silent = false) => {
    if (!espId) return
    if (!silent) setLoading(true); else setRefreshing(true)
    const hoy = new Date(`${todayCol()}T00:00:00-05:00`)
    // PRIVACIDAD: solo nombre del cliente, sin teléfono
    const { data } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre), servicio:servicios(nombre,duracion_minutos,precio), especialista:especialistas(nombre)')
      .eq('especialista_id', espId)
      .in('estado', ['confirmada', 'pendiente', 'en_proceso'])
      .gte('fecha_inicio', hoy.toISOString())
      .order('fecha_inicio', { ascending: true })
    setCitas((data as Cita[]) || [])
    setLoading(false); setRefreshing(false)
  }, [espId, supabase])

  // ── Carga de datos auxiliares para nueva cita ────────────────────────────
  const loadAuxData = useCallback(async () => {
    const [c, s] = await Promise.all([
      // Solo nombre — sin teléfono ni datos personales
      supabase.from('clientes').select('id, nombre').order('nombre').limit(500),
      supabase.from('servicios').select('id, nombre, duracion_minutos, precio').eq('activo', true).order('nombre'),
    ])
    if (c.data) setClientes(c.data as ClienteMin[])
    if (s.data) setServicios(s.data as ServicioMin[])
  }, [supabase])

  useEffect(() => { resolveEsp() }, [resolveEsp])
  useEffect(() => {
    if (!espId) return
    loadCitas()
    loadAuxData()
    const ch = supabase.channel('esp-citas-' + espId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadCitas(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [espId, loadCitas, loadAuxData, supabase])

  // ── Citas anteriores ─────────────────────────────────────────────────────
  const loadAnteriores = useCallback(async () => {
    if (!espId) return
    setLoadingAnt(true)
    const hoy = todayCol()
    let start = hoy
    if (periodoAnt === 'semana') {
      const d = new Date(); d.setDate(d.getDate() - 6)
      start = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    } else if (periodoAnt === 'mes') {
      const d = new Date()
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    }
    const { data } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre), servicio:servicios(nombre,duracion_minutos)')
      .eq('especialista_id', espId)
      .eq('estado', 'completada')
      .gte('fecha_inicio', `${start}T00:00:00-05:00`)
      .lte('fecha_inicio', `${hoy}T23:59:59-05:00`)
      .order('fecha_inicio', { ascending: false })
      .limit(100)
    setAnteriores((data as Cita[]) || [])
    setLoadingAnt(false)
  }, [espId, periodoAnt, supabase])

  useEffect(() => { if (tab === 'anteriores') loadAnteriores() }, [tab, periodoAnt, loadAnteriores])

  // ── Mi contabilidad ───────────────────────────────────────────────────────
  const loadContab = useCallback(async () => {
    if (!espId) return
    setLoadingContab(true)
    const hoy = todayCol()
    let start = hoy
    if (periodoContab === 'hoy') { start = hoy }
    else if (periodoContab === 'semana') {
      const d = new Date(); d.setDate(d.getDate() - 6)
      start = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    } else if (periodoContab === 'quincena') {
      const d = new Date(); d.setDate(d.getDate() - 14)
      start = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    } else if (periodoContab === 'mes') {
      const d = new Date()
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    } else {
      start = `${new Date().getFullYear()}-01-01`
    }

    // Obtener comisión configurada y citas del período
    const [{ data: citasData }, { data: comConfig }] = await Promise.all([
      supabase
        .from('citas')
        .select('id, fecha_inicio, valor_final, pago_estado, porcentaje_comision')
        .eq('especialista_id', espId)
        .eq('estado', 'completada')
        .gte('fecha_inicio', `${start}T00:00:00-05:00`)
        .lte('fecha_inicio', `${hoy}T23:59:59-05:00`)
        .order('fecha_inicio', { ascending: false }),
      supabase
        .from('comisiones_config')
        .select('porcentaje')
        .eq('especialista_id', espId)
        .maybeSingle(),
    ])

    const porcentaje = (comConfig?.porcentaje as number | null) ?? 50
    const lista = (citasData || []) as { id: string; fecha_inicio: string; valor_final: number | null; pago_estado: string | null; porcentaje_comision: number | null }[]

    const total = lista.reduce((a, c) => a + (c.valor_final ?? 0), 0)
    const totalPagado = lista.filter(c => c.pago_estado === 'pagado').reduce((a, c) => a + (c.valor_final ?? 0) * ((c.porcentaje_comision ?? porcentaje) / 100), 0)
    const comisionTotal = lista.reduce((a, c) => a + (c.valor_final ?? 0) * ((c.porcentaje_comision ?? porcentaje) / 100), 0)
    const saldoPendiente = comisionTotal - totalPagado

    // Agrupar por día
    const diaMap: Record<string, { citas: number; total: number; comision: number; pagado: number }> = {}
    lista.forEach(c => {
      const dia = c.fecha_inicio.slice(0, 10)
      if (!diaMap[dia]) diaMap[dia] = { citas: 0, total: 0, comision: 0, pagado: 0 }
      const val = c.valor_final ?? 0
      const com = val * ((c.porcentaje_comision ?? porcentaje) / 100)
      diaMap[dia].citas++
      diaMap[dia].total += val
      diaMap[dia].comision += com
      if (c.pago_estado === 'pagado') diaMap[dia].pagado += com
    })
    const porDia = Object.entries(diaMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, v]) => ({ fecha, ...v, pendiente: v.comision - v.pagado }))

    setContab({ total, citas: lista.length, totalPagado, saldoPendiente, porcentaje, porDia })
    setLoadingContab(false)
  }, [espId, periodoContab, supabase])

  useEffect(() => { if (tab === 'contabilidad') loadContab() }, [tab, periodoContab, loadContab])

  // ── Acciones de cita ──────────────────────────────────────────────────────
  async function marcarEnProceso(id: string) {
    await supabase.from('citas').update({ estado: 'en_proceso' }).eq('id', id)
    toast.success('Cita en proceso')
    loadCitas(true)
  }

  async function cancelarCita(id: string) {
    if (!confirm('¿Estás segura de que deseas cancelar esta cita?')) return
    await supabase.from('citas').update({ estado: 'cancelada' }).eq('id', id)
    toast.success('Cita cancelada')
    loadCitas(true)
  }

  async function confirmarCompletar() {
    if (!citaACompletar) return
    const valor = Number(valorCompletar)
    if (!valor || valor <= 0) { toast.error('Ingresa un valor válido'); return }
    setSavingCompletar(true)
    const { error } = await supabase.from('citas').update({
      estado: 'completada',
      valor_final: valor,
      metodo_pago: metodoPagoCompl,
    }).eq('id', citaACompletar.id)
    if (error) { toast.error('Error al completar'); } else {
      toast.success(`✅ Cita completada · ${formatCurrency(valor)}`)
      setCitaACompletar(null); setValorCompletar(''); setMetodoPagoCompl('efectivo')
      loadCitas(true)
    }
    setSavingCompletar(false)
  }

  // ── Nueva cita ────────────────────────────────────────────────────────────
  const servicioSeleccionado = servicios.find(s => s.id === ncServicioId)

  async function buscarSlots() {
    if (!ncFecha || !ncServicioId || !espId) return
    setLoadingSlots(true)
    const duracion = servicioSeleccionado?.duracion_minutos ?? 60
    const params = new URLSearchParams({
      fecha: new Date(ncFecha + 'T12:00:00-05:00').toISOString(),
      duracion: String(duracion),
      especialista_id: espId,
    })
    const res = await fetch(`/api/disponibilidad?${params}`)
    const data = await res.json()
    setNcSlots(Array.isArray(data) ? data.map((s: { hora: string; fecha_inicio: string; fecha_fin: string }) => ({ hora: s.hora, fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin })) : [])
    setLoadingSlots(false)
    setNcStep(2)
  }

  async function guardarNuevaCita(slotInicio: string, slotFin: string) {
    if (!ncClienteId || !ncServicioId || !espId) { toast.error('Completa todos los campos'); return }
    setSavingCita(true)
    const res = await fetch('/api/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id:      ncClienteId,
        especialista_id: espId,
        servicio_id:     ncServicioId,
        fecha_inicio:    slotInicio,
        fecha_fin:       slotFin,
        estado:          'confirmada',
        canal:           'admin',
      }),
    })
    if (res.ok) {
      toast.success('✅ Cita creada')
      setShowNuevaCita(false)
      setNcClienteId(''); setClienteSearch(''); setNcServicioId(''); setServicioSearch('')
      setNcFecha(todayCol()); setNcHora(''); setNcSlots([]); setNcStep(1)
      loadCitas(true)
    } else {
      const e = await res.json()
      toast.error(e.error || 'Error al crear cita')
    }
    setSavingCita(false)
  }

  // ── Servicio extra ────────────────────────────────────────────────────────
  async function guardarExtra() {
    if (!exClienteId) { toast.error('Selecciona un cliente'); return }
    if (!exServicioId) { toast.error('Selecciona un servicio'); return }
    if (!espId) return
    const valor = Number(exValor)
    if (!valor || valor <= 0) { toast.error('Ingresa un valor válido'); return }
    setSavingExtra(true)
    const clienteNombre = clientes.find(c => c.id === exClienteId)?.nombre ?? ''
    const res = await fetch('/api/servicios-extras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha:            exFecha || todayCol(),
        servicio_id:      exServicioId,
        especialista_id:  espId,
        cliente_id:       exClienteId,
        cliente_nombre:   clienteNombre,
        valor_final:      valor,
        metodo_pago:      exMetodo,
        es_nuevo_cliente: false,
      }),
    })
    if (res.ok) {
      toast.success('✅ Servicio extra registrado')
      setShowExtra(false)
      setExClienteId(''); setExClienteSearch(''); setExServicioId(''); setExServicioSearch('')
      setExFecha(todayCol()); setExValor(''); setExMetodo('efectivo')
    } else {
      const e = await res.json(); toast.error(e.error || 'Error')
    }
    setSavingExtra(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/especialista/login')
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const hoyStr  = todayCol()
  const citasHoy = citas.filter(c => new Date(c.fecha_inicio).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) === hoyStr)
  const proximas = citas.filter(c => new Date(c.fecha_inicio).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) > hoyStr)

  const grupos: Record<string, Cita[]> = {}
  const citasTab = tab === 'hoy' ? citasHoy : proximas
  citasTab.forEach(c => {
    const key = new Date(c.fecha_inicio).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(c)
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-beauty-bg">

      {/* Header */}
      <header className="bg-white border-b border-beauty-primary/20 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-beauty-primary/30">
              <Image src="/logo.png" alt="Logo" width={36} height={36} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-beauty-text-dark text-sm">{userName || userEmail.split('@')[0]}</p>
              <p className="text-beauty-text-muted text-xs">Especialista</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadCitas(true)} disabled={refreshing}
              className="p-2 rounded-xl hover:bg-beauty-bg transition-colors text-beauty-text-muted">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { icon: Calendar,   label: 'Hoy',      value: citasHoy.length,  color: 'text-beauty-primary bg-beauty-rosa-claro' },
            { icon: Clock,      label: 'Próximas', value: proximas.length,   color: 'text-beauty-secondary bg-beauty-secondary/10' },
            { icon: CheckCircle,label: 'Completadas', value: anteriores.length, color: 'text-purple-600 bg-purple-50' },
            { icon: Star,       label: 'Extras',   value: 0,                 color: 'text-amber-600 bg-amber-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-beauty-primary/20 p-3 shadow-sm flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon size={15} />
              </div>
              <div>
                <p className="text-lg font-bold text-beauty-text-dark leading-none">{s.value}</p>
                <p className="text-[10px] text-beauty-text-muted">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-beauty-primary/20 rounded-xl p-1 mb-4 shadow-sm overflow-x-auto">
          {([
            { key: 'hoy',         label: '📅 Hoy',          icon: null },
            { key: 'proximas',    label: '🕐 Próximas',     icon: null },
            { key: 'anteriores',  label: '📋 Anteriores',   icon: null },
            { key: 'contabilidad',label: '💰 Contabilidad', icon: null },
          ] as { key: Tab; label: string; icon: null }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all ${
                tab === t.key ? 'bg-beauty-primary text-white shadow-sm' : 'text-beauty-text-muted hover:bg-beauty-bg'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: HOY / PRÓXIMAS ──────────────────────────────────────────── */}
        {(tab === 'hoy' || tab === 'proximas') && (
          loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-beauty-primary/20 p-4 animate-pulse h-28" />)}
            </div>
          ) : Object.keys(grupos).length === 0 ? (
            <div className="bg-white rounded-2xl border border-beauty-primary/20 p-10 text-center shadow-sm">
              <p className="text-4xl mb-3">🌸</p>
              <p className="font-semibold text-beauty-text-dark">No hay citas {tab === 'hoy' ? 'hoy' : 'próximas'}</p>
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
                              {/* Solo nombre — sin teléfono */}
                              <p className="font-semibold text-beauty-text-dark text-sm">{cita.cliente?.nombre || '—'}</p>
                              <p className="text-beauty-text-muted text-xs truncate">{cita.servicio?.nombre || '—'}</p>
                              {cita.servicio?.duracion_minutos && (
                                <p className="text-beauty-text-muted text-xs flex items-center gap-1 mt-0.5">
                                  <Clock size={10} /> {cita.servicio.duracion_minutos} min
                                </p>
                              )}
                            </div>
                          </div>
                          {cita.observaciones && (
                            <div className="mt-3 bg-beauty-bg rounded-xl p-2.5">
                              <p className="text-xs text-beauty-text-muted">{cita.observaciones}</p>
                            </div>
                          )}
                          {/* Acciones */}
                          {(cita.estado === 'confirmada' || cita.estado === 'pendiente') && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-beauty-primary/10">
                              <button onClick={() => marcarEnProceso(cita.id)}
                                className="flex-1 text-xs font-semibold py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                                Iniciar
                              </button>
                              <button onClick={() => { setCitaACompletar(cita); setValorCompletar(String(cita.servicio?.precio ?? '')) }}
                                className="flex-1 text-xs font-semibold py-2 rounded-xl bg-beauty-primary text-white hover:bg-beauty-primary-dark transition-colors flex items-center justify-center gap-1">
                                <CheckCircle size={13} /> Completar
                              </button>
                              <button onClick={() => cancelarCita(cita.id)}
                                className="text-xs font-semibold py-2 px-3 rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors">
                                <XCircle size={13} />
                              </button>
                            </div>
                          )}
                          {cita.estado === 'en_proceso' && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-beauty-primary/10">
                              <button onClick={() => { setCitaACompletar(cita); setValorCompletar(String(cita.servicio?.precio ?? '')) }}
                                className="flex-1 text-xs font-semibold py-2 rounded-xl bg-beauty-primary text-white hover:bg-beauty-primary-dark transition-colors flex items-center justify-center gap-1">
                                <CheckCircle size={13} /> Completar
                              </button>
                              <button onClick={() => cancelarCita(cita.id)}
                                className="text-xs font-semibold py-2 px-3 rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors">
                                <XCircle size={13} />
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
          )
        )}

        {/* ── TAB: ANTERIORES ──────────────────────────────────────────────── */}
        {tab === 'anteriores' && (
          <div>
            <div className="flex gap-1.5 mb-4">
              {(['hoy','semana','mes'] as PeriodoAnt[]).map(p => (
                <button key={p} onClick={() => setPeriodoAnt(p)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-colors ${
                    periodoAnt === p ? 'bg-beauty-primary text-white border-beauty-primary' : 'bg-white border-gray-200 text-gray-600'
                  }`}>
                  {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : 'Este mes'}
                </button>
              ))}
            </div>
            {loadingAnt ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}</div>
            ) : anteriores.length === 0 ? (
              <div className="bg-white rounded-2xl border border-beauty-primary/20 p-8 text-center">
                <History size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">Sin citas completadas en este período</p>
              </div>
            ) : (
              <div className="space-y-2">
                {anteriores.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-beauty-primary/20 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-beauty-text-dark">{c.cliente?.nombre}</p>
                        <p className="text-xs text-gray-500">{c.servicio?.nombre} · {formatDate(c.fecha_inicio)} {formatTime(c.fecha_inicio)}</p>
                      </div>
                      <div className="text-right">
                        {c.valor_final ? <p className="font-bold text-beauty-borgona text-sm">{formatCurrency(c.valor_final)}</p> : null}
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Completada</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CONTABILIDAD ────────────────────────────────────────────── */}
        {tab === 'contabilidad' && (
          <div>
            <div className="flex gap-1 flex-wrap mb-4">
              {(['hoy','semana','quincena','mes','anio'] as PeriodoContab[]).map(p => (
                <button key={p} onClick={() => setPeriodoContab(p)}
                  className={`text-xs px-2.5 py-1.5 rounded-xl font-semibold border transition-colors ${
                    periodoContab === p ? 'bg-beauty-primary text-white border-beauty-primary' : 'bg-white border-gray-200 text-gray-600'
                  }`}>
                  {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : p === 'quincena' ? '15 días' : p === 'mes' ? 'Este mes' : 'Este año'}
                </button>
              ))}
            </div>
            {loadingContab ? (
              <div className="h-40 bg-white rounded-2xl animate-pulse" />
            ) : contab ? (
              <div className="space-y-3">
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-xl border border-beauty-primary/20 p-3 shadow-sm">
                    <p className="text-[10px] text-gray-400 mb-0.5">📅 Citas realizadas</p>
                    <p className="text-xl font-bold text-beauty-text-dark">{contab.citas}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 shadow-sm">
                    <p className="text-[10px] text-gray-500 mb-0.5">💰 Total facturado</p>
                    <p className="text-base font-bold text-emerald-700">{formatCurrency(contab.total)}</p>
                  </div>
                  <div className="bg-beauty-secondary/10 rounded-xl border border-beauty-secondary/20 p-3 shadow-sm">
                    <p className="text-[10px] text-gray-500 mb-0.5">👩‍💼 Mi comisión ({contab.porcentaje}%)</p>
                    <p className="text-base font-bold text-beauty-secondary">{formatCurrency(contab.total * contab.porcentaje / 100)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 shadow-sm">
                    <p className="text-[10px] text-gray-500 mb-0.5">💵 Total pagado</p>
                    <p className="text-base font-bold text-blue-700">{formatCurrency(contab.totalPagado)}</p>
                  </div>
                  <div className={`col-span-2 rounded-xl border p-3 shadow-sm ${contab.saldoPendiente > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-[10px] text-gray-500 mb-0.5">⚠️ Saldo pendiente</p>
                    <p className={`text-lg font-bold ${contab.saldoPendiente > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{formatCurrency(contab.saldoPendiente)}</p>
                  </div>
                </div>

                {/* Resumen por día */}
                {contab.porDia.length > 0 && (
                  <div className="bg-white rounded-2xl border border-beauty-primary/20 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-beauty-text-dark">Resumen por día</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {contab.porDia.map(d => (
                        <div key={d.fecha} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-beauty-text-dark">
                              {new Date(d.fecha + 'T12:00:00-05:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{d.citas} cita{d.citas !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-[9px] text-gray-400">Facturado</p>
                              <p className="text-xs font-semibold text-emerald-700">{formatCurrency(d.total)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-gray-400">Comisión</p>
                              <p className="text-xs font-semibold text-beauty-secondary">{formatCurrency(d.comision)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-gray-400">{d.pendiente > 0 ? 'Pendiente' : 'Pagado'}</p>
                              <p className={`text-xs font-semibold ${d.pendiente > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                                {formatCurrency(d.pendiente > 0 ? d.pendiente : d.pagado)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

      </div>

      {/* ── MODAL: COMPLETAR CITA ──────────────────────────────────────────── */}
      {citaACompletar && (
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-2xl animate-slide-up" style={{ maxHeight: 'calc(100dvh - 56px)', overflowY: 'auto' }}>
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-8 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-beauty-text-dark flex items-center gap-2"><CheckCircle size={16} className="text-beauty-primary" /> Completar cita</h3>
              <button onClick={() => setCitaACompletar(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-beauty-bg rounded-xl p-3">
                <p className="font-semibold text-sm text-beauty-text-dark">{citaACompletar.cliente?.nombre}</p>
                <p className="text-xs text-gray-500">{citaACompletar.servicio?.nombre} · {formatTime(citaACompletar.fecha_inicio)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Valor cobrado *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" value={valorCompletar} onChange={e => setValorCompletar(e.target.value)}
                    placeholder="0" autoFocus
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-lg font-bold focus:outline-none focus:border-beauty-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: 'efectivo', l: '💵 Efectivo' }, { v: 'transferencia', l: '📲 Transferencia' },
                    { v: 'nequi', l: '💜 Nequi' }, { v: 'daviplata', l: '🟡 Daviplata' }].map(m => (
                    <button key={m.v} type="button" onClick={() => setMetodoPagoCompl(m.v)}
                      className={`text-xs py-2 rounded-xl border-2 font-medium transition-all ${
                        metodoPagoCompl === m.v ? 'border-beauty-primary bg-beauty-primary/10 text-beauty-borgona' : 'border-gray-200 text-gray-500'
                      }`}>{m.l}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pb-2">
                <button onClick={() => setCitaACompletar(null)} className="flex-1 border-2 border-gray-200 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
                <button onClick={confirmarCompletar} disabled={savingCompletar}
                  className="flex-1 bg-beauty-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingCompletar ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><CheckCircle size={14} /> Confirmar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA CITA ─────────────────────────────────────────────── */}
      {showNuevaCita && (
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-2xl animate-slide-up" style={{ maxHeight: 'calc(100dvh - 56px)', overflowY: 'auto' }}>
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-8 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-beauty-text-dark flex items-center gap-2"><Plus size={16} className="text-beauty-primary" /> Nueva cita</h3>
              <button onClick={() => { setShowNuevaCita(false); setNcStep(1) }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>

            {ncStep === 1 && (
              <div className="p-5 space-y-4">
                {/* Cliente — solo por nombre */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">👤 Buscar cliente por nombre</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                    <input type="text" value={clienteSearch}
                      onChange={e => { setClienteSearch(e.target.value); setClienteDropdown(true) }}
                      onFocus={() => setClienteDropdown(true)}
                      placeholder="Escribe el nombre..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 pl-8 text-sm focus:outline-none focus:border-beauty-primary" />
                    {ncClienteId && !clienteDropdown && (
                      <div className="mt-1 flex items-center gap-2 bg-beauty-primary/10 border border-beauty-primary/30 rounded-xl px-3 py-1.5">
                        <CheckCircle size={12} className="text-beauty-primary" />
                        <span className="text-xs text-beauty-primary font-medium flex-1 truncate">
                          {clientes.find(c => c.id === ncClienteId)?.nombre}
                        </span>
                        <button type="button" onClick={() => { setNcClienteId(''); setClienteSearch('') }}
                          className="text-beauty-primary/60"><X size={11} /></button>
                      </div>
                    )}
                    {clienteDropdown && clienteSearch && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-0.5 max-h-40 overflow-y-auto">
                        {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 8).map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setNcClienteId(c.id); setClienteSearch(c.nombre); setClienteDropdown(false) }}
                            className="w-full text-left px-3 py-2 hover:bg-beauty-bg text-sm border-b border-gray-50 last:border-0">
                            {c.nombre}
                          </button>
                        ))}
                        {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Servicio */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">✂️ Buscar servicio</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                    <input type="text" value={servicioSearch}
                      onChange={e => { setServicioSearch(e.target.value); setServicioDropdown(true); if (!e.target.value) setNcServicioId('') }}
                      onFocus={() => setServicioDropdown(true)}
                      placeholder="Escribe el nombre del servicio..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 pl-8 text-sm focus:outline-none focus:border-beauty-primary" />
                    {ncServicioId && !servicioDropdown && (
                      <div className="mt-1 flex items-center gap-2 bg-beauty-primary/10 border border-beauty-primary/30 rounded-xl px-3 py-1.5">
                        <CheckCircle size={12} className="text-beauty-primary" />
                        <span className="text-xs text-beauty-primary font-medium flex-1 truncate">{servicioSearch}</span>
                        <button type="button" onClick={() => { setNcServicioId(''); setServicioSearch('') }}
                          className="text-beauty-primary/60"><X size={11} /></button>
                      </div>
                    )}
                    {servicioDropdown && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-0.5 max-h-44 overflow-y-auto">
                        {servicios.filter(s => !servicioSearch || s.nombre.toLowerCase().includes(servicioSearch.toLowerCase())).slice(0, 10).map(s => (
                          <button key={s.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setNcServicioId(s.id); setServicioSearch(s.nombre); setServicioDropdown(false) }}
                            className="w-full text-left px-3 py-2 hover:bg-beauty-bg text-xs flex justify-between border-b border-gray-50 last:border-0">
                            <span className="font-medium text-gray-700">{s.nombre}</span>
                            <span className="text-gray-400">{s.duracion_minutos}min</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">📅 Fecha</label>
                  <input type="date" value={ncFecha}
                    min={todayCol()}
                    onChange={e => { setNcFecha(e.target.value); setNcSlots([]); setNcStep(1) }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-beauty-primary" />
                </div>

                <button onClick={buscarSlots}
                  disabled={!ncClienteId || !ncServicioId || !ncFecha || loadingSlots}
                  className="w-full bg-beauty-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                  {loadingSlots ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> : '🔍 Ver horarios disponibles'}
                </button>
              </div>
            )}

            {ncStep === 2 && (
              <div className="p-5">
                <button onClick={() => setNcStep(1)} className="flex items-center gap-1 text-xs text-gray-500 mb-4 hover:text-gray-700">
                  ← Volver
                </button>
                <p className="text-sm font-semibold text-beauty-text-dark mb-3">Selecciona un horario:</p>
                {ncSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No hay horarios disponibles para esta fecha</p>
                    <button onClick={() => setNcStep(1)} className="mt-3 text-xs text-beauty-primary hover:underline">Cambiar fecha</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 pb-4">
                    {ncSlots.map(s => (
                      <button key={s.fecha_inicio} onClick={() => guardarNuevaCita(s.fecha_inicio, s.fecha_fin)}
                        disabled={savingCita}
                        className="py-2.5 rounded-xl border-2 border-beauty-primary text-beauty-primary text-xs font-bold hover:bg-beauty-primary hover:text-white transition-all disabled:opacity-50">
                        {s.hora}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: SERVICIO EXTRA ─────────────────────────────────────────── */}
      {showExtra && (
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-2xl animate-slide-up" style={{ maxHeight: 'calc(100dvh - 56px)', overflowY: 'auto' }}>
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-8 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-beauty-text-dark flex items-center gap-2"><Scissors size={15} className="text-amber-500" /> Servicio Extra</h3>
              <button onClick={() => setShowExtra(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">📅 Fecha del servicio</label>
                <input type="date" value={exFecha}
                  max={todayCol()}
                  onChange={e => setExFecha(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-beauty-primary" />
                <p className="text-[10px] text-gray-400 mt-0.5">Puedes seleccionar una fecha anterior</p>
              </div>
              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">👤 Buscar cliente</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                  <input type="text" value={exClienteSearch}
                    onChange={e => { setExClienteSearch(e.target.value); setExClienteDropdown(true) }}
                    onFocus={() => setExClienteDropdown(true)}
                    placeholder="Nombre del cliente..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 pl-8 text-sm focus:outline-none focus:border-beauty-primary" />
                  {exClienteId && !exClienteDropdown && (
                    <div className="mt-1 flex items-center gap-2 bg-beauty-primary/10 border border-beauty-primary/30 rounded-xl px-3 py-1.5">
                      <CheckCircle size={12} className="text-beauty-primary" />
                      <span className="text-xs text-beauty-primary font-medium flex-1 truncate">{clientes.find(c => c.id === exClienteId)?.nombre}</span>
                      <button type="button" onClick={() => { setExClienteId(''); setExClienteSearch('') }}><X size={11} className="text-beauty-primary/60" /></button>
                    </div>
                  )}
                  {exClienteDropdown && exClienteSearch && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-0.5 max-h-36 overflow-y-auto">
                      {clientes.filter(c => c.nombre.toLowerCase().includes(exClienteSearch.toLowerCase())).slice(0, 6).map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setExClienteId(c.id); setExClienteSearch(c.nombre); setExClienteDropdown(false) }}
                          className="w-full text-left px-3 py-2 hover:bg-beauty-bg text-sm border-b border-gray-50 last:border-0">{c.nombre}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Servicio */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">✂️ Buscar servicio</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                  <input type="text" value={exServicioSearch}
                    onChange={e => { setExServicioSearch(e.target.value); setExServicioDropdown(true); if (!e.target.value) setExServicioId('') }}
                    onFocus={() => setExServicioDropdown(true)}
                    placeholder="Nombre del servicio..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 pl-8 text-sm focus:outline-none focus:border-beauty-primary" />
                  {exServicioId && !exServicioDropdown && (
                    <div className="mt-1 flex items-center gap-2 bg-beauty-primary/10 border border-beauty-primary/30 rounded-xl px-3 py-1.5">
                      <CheckCircle size={12} className="text-beauty-primary" />
                      <span className="text-xs text-beauty-primary font-medium flex-1 truncate">{exServicioSearch}</span>
                      <button type="button" onClick={() => { setExServicioId(''); setExServicioSearch('') }}><X size={11} className="text-beauty-primary/60" /></button>
                    </div>
                  )}
                  {exServicioDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-0.5 max-h-44 overflow-y-auto">
                      {servicios.filter(s => !exServicioSearch || s.nombre.toLowerCase().includes(exServicioSearch.toLowerCase())).slice(0, 10).map(s => (
                        <button key={s.id} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setExServicioId(s.id); setExServicioSearch(s.nombre); setExServicioDropdown(false); if (s.precio) setExValor(String(s.precio)) }}
                          className="w-full text-left px-3 py-2 hover:bg-beauty-bg text-xs flex justify-between border-b border-gray-50 last:border-0">
                          <span className="font-medium">{s.nombre}</span>
                          <span className="text-gray-400">{s.precio ? `$${Number(s.precio).toLocaleString('es-CO')}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">💵 Valor cobrado *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" value={exValor} onChange={e => setExValor(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-beauty-primary" />
                </div>
              </div>
              {/* Método */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">💳 Método de pago</label>
                <select value={exMetodo} onChange={e => setExMetodo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-beauty-primary">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">📲 Transferencia</option>
                  <option value="nequi">💜 Nequi</option>
                  <option value="daviplata">🟡 Daviplata</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                </select>
              </div>
              <div className="flex gap-3 pb-2">
                <button onClick={() => setShowExtra(false)} className="flex-1 border-2 border-gray-200 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
                <button onClick={guardarExtra} disabled={savingExtra}
                  className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingExtra ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><CheckCircle size={14} /> Registrar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
