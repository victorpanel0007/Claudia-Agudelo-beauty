'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DollarSign, Calendar, CalendarDays, TrendingUp,
  Users, Receipt, Wallet, Scissors,
  Plus, Trash2, ChevronDown, ClipboardList,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 'hoy' | 'semana' | 'quincena' | 'mes' | 'anio'
type EspPeriod = 'hoy' | 'ayer' | '7dias' | '15dias' | 'este_mes' | 'mes_anterior'

const GASTO_CATEGORIAS = [
  'Productos', 'Insumos', 'Arriendo', 'Publicidad',
  'Servicios Públicos', 'Nómina Administrativa',
  'Equipos', 'Mantenimiento', 'Otros',
] as const
type GastoCategoria = typeof GASTO_CATEGORIAS[number]

interface Gasto {
  id: string
  fecha: string
  categoria: GastoCategoria
  descripcion: string
  valor: number
  created_at: string
}

interface Especialista {
  id: string
  nombre: string
}

interface DashboardData {
  ingresosHoy: number
  ingresosSemana: number
  ingresos15dias: number
  ingresosMes: number
  comisionesPendientes: number
  gastosMes: number
  utilidadNeta: number
  serviciosRealizados: number
}

interface EspReport {
  totalFacturado: number
  citasRealizadas: number
  ticketPromedio: number
  comision: number
  porcentajeComision: number
  servicios: { nombre: string; cantidad: number; total: number }[]
}

interface TopServicio {
  nombre: string
  cantidad: number
  total: number
}

interface HistorialItem {
  id: string
  fecha: string
  cliente: string
  servicio: string
  especialista: string
  valor: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(amount)
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function getPeriodRange(period: Period): { start: string; end: string } {
  const today = todayStr()
  // Usar mediodía en Colombia para evitar problemas de DST al hacer aritmética
  const d = new Date(today + 'T12:00:00-05:00')
  switch (period) {
    case 'hoy':
      return { start: today, end: today }
    case 'semana': {
      const s = new Date(d); s.setDate(d.getDate() - 6)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
    case 'quincena': {
      const s = new Date(d); s.setDate(d.getDate() - 14)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
    case 'mes': {
      const s = new Date(d.getFullYear(), d.getMonth(), 1)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
    case 'anio': {
      const s = new Date(d.getFullYear(), 0, 1)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
  }
}

function getEspPeriodRange(p: EspPeriod): { start: string; end: string } {
  const today = todayStr()
  const d = new Date(today + 'T12:00:00-05:00')
  switch (p) {
    case 'hoy': return { start: today, end: today }
    case 'ayer': {
      const y = new Date(d); y.setDate(d.getDate() - 1)
      const s = y.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      return { start: s, end: s }
    }
    case '7dias': {
      const s = new Date(d); s.setDate(d.getDate() - 6)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
    case '15dias': {
      const s = new Date(d); s.setDate(d.getDate() - 14)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
    case 'este_mes': {
      const s = new Date(d.getFullYear(), d.getMonth(), 1)
      return { start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), end: today }
    }
    case 'mes_anterior': {
      const s = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const e = new Date(d.getFullYear(), d.getMonth(), 0)
      return {
        start: s.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
        end: e.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      }
    }
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ReportesView() {
  const supabase = createClient()

  // Global period
  const [period, setPeriod] = useState<Period>('mes')

  // Dashboard
  const [dash, setDash] = useState<DashboardData>({
    ingresosHoy: 0, ingresosSemana: 0, ingresos15dias: 0, ingresosMes: 0,
    comisionesPendientes: 0, gastosMes: 0, utilidadNeta: 0, serviciosRealizados: 0,
  })
  const [dashLoading, setDashLoading] = useState(true)

  // Specialist report
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [selEsp, setSelEsp] = useState<string>('')
  const [espPeriod, setEspPeriod] = useState<EspPeriod>('este_mes')
  const [espReport, setEspReport] = useState<EspReport | null>(null)
  const [espLoading, setEspLoading] = useState(false)

  // Gastos
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [gastosLoading, setGastosLoading] = useState(true)
  const [showGastoModal, setShowGastoModal] = useState(false)
  const [gastoForm, setGastoForm] = useState({
    fecha: todayStr(), categoria: 'Productos' as GastoCategoria,
    descripcion: '', valor: '',
  })
  const [savingGasto, setSavingGasto] = useState(false)

  // Top servicios
  const [topServicios, setTopServicios] = useState<TopServicio[]>([])
  const [topLoading, setTopLoading] = useState(true)

  // Historial
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [histLoading, setHistLoading] = useState(true)

  // ── Load dashboard ───────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    setDashLoading(true)
    const today = todayStr()
    const d = new Date(today + 'T12:00:00-05:00')

    const weekAgo = new Date(d); weekAgo.setDate(d.getDate() - 6)
    const quinAgo = new Date(d); quinAgo.setDate(d.getDate() - 14)
    const mesStart = new Date(d.getFullYear(), d.getMonth(), 1)

    const [resHoy, resSemana, res15, resMes, resComisiones, resGastos] = await Promise.all([
      supabase.from('citas').select('valor_final')
        .eq('estado', 'completada')
        .gte('fecha_inicio', today + 'T00:00:00-05:00')
        .lte('fecha_inicio', today + 'T23:59:59-05:00'),
      supabase.from('citas').select('valor_final')
        .eq('estado', 'completada')
        .gte('fecha_inicio', weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) + 'T00:00:00-05:00')
        .lte('fecha_inicio', today + 'T23:59:59-05:00'),
      supabase.from('citas').select('valor_final')
        .eq('estado', 'completada')
        .gte('fecha_inicio', quinAgo.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) + 'T00:00:00-05:00')
        .lte('fecha_inicio', today + 'T23:59:59-05:00'),
      supabase.from('citas').select('valor_final')
        .eq('estado', 'completada')
        .gte('fecha_inicio', mesStart.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) + 'T00:00:00-05:00')
        .lte('fecha_inicio', today + 'T23:59:59-05:00'),
      supabase.from('liquidaciones').select('valor_comision').eq('estado', 'pendiente'),
      supabase.from('gastos').select('valor')
        .gte('fecha', mesStart.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }))
        .lte('fecha', today),
    ])

    const sum = (rows: { valor_final?: number | null }[]) =>
      rows.reduce((a, r) => a + (r.valor_final ?? 0), 0)
    const sumV = (rows: { valor?: number | null }[]) =>
      rows.reduce((a, r) => a + (r.valor ?? 0), 0)
    const sumC = (rows: { valor_comision?: number | null }[]) =>
      rows.reduce((a, r) => a + (r.valor_comision ?? 0), 0)

    const ingresosHoy = sum(resHoy.data ?? [])
    const ingresosSemana = sum(resSemana.data ?? [])
    const ingresos15dias = sum(res15.data ?? [])
    const ingresosMes = sum(resMes.data ?? [])
    const comisionesPendientes = sumC(resComisiones.data ?? [])
    const gastosMes = sumV(resGastos.data ?? [])
    const utilidadNeta = ingresosMes - comisionesPendientes - gastosMes
    const serviciosRealizados = resMes.data?.length ?? 0

    setDash({ ingresosHoy, ingresosSemana, ingresos15dias, ingresosMes,
      comisionesPendientes, gastosMes, utilidadNeta, serviciosRealizados })
    setDashLoading(false)
  }, [supabase])

  // ── Load top servicios & historial ───────────────────────────────────────

  const loadTopAndHistorial = useCallback(async () => {
    setTopLoading(true)
    setHistLoading(true)
    const { start, end } = getPeriodRange(period)

    const { data } = await supabase
      .from('citas')
      .select('valor_final, fecha_inicio, servicio:servicios(nombre), cliente:clientes(nombre), especialista:especialistas(nombre)')
      .eq('estado', 'completada')
      .gte('fecha_inicio', start + 'T00:00:00-05:00')
      .lte('fecha_inicio', end + 'T23:59:59-05:00')
      .order('fecha_inicio', { ascending: false })
      .limit(500)

    // top servicios
    const svcMap: Record<string, { cantidad: number; total: number }> = {}
    ;(data ?? []).forEach(c => {
      const nombre = (c.servicio as { nombre?: string } | null)?.nombre ?? 'Sin nombre'
      if (!svcMap[nombre]) svcMap[nombre] = { cantidad: 0, total: 0 }
      svcMap[nombre].cantidad++
      svcMap[nombre].total += c.valor_final ?? 0
    })
    const top = Object.entries(svcMap)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total)
    setTopServicios(top)
    setTopLoading(false)

    // historial
    const hist = (data ?? []).slice(0, 50).map(c => ({
      id: Math.random().toString(),
      fecha: c.fecha_inicio,
      cliente: (c.cliente as { nombre?: string } | null)?.nombre ?? '—',
      servicio: (c.servicio as { nombre?: string } | null)?.nombre ?? '—',
      especialista: (c.especialista as { nombre?: string } | null)?.nombre ?? '—',
      valor: c.valor_final ?? 0,
    }))
    setHistorial(hist)
    setHistLoading(false)
  }, [supabase, period])

  // ── Load gastos ──────────────────────────────────────────────────────────

  const loadGastos = useCallback(async () => {
    setGastosLoading(true)
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(200)
    if (error) toast.error('Error cargando gastos')
    else setGastos((data ?? []) as Gasto[])
    setGastosLoading(false)
  }, [supabase])

  // ── Load especialistas list ──────────────────────────────────────────────

  const loadEspecialistas = useCallback(async () => {
    const { data } = await supabase.from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
    setEspecialistas((data ?? []) as Especialista[])
  }, [supabase])

  // ── Load specialist report ───────────────────────────────────────────────

  const loadEspReport = useCallback(async () => {
    if (!selEsp) { setEspReport(null); return }
    setEspLoading(true)
    const { start, end } = getEspPeriodRange(espPeriod)

    const [citasRes, comisionRes] = await Promise.all([
      supabase.from('citas')
        .select('valor_final, servicio:servicios(nombre)')
        .eq('estado', 'completada')
        .eq('especialista_id', selEsp)
        .gte('fecha_inicio', start + 'T00:00:00-05:00')
        .lte('fecha_inicio', end + 'T23:59:59-05:00'),
      supabase.from('comisiones_config')
        .select('porcentaje')
        .eq('especialista_id', selEsp)
        .maybeSingle(),
    ])

    const citas = citasRes.data ?? []
    const porcentajeComision = (comisionRes.data?.porcentaje as number | null) ?? 40
    const totalFacturado = citas.reduce((a, c) => a + (c.valor_final ?? 0), 0)
    const citasRealizadas = citas.length
    const ticketPromedio = citasRealizadas > 0 ? totalFacturado / citasRealizadas : 0
    const comision = totalFacturado * (porcentajeComision / 100)

    const svcMap: Record<string, { cantidad: number; total: number }> = {}
    citas.forEach(c => {
      const nombre = (c.servicio as { nombre?: string } | null)?.nombre ?? 'Sin nombre'
      if (!svcMap[nombre]) svcMap[nombre] = { cantidad: 0, total: 0 }
      svcMap[nombre].cantidad++
      svcMap[nombre].total += c.valor_final ?? 0
    })
    const servicios = Object.entries(svcMap)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total)

    setEspReport({ totalFacturado, citasRealizadas, ticketPromedio, comision, porcentajeComision, servicios })
    setEspLoading(false)
  }, [supabase, selEsp, espPeriod])

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { loadDashboard(); loadGastos(); loadEspecialistas() }, [loadDashboard, loadGastos, loadEspecialistas])
  useEffect(() => { loadTopAndHistorial() }, [loadTopAndHistorial])
  useEffect(() => { loadEspReport() }, [loadEspReport])

  // ── Gasto actions ─────────────────────────────────────────────────────────

  async function saveGasto() {
    if (!gastoForm.descripcion.trim()) { toast.error('Ingresa una descripción'); return }
    const valor = parseFloat(gastoForm.valor)
    if (!valor || valor <= 0) { toast.error('Ingresa un valor válido'); return }
    setSavingGasto(true)
    const { error } = await supabase.from('gastos').insert({
      fecha: gastoForm.fecha,
      categoria: gastoForm.categoria,
      descripcion: gastoForm.descripcion.trim(),
      valor,
    })
    if (error) { toast.error('Error guardando gasto'); setSavingGasto(false); return }
    toast.success('Gasto registrado')
    setSavingGasto(false)
    setShowGastoModal(false)
    setGastoForm({ fecha: todayStr(), categoria: 'Productos', descripcion: '', valor: '' })
    loadGastos()
    loadDashboard()
  }

  async function deleteGasto(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) { toast.error('Error eliminando gasto'); return }
    toast.success('Gasto eliminado')
    loadGastos()
    loadDashboard()
  }

  // ── Period labels ─────────────────────────────────────────────────────────

  const periodBtns: { key: Period; label: string }[] = [
    { key: 'hoy',      label: 'Hoy' },
    { key: 'semana',   label: 'Semana' },
    { key: 'quincena', label: '15 Días' },
    { key: 'mes',      label: 'Mes' },
    { key: 'anio',     label: 'Año' },
  ]

  const espPeriodBtns: { key: EspPeriod; label: string }[] = [
    { key: 'hoy',          label: 'Hoy' },
    { key: 'ayer',         label: 'Ayer' },
    { key: '7dias',        label: '7 días' },
    { key: '15dias',       label: '15 días' },
    { key: 'este_mes',     label: 'Este mes' },
    { key: 'mes_anterior', label: 'Mes anterior' },
  ]

  // ── Dashboard cards config ────────────────────────────────────────────────

  const dashCards = [
    { label: 'Ingresos de Hoy',         value: dash.ingresosHoy,           icon: DollarSign,   color: 'bg-emerald-100 text-emerald-600',  sub: 'citas completadas hoy' },
    { label: 'Ingresos Semana',          value: dash.ingresosSemana,        icon: Calendar,     color: 'bg-blue-100 text-blue-600',        sub: 'últimos 7 días' },
    { label: 'Ingresos 15 Días',         value: dash.ingresos15dias,        icon: CalendarDays, color: 'bg-violet-100 text-violet-600',    sub: 'últimas 2 semanas' },
    { label: 'Ingresos del Mes',         value: dash.ingresosMes,           icon: TrendingUp,   color: 'bg-pink-100 text-pink-600',        sub: 'mes actual' },
    { label: 'Comisiones Pendientes',    value: dash.comisionesPendientes,  icon: Users,        color: 'bg-amber-100 text-amber-600',      sub: 'liquidaciones pendientes' },
    { label: 'Gastos del Mes',           value: dash.gastosMes,             icon: Receipt,      color: 'bg-red-100 text-red-600',          sub: 'gastos registrados' },
    { label: 'Utilidad Neta',            value: dash.utilidadNeta,          icon: Wallet,       color: dash.utilidadNeta >= 0 ? 'bg-teal-100 text-teal-600' : 'bg-red-100 text-red-600', sub: 'ingresos − comisiones − gastos' },
    { label: 'Servicios Realizados',     value: dash.serviciosRealizados,   icon: Scissors,     color: 'bg-[#FAD6E0] text-[#8B1E3F]',     sub: 'citas completadas este mes', isCnt: true },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#222222]">Reportes Financieros</h2>
        <p className="text-gray-500 text-sm">Análisis de ingresos, gastos y comisiones</p>
      </div>

      {/* Section 1 – Period filter */}
      <div className="flex flex-wrap gap-2">
        {periodBtns.map(b => (
          <button
            key={b.key}
            onClick={() => setPeriod(b.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              period === b.key
                ? 'bg-[#EFA1B5] text-white shadow-sm'
                : 'bg-white border border-[#EFA1B5]/30 text-[#222222] hover:border-[#EFA1B5]'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Section 2 – Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dashCards.map(c => (
          <div
            key={c.label}
            className="bg-white border border-[#EFA1B5]/20 rounded-2xl p-4 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
              <c.icon size={20} />
            </div>
            <p className="text-lg font-bold text-[#222222] leading-tight">
              {dashLoading ? '—' : c.isCnt ? c.value : fmt(c.value as number)}
            </p>
            <p className="text-xs font-semibold text-[#222222] mt-0.5">{c.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Section 3 – Reporte por especialista */}
      <div className="bg-white border border-[#EFA1B5]/20 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={18} className="text-[#8B1E3F]" />
          <h3 className="font-semibold text-[#222222]">Reporte por Especialista</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <select
                value={selEsp}
                onChange={e => setSelEsp(e.target.value)}
                className="appearance-none bg-[#FFF8EE] border border-[#EFA1B5]/30 text-[#222222] text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#EFA1B5]"
              >
                <option value="">— Seleccionar especialista —</option>
                {especialistas.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="flex flex-wrap gap-1">
              {espPeriodBtns.map(b => (
                <button
                  key={b.key}
                  onClick={() => setEspPeriod(b.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    espPeriod === b.key
                      ? 'bg-[#EFA1B5] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-[#FAD6E0]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Report results */}
          {!selEsp ? (
            <p className="text-gray-400 text-sm text-center py-6">Selecciona un especialista</p>
          ) : espLoading ? (
            <p className="text-gray-400 text-sm text-center py-6">Cargando...</p>
          ) : espReport ? (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Facturado',   value: fmt(espReport.totalFacturado) },
                  { label: 'Citas Realizadas',  value: String(espReport.citasRealizadas) },
                  { label: 'Ticket Promedio',   value: fmt(espReport.ticketPromedio) },
                  { label: `Comisión (${espReport.porcentajeComision}%)`, value: fmt(espReport.comision) },
                ].map(k => (
                  <div key={k.label} className="bg-[#FFF8EE] rounded-xl p-3 text-center">
                    <p className="text-base font-bold text-[#8B1E3F]">{k.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>
              {/* Services table */}
              {espReport.servicios.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Servicio</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Cantidad</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {espReport.servicios.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-[#FFF8EE]">
                          <td className="py-2 px-3 text-[#222222]">{s.nombre}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{s.cantidad}</td>
                          <td className="py-2 px-3 text-right font-medium text-[#8B1E3F]">{fmt(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Section 4 – Registro de gastos */}
      <div className="bg-white border border-[#EFA1B5]/20 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-[#8B1E3F]" />
            <h3 className="font-semibold text-[#222222]">Registro de Gastos</h3>
          </div>
          <button
            onClick={() => setShowGastoModal(true)}
            className="flex items-center gap-1.5 bg-[#8B1E3F] text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#5C0F28] transition-colors"
          >
            <Plus size={15} /> Agregar Gasto
          </button>
        </div>

        {/* Gastos table */}
        {gastosLoading ? (
          <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
        ) : gastos.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No hay gastos registrados</p>
        ) : (
          <>
            {/* Desktop tabla */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#FFF8EE]">
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Fecha</th>
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Categoría</th>
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Descripción</th>
                    <th className="text-right py-2 px-4 text-gray-500 font-medium text-xs">Valor</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map(g => (
                    <tr key={g.id} className="border-b border-gray-50 hover:bg-[#FFF8EE]">
                      <td className="py-2 px-4 text-gray-600">{g.fecha}</td>
                      <td className="py-2 px-4">
                        <span className="bg-[#FAD6E0] text-[#8B1E3F] text-xs px-2 py-0.5 rounded-full">{g.categoria}</span>
                      </td>
                      <td className="py-2 px-4 text-[#222222]">{g.descripcion}</td>
                      <td className="py-2 px-4 text-right font-medium text-[#8B1E3F]">{fmt(g.valor)}</td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => deleteGasto(g.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {gastos.map(g => (
                <div key={g.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#222222] text-sm truncate">{g.descripcion}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-xs text-gray-500">{g.fecha}</span>
                      <span className="bg-[#FAD6E0] text-[#8B1E3F] text-xs px-2 py-0.5 rounded-full">{g.categoria}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-[#8B1E3F] text-sm">{fmt(g.valor)}</p>
                    <button
                      onClick={() => deleteGasto(g.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Section 5 – Top servicios */}
      <div className="bg-white border border-[#EFA1B5]/20 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Scissors size={18} className="text-[#8B1E3F]" />
          <h3 className="font-semibold text-[#222222]">Top Servicios</h3>
          <span className="text-xs text-gray-400 ml-1">— período seleccionado</span>
        </div>
        {topLoading ? (
          <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
        ) : topServicios.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin datos para el período</p>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#FFF8EE]">
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">#</th>
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Servicio</th>
                    <th className="text-right py-2 px-4 text-gray-500 font-medium text-xs">Cantidad</th>
                    <th className="text-right py-2 px-4 text-gray-500 font-medium text-xs">Total Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {topServicios.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-[#FFF8EE]">
                      <td className="py-2 px-4 text-[#D4AF37] font-bold">{i + 1}</td>
                      <td className="py-2 px-4 text-[#222222]">{s.nombre}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{s.cantidad}</td>
                      <td className="py-2 px-4 text-right font-medium text-[#8B1E3F]">{fmt(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-gray-50">
              {topServicios.map((s, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <span className="text-lg font-bold text-[#D4AF37] w-6 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#222222] text-sm truncate">{s.nombre}</p>
                    <p className="text-xs text-gray-500">{s.cantidad} cita{s.cantidad !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-[#8B1E3F] text-sm shrink-0">{fmt(s.total)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Section 6 – Historial simple */}
      <div className="bg-white border border-[#EFA1B5]/20 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList size={18} className="text-[#8B1E3F]" />
          <h3 className="font-semibold text-[#222222]">Historial Reciente</h3>
          <span className="text-xs text-gray-400 ml-1">— últimas 50 citas completadas</span>
        </div>
        {histLoading ? (
          <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
        ) : historial.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin citas en el período</p>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#FFF8EE]">
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Fecha</th>
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Cliente</th>
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Servicio</th>
                    <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Especialista</th>
                    <th className="text-right py-2 px-4 text-gray-500 font-medium text-xs">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id} className="border-b border-gray-50 hover:bg-[#FFF8EE]">
                      <td className="py-2 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(h.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2 px-4 text-[#222222]">{h.cliente}</td>
                      <td className="py-2 px-4 text-gray-600">{h.servicio}</td>
                      <td className="py-2 px-4 text-gray-600">{h.especialista}</td>
                      <td className="py-2 px-4 text-right font-medium text-[#8B1E3F]">{fmt(h.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-gray-50">
              {historial.map(h => (
                <div key={h.id} className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-[#222222] text-sm">{h.cliente}</p>
                    <p className="font-bold text-[#8B1E3F] text-sm">{fmt(h.valor)}</p>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{h.servicio}</p>
                  <div className="flex gap-2 mt-1 text-xs text-gray-400">
                    <span>{new Date(h.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short' })}</span>
                    <span>·</span>
                    <span>{h.especialista}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal – Agregar Gasto */}
      {showGastoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-semibold text-[#222222] text-base">Agregar Gasto</h4>
              <button
                onClick={() => setShowGastoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={gastoForm.fecha}
                  onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EFA1B5] text-[#222222]"
                />
              </div>
              {/* Categoría */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <div className="relative">
                  <select
                    value={gastoForm.categoria}
                    onChange={e => setGastoForm(f => ({ ...f, categoria: e.target.value as GastoCategoria }))}
                    className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EFA1B5] text-[#222222] bg-white pr-8"
                  >
                    {GASTO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Compra de productos capilares"
                  value={gastoForm.descripcion}
                  onChange={e => setGastoForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EFA1B5] text-[#222222]"
                />
              </div>
              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor (COP)</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={gastoForm.valor}
                  onChange={e => setGastoForm(f => ({ ...f, valor: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EFA1B5] text-[#222222]"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowGastoModal(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGasto}
                disabled={savingGasto}
                className="px-4 py-2 text-sm text-white bg-[#8B1E3F] rounded-lg hover:bg-[#5C0F28] transition-colors disabled:opacity-60"
              >
                {savingGasto ? 'Guardando...' : 'Guardar Gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
