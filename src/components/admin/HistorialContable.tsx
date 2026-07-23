'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, Download, Printer, ArrowUpRight, ArrowDownRight,
  Minus, TrendingUp, TrendingDown, Users, Scissors, CreditCard,
  BarChart2, Loader2, ChevronDown, GitCompare, FileSpreadsheet,
  FileText, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────
interface Especialista { id: string; nombre: string }

interface ReporteData {
  totalIngresos: number
  gastosReales: number
  ganancia: number
  totalCitas: number
  citasCompletadas: number
  citasCanceladas: number
  clientesAtendidos: number
  totalComisiones: number
  promedioDiario: number
  diasRango: number
  serviciosTop: { nombre: string; cantidad: number; total: number }[]
  metodosPago: { metodo: string; total: number }[]
  comisionesPorEspecialista: { nombre: string; citas: number; total: number; pagado: number }[]
  gastosPorCategoria: { categoria: string; total: number }[]
  serieTemporal: { fecha: string; ingresos: number; gastos: number; citas: number }[]
  citas: {
    id: string; fecha: string; cliente: string; especialista: string
    servicio: string; valor: number; metodo_pago: string; canal: string
  }[]
  gastosDetalle: { id: string; fecha: string; categoria: string; descripcion: string; valor: number }[]
}

interface MesPeriodo { label: string; value: string; start: string; end: string }

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v)
}

function fmtShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return fmt(v)
}

function colDate(dt?: Date) {
  return (dt ?? new Date()).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

/** Genera lista de períodos mensuales desde el inicio del negocio (2024-01) */
function generarMeses(): MesPeriodo[] {
  const meses: MesPeriodo[] = []
  const ahora = new Date(colDate() + 'T12:00:00-05:00')
  const inicio = new Date(2024, 0, 1) // Enero 2024
  let cur = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

  while (cur >= inicio) {
    const y = cur.getFullYear()
    const m = cur.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const label = new Date(start + 'T12:00:00').toLocaleDateString('es-CO', {
      month: 'long', year: 'numeric',
    })
    meses.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value: `${y}-${String(m + 1).padStart(2, '0')}`,
      start, end,
    })
    cur = new Date(y, m - 1, 1)
  }
  return meses
}

function variacion(actual: number, anterior: number): { pct: number; dir: 'up' | 'down' | 'equal' } {
  if (anterior === 0 && actual === 0) return { pct: 0, dir: 'equal' }
  if (anterior === 0) return { pct: 100, dir: 'up' }
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100
  return { pct: Math.abs(pct), dir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'equal' }
}

// ── MiniBarChart ─────────────────────────────────────────────────────────────
function MiniBarChart({ serie, loading }: {
  serie: { fecha: string; ingresos: number; gastos: number }[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="h-28 flex items-end gap-1 px-1 pb-0 animate-pulse">
        {Array(10).fill(0).map((_, i) => (
          <div key={i} className="flex-1 bg-gray-100 rounded-t-sm" style={{ height: `${20 + i * 7}%` }} />
        ))}
      </div>
    )
  }
  if (!serie.length) {
    return <p className="text-center text-gray-400 text-xs py-8">Sin datos en el período</p>
  }
  // Agrupar por semana si hay más de 14 días
  let points = serie
  if (serie.length > 14) {
    const weekMap: Record<string, { ingresos: number; gastos: number }> = {}
    serie.forEach(s => {
      const d   = new Date(s.fecha + 'T12:00:00')
      const wk  = `S${Math.ceil(d.getDate() / 7)}`
      const key = `${s.fecha.slice(0, 7)}-${wk}`
      if (!weekMap[key]) weekMap[key] = { ingresos: 0, gastos: 0 }
      weekMap[key].ingresos += s.ingresos
      weekMap[key].gastos   += s.gastos
    })
    points = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, v]) => ({ fecha, ...v, citas: 0 }))
  }
  const maxVal = Math.max(...points.flatMap(p => [p.ingresos, p.gastos]), 1)
  return (
    <div className="flex items-end gap-1 px-1 pb-0 h-28">
      {points.map((pt, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0 min-w-0" style={{ height: '112px' }}>
          <div className="w-full flex items-end gap-0.5 flex-1">
            <div
              className="flex-1 bg-emerald-400 rounded-t-sm transition-all duration-500"
              style={{ height: `${(pt.ingresos / maxVal) * 100}%`, minHeight: pt.ingresos > 0 ? 2 : 0 }}
              title={`Ingresos: ${fmt(pt.ingresos)}`}
            />
            <div
              className="flex-1 bg-rose-300 rounded-t-sm transition-all duration-500"
              style={{ height: `${(pt.gastos / maxVal) * 100}%`, minHeight: pt.gastos > 0 ? 2 : 0 }}
              title={`Gastos: ${fmt(pt.gastos)}`}
            />
          </div>
          <span className="text-[8px] text-gray-400 truncate w-full text-center mt-0.5">
            {pt.fecha.slice(5, 10)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── VarBadge ────────────────────────────────────────────────────────────────
function VarBadge({ actual, anterior, prefix = '' }: { actual: number; anterior: number; prefix?: string }) {
  const { pct, dir } = variacion(actual, anterior)
  if (dir === 'equal') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-400">
      <Minus size={10} /> 0%
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${dir === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
      {dir === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {prefix}{pct.toFixed(1)}%
    </span>
  )
}

// ── ComparacionPanel ─────────────────────────────────────────────────────────
function ComparacionPanel({
  periodoA, periodoB, dataA, dataB,
}: {
  periodoA: MesPeriodo; periodoB: MesPeriodo
  dataA: ReporteData | null; dataB: ReporteData | null
}) {
  if (!dataA || !dataB) return (
    <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
      <Loader2 size={18} className="animate-spin" /> Cargando comparación…
    </div>
  )

  const rows: { label: string; a: number; b: number; money?: boolean }[] = [
    { label: 'Ingresos',          a: dataA.totalIngresos,     b: dataB.totalIngresos,     money: true },
    { label: 'Gastos',            a: dataA.gastosReales,      b: dataB.gastosReales,      money: true },
    { label: 'Ganancia / Pérdida',a: dataA.ganancia,          b: dataB.ganancia,          money: true },
    { label: 'Citas realizadas',  a: dataA.citasCompletadas,  b: dataB.citasCompletadas },
    { label: 'Cancelaciones',     a: dataA.citasCanceladas,   b: dataB.citasCanceladas },
    { label: 'Clientes atendidos',a: dataA.clientesAtendidos, b: dataB.clientesAtendidos },
    { label: 'Comisiones pagadas',a: dataA.totalComisiones,   b: dataB.totalComisiones,   money: true },
    { label: 'Promedio diario',   a: dataA.promedioDiario,    b: dataB.promedioDiario,    money: true },
  ]

  return (
    <div className="space-y-3">
      {/* Cabecera */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
        <div className="text-left text-gray-400">Métrica</div>
        <div className="bg-violet-50 rounded-lg py-1.5 text-violet-700">{periodoA.label}</div>
        <div className="bg-sky-50 rounded-lg py-1.5 text-sky-700">{periodoB.label}</div>
      </div>

      {rows.map(row => {
        const { pct, dir } = variacion(row.b, row.a)
        const valA = row.money ? fmtShort(row.a) : String(Math.round(row.a))
        const valB = row.money ? fmtShort(row.b) : String(Math.round(row.b))
        return (
          <div key={row.label} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-xs text-gray-600 font-medium">{row.label}</span>
            <div className="bg-violet-50 rounded-lg py-2 px-2 text-center">
              <p className="font-bold text-violet-800 text-sm leading-none">{valA}</p>
            </div>
            <div className="bg-sky-50 rounded-lg py-2 px-2 text-center relative">
              <p className="font-bold text-sky-800 text-sm leading-none">{valB}</p>
              {pct > 0 && (
                <span className={`absolute -top-1.5 right-1 text-[9px] font-bold px-1 py-0.5 rounded-full ${
                  dir === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {dir === 'up' ? '↑' : '↓'}{pct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Exportación ──────────────────────────────────────────────────────────────
function exportarCSV(data: ReporteData, label: string) {
  const rows: string[][] = [
    ['=== REPORTE CONTABLE ===', label],
    [],
    ['RESUMEN'],
    ['Total Ingresos', String(data.totalIngresos)],
    ['Total Gastos',   String(data.gastosReales)],
    ['Ganancia Neta',  String(data.ganancia)],
    ['Citas Completadas', String(data.citasCompletadas)],
    ['Cancelaciones', String(data.citasCanceladas)],
    ['Clientes Atendidos', String(data.clientesAtendidos)],
    ['Promedio Diario', String(Math.round(data.promedioDiario))],
    [],
    ['SERVICIOS TOP'],
    ['Servicio', 'Cantidad', 'Total COP'],
    ...data.serviciosTop.map(s => [s.nombre, String(s.cantidad), String(s.total)]),
    [],
    ['MÉTODOS DE PAGO'],
    ['Método', 'Total COP'],
    ...data.metodosPago.map(m => [m.metodo, String(m.total)]),
    [],
    ['COMISIONES POR ESPECIALISTA'],
    ['Especialista', 'Citas', 'Total Facturado', 'Pagado'],
    ...data.comisionesPorEspecialista.map(e => [e.nombre, String(e.citas), String(e.total), String(e.pagado)]),
    [],
    ['GASTOS POR CATEGORÍA'],
    ['Categoría', 'Total COP'],
    ...data.gastosPorCategoria.map(g => [g.categoria, String(g.total)]),
    [],
    ['DETALLE CITAS'],
    ['Fecha', 'Cliente', 'Especialista', 'Servicio', 'Valor', 'Método Pago', 'Canal'],
    ...data.citas.map(c => [c.fecha.slice(0, 10), c.cliente, c.especialista, c.servicio, String(c.valor), c.metodo_pago, c.canal]),
    [],
    ['DETALLE GASTOS'],
    ['Fecha', 'Categoría', 'Descripción', 'Valor'],
    ...data.gastosDetalle.map(g => [g.fecha, g.categoria, g.descripcion, String(g.valor)]),
  ]
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a   = document.createElement('a')
  a.href    = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `reporte-${label.replace(/\s+/g, '-').toLowerCase()}.csv`
  a.click()
  toast.success('CSV exportado')
}

function exportarExcel(data: ReporteData, label: string) {
  // Genera un archivo TSV que Excel abre directamente
  const rows: string[][] = [
    ['REPORTE CONTABLE', label],
    [],
    ['RESUMEN'],
    ['Métrica', 'Valor'],
    ['Total Ingresos', fmt(data.totalIngresos)],
    ['Total Gastos',   fmt(data.gastosReales)],
    ['Ganancia Neta',  fmt(data.ganancia)],
    ['Citas Completadas', String(data.citasCompletadas)],
    ['Cancelaciones', String(data.citasCanceladas)],
    ['Clientes Atendidos', String(data.clientesAtendidos)],
    ['Promedio Diario', fmt(data.promedioDiario)],
    [],
    ['SERVICIOS TOP'],
    ['Servicio', 'Cantidad', 'Total'],
    ...data.serviciosTop.map(s => [s.nombre, String(s.cantidad), fmt(s.total)]),
    [],
    ['COMISIONES POR ESPECIALISTA'],
    ['Especialista', 'Citas', 'Facturado', 'Pagado'],
    ...data.comisionesPorEspecialista.map(e => [e.nombre, String(e.citas), fmt(e.total), fmt(e.pagado)]),
    [],
    ['DETALLE CITAS'],
    ['Fecha', 'Cliente', 'Especialista', 'Servicio', 'Valor', 'Método Pago'],
    ...data.citas.map(c => [c.fecha.slice(0, 10), c.cliente, c.especialista, c.servicio, fmt(c.valor), c.metodo_pago]),
  ]
  const tsv = rows.map(r => r.join('\t')).join('\n')
  const a   = document.createElement('a')
  a.href    = URL.createObjectURL(new Blob(['\uFEFF' + tsv], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  a.download = `reporte-${label.replace(/\s+/g, '-').toLowerCase()}.xls`
  a.click()
  toast.success('Excel exportado')
}

function imprimirReporte(data: ReporteData, label: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Reporte ${label}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:24px}
  h1{font-size:18px;color:#8B1E3F;margin-bottom:4px}
  h2{font-size:14px;color:#8B1E3F;margin:16px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{background:#FFF8EE;padding:6px 8px;text-align:left;font-size:11px;border-bottom:2px solid #EFA1B5}
  td{padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px}
  .pos{color:#16a34a;font-weight:bold} .neg{color:#dc2626;font-weight:bold}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .kpi{background:#FFF8EE;border-radius:8px;padding:10px 12px}
  .kpi-val{font-size:16px;font-weight:bold;color:#8B1E3F}
  .kpi-lbl{font-size:10px;color:#888;margin-top:2px}
</style></head><body>
<h1>📊 Reporte Contable — ${label}</h1>
<p style="color:#888;font-size:11px">Generado: ${new Date().toLocaleString('es-CO',{timeZone:'America/Bogota'})}</p>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val">${fmt(data.totalIngresos)}</div><div class="kpi-lbl">Ingresos</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(data.gastosReales)}</div><div class="kpi-lbl">Gastos</div></div>
  <div class="kpi"><div class="kpi-val ${data.ganancia>=0?'pos':'neg'}">${fmt(data.ganancia)}</div><div class="kpi-lbl">Ganancia Neta</div></div>
  <div class="kpi"><div class="kpi-val">${data.citasCompletadas}</div><div class="kpi-lbl">Citas realizadas</div></div>
  <div class="kpi"><div class="kpi-val">${data.clientesAtendidos}</div><div class="kpi-lbl">Clientes</div></div>
  <div class="kpi"><div class="kpi-val">${data.citasCanceladas}</div><div class="kpi-lbl">Cancelaciones</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(data.promedioDiario)}</div><div class="kpi-lbl">Promedio diario</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(data.totalComisiones)}</div><div class="kpi-lbl">Comisiones pagadas</div></div>
</div>
<h2>Servicios Más Vendidos</h2>
<table><tr><th>#</th><th>Servicio</th><th>Cantidad</th><th>Total</th></tr>
${data.serviciosTop.map((s,i)=>`<tr><td>${i+1}</td><td>${s.nombre}</td><td>${s.cantidad}</td><td>${fmt(s.total)}</td></tr>`).join('')}
</table>
<h2>Métodos de Pago</h2>
<table><tr><th>Método</th><th>Total</th></tr>
${data.metodosPago.map(m=>`<tr><td>${m.metodo}</td><td>${fmt(m.total)}</td></tr>`).join('')}
</table>
<h2>Comisiones por Especialista</h2>
<table><tr><th>Especialista</th><th>Citas</th><th>Facturado</th><th>Pagado</th></tr>
${data.comisionesPorEspecialista.map(e=>`<tr><td>${e.nombre}</td><td>${e.citas}</td><td>${fmt(e.total)}</td><td>${fmt(e.pagado)}</td></tr>`).join('')}
</table>
<h2>Gastos por Categoría</h2>
<table><tr><th>Categoría</th><th>Total</th></tr>
${data.gastosPorCategoria.map(g=>`<tr><td>${g.categoria}</td><td>${fmt(g.total)}</td></tr>`).join('')}
</table>
</body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }
}

// ── Hook de fetch ────────────────────────────────────────────────────────────
function useReporte(start: string, end: string, enabled: boolean) {
  const [data, setData]       = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !start || !end) return
    setLoading(true); setData(null); setError(null)
    fetch(`/api/reportes?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d as ReporteData); setLoading(false)
      })
      .catch(e => { setError((e as Error).message); setLoading(false) })
  }, [start, end, enabled])

  return { data, loading, error }
}

// ── Selector de período ───────────────────────────────────────────────────────
function PeriodoSelector({
  meses, value, onChange, label,
}: {
  meses: MesPeriodo[]; value: string; onChange: (m: MesPeriodo) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = meses.find(m => m.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <p className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">{label}</p>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:border-[#EFA1B5] transition-colors min-w-[160px] justify-between"
      >
        <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[#8B1E3F]" />{current?.label ?? '—'}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto min-w-[180px]">
          {meses.map(m => (
            <button
              key={m.value}
              onClick={() => { onChange(m); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#FFF8EE] transition-colors ${m.value === value ? 'font-bold text-[#8B1E3F] bg-[#FFF8EE]' : 'text-gray-700'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, loading, colorClass, anterior,
}: {
  icon: string; label: string; value: number; loading: boolean
  colorClass: string; anterior?: number
}) {
  return (
    <div className={`rounded-2xl p-3.5 flex items-center gap-3 border border-white/50 ${colorClass}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium opacity-70 truncate">{label}</p>
        <p className="text-base font-bold leading-tight">{loading ? '—' : fmtShort(value)}</p>
        {anterior !== undefined && !loading && (
          <VarBadge actual={value} anterior={anterior} />
        )}
      </div>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array(lines).fill(0).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ── Panel de KPIs ─────────────────────────────────────────────────────────────
function KpiGrid({ data, loading, anterior }: {
  data: ReporteData | null; loading: boolean; anterior?: ReporteData | null
}) {
  const kpis = [
    { icon: '💰', label: 'Ingresos totales',   value: data?.totalIngresos ?? 0,     color: 'bg-emerald-50 text-emerald-700', ant: anterior?.totalIngresos },
    { icon: '💸', label: 'Gastos totales',     value: data?.gastosReales ?? 0,      color: 'bg-rose-50 text-rose-700',      ant: anterior?.gastosReales },
    { icon: '📈', label: 'Ganancia neta',       value: data?.ganancia ?? 0,          color: (data?.ganancia ?? 0) >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700', ant: anterior?.ganancia },
    { icon: '📅', label: 'Citas realizadas',   value: data?.citasCompletadas ?? 0,  color: 'bg-violet-50 text-violet-700', ant: anterior?.citasCompletadas },
    { icon: '❌', label: 'Cancelaciones',       value: data?.citasCanceladas ?? 0,   color: 'bg-orange-50 text-orange-700', ant: anterior?.citasCanceladas },
    { icon: '👥', label: 'Clientes atendidos', value: data?.clientesAtendidos ?? 0, color: 'bg-sky-50 text-sky-700',       ant: anterior?.clientesAtendidos },
    { icon: '🏆', label: 'Comisiones pagadas', value: data?.totalComisiones ?? 0,   color: 'bg-amber-50 text-amber-700',   ant: anterior?.totalComisiones },
    { icon: '📊', label: 'Promedio diario',    value: data?.promedioDiario ?? 0,    color: 'bg-pink-50 text-pink-700',     ant: anterior?.promedioDiario },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {kpis.map(k => (
        <KpiCard key={k.label} icon={k.icon} label={k.label} value={k.value}
          loading={loading} colorClass={k.color} anterior={k.ant} />
      ))}
    </div>
  )
}

// ── Tabla servicios top ───────────────────────────────────────────────────────
function TablaServiciosTop({ data, loading }: { data: ReporteData | null; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Scissors size={16} className="text-[#8B1E3F]" />
        <h3 className="font-semibold text-gray-800 text-sm">Servicios más realizados</h3>
      </div>
      {loading ? <div className="p-4"><Skeleton /></div> : (data?.serviciosTop.length ?? 0) === 0
        ? <p className="text-center text-gray-400 text-sm py-8">Sin datos</p>
        : (
          <div className="divide-y divide-gray-50">
            {(data?.serviciosTop ?? []).map((s, i) => {
              const maxTotal = data!.serviciosTop[0]?.total ?? 1
              const pct = (s.total / maxTotal) * 100
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[#D4AF37] font-bold text-sm w-5 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-gray-800 font-medium truncate">{s.nombre}</span>
                    <span className="text-xs text-gray-400 shrink-0">{s.cantidad}x</span>
                    <span className="font-bold text-[#8B1E3F] text-sm shrink-0">{fmtShort(s.total)}</span>
                  </div>
                  <div className="ml-7 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#EFA1B5] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ── Métodos de pago ────────────────────────────────────────────────────────────
function TablaMedodos({ data, loading }: { data: ReporteData | null; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <CreditCard size={16} className="text-[#8B1E3F]" />
        <h3 className="font-semibold text-gray-800 text-sm">Métodos de pago</h3>
      </div>
      {loading ? <div className="p-4"><Skeleton lines={3} /></div> : (data?.metodosPago.length ?? 0) === 0
        ? <p className="text-center text-gray-400 text-sm py-8">Sin datos</p>
        : (
          <div className="divide-y divide-gray-50">
            {(data?.metodosPago ?? []).map((m, i) => {
              const pct = data!.totalIngresos > 0 ? (m.total / data!.totalIngresos) * 100 : 0
              return (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 capitalize">{m.metodo}</span>
                  <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                  <span className="font-bold text-sm text-[#8B1E3F]">{fmtShort(m.total)}</span>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ── Comisiones por especialista ────────────────────────────────────────────────
function TablaComisiones({ data, loading }: { data: ReporteData | null; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Users size={16} className="text-[#8B1E3F]" />
        <h3 className="font-semibold text-gray-800 text-sm">Comisiones por especialista</h3>
      </div>
      {loading ? <div className="p-4"><Skeleton lines={3} /></div>
        : (data?.comisionesPorEspecialista.length ?? 0) === 0
          ? <p className="text-center text-gray-400 text-sm py-8">Sin datos</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#FFF8EE] border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Especialista</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600">Citas</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Facturado</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(data?.comisionesPorEspecialista ?? []).map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800 truncate max-w-[120px]">{e.nombre}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{e.citas}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#8B1E3F]">{fmtShort(e.total)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-rose-600">{fmtShort(e.pagado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  )
}

// ── Gastos por categoría ───────────────────────────────────────────────────────
function TablaGastosCat({ data, loading }: { data: ReporteData | null; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <TrendingDown size={16} className="text-rose-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Gastos por categoría</h3>
      </div>
      {loading ? <div className="p-4"><Skeleton lines={3} /></div>
        : (data?.gastosPorCategoria.length ?? 0) === 0
          ? <p className="text-center text-gray-400 text-sm py-8">Sin gastos registrados</p>
          : (
            <div className="divide-y divide-gray-50">
              {(data?.gastosPorCategoria ?? []).map((g, i) => {
                const pct = data!.gastosReales > 0 ? (g.total / data!.gastosReales) * 100 : 0
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex-1 text-sm text-gray-700">{g.categoria}</span>
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      <span className="font-bold text-sm text-rose-600">{fmtShort(g.total)}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-300 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
      }
    </div>
  )
}

// ── HistorialContable — componente principal ──────────────────────────────────
export default function HistorialContable({
  supabase: _supabase,
  especialistas: _especialistas,
}: {
  supabase: ReturnType<typeof createClient>
  especialistas: Especialista[]
}) {
  const MESES = generarMeses()

  // ── Estado del modo de filtro ────────────────────────────────────────────
  const [modo, setModo] = useState<'mes' | 'rango'>('mes')

  // ── Período principal ────────────────────────────────────────────────────
  const [periodoSel, setPeriodoSel]     = useState<MesPeriodo>(MESES[0])
  const [rangoStart, setRangoStart]     = useState(MESES[0].start)
  const [rangoEnd, setRangoEnd]         = useState(MESES[0].end)
  const [rangoActivo, setRangoActivo]   = useState(false)

  // Determinar start/end efectivos
  const effectiveStart = modo === 'mes' ? periodoSel.start : rangoStart
  const effectiveEnd   = modo === 'mes' ? periodoSel.end   : rangoEnd
  const effectiveLabel = modo === 'mes'
    ? periodoSel.label
    : `${rangoStart} → ${rangoEnd}`

  const fetchEnabled = modo === 'mes' || rangoActivo

  // ── Fetch principal ──────────────────────────────────────────────────────
  const { data, loading, error } = useReporte(effectiveStart, effectiveEnd, fetchEnabled)

  // ── Comparación ──────────────────────────────────────────────────────────
  const [comparando, setComparando]       = useState(false)
  const [periodoCmp, setPeriodoCmp]       = useState<MesPeriodo>(MESES[1] ?? MESES[0])
  const { data: dataCmp, loading: loadCmp } = useReporte(
    periodoCmp.start, periodoCmp.end, comparando
  )

  return (
    <div className="space-y-4 pb-4">

      {/* ── Controles de filtro ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">

        {/* Selector de modo */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit gap-1">
          <button
            onClick={() => setModo('mes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${modo === 'mes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            📅 Por mes
          </button>
          <button
            onClick={() => setModo('rango')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${modo === 'rango' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            📆 Rango de fechas
          </button>
        </div>

        {/* Filtro por mes */}
        {modo === 'mes' && (
          <PeriodoSelector
            meses={MESES}
            value={periodoSel.value}
            onChange={m => { setPeriodoSel(m); setComparando(false) }}
            label="Seleccionar período"
          />
        )}

        {/* Filtro por rango */}
        {modo === 'rango' && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Rango de fechas</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500">Fecha inicial</label>
                <input
                  type="date"
                  value={rangoStart}
                  onChange={e => { setRangoStart(e.target.value); setRangoActivo(false) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#EFA1B5]"
                />
              </div>
              <span className="text-gray-400 text-sm mt-4">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500">Fecha final</label>
                <input
                  type="date"
                  value={rangoEnd}
                  min={rangoStart}
                  onChange={e => { setRangoEnd(e.target.value); setRangoActivo(false) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#EFA1B5]"
                />
              </div>
              <button
                onClick={() => setRangoActivo(true)}
                className="mt-4 px-4 py-2 bg-[#8B1E3F] text-white rounded-xl text-xs font-bold hover:bg-[#6d1730] transition-colors"
              >
                Consultar
              </button>
            </div>
          </div>
        )}

        {/* Botón comparar */}
        {modo === 'mes' && (
          <button
            onClick={() => setComparando(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              comparando
                ? 'bg-violet-100 text-violet-700 border-violet-200'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <GitCompare size={13} />
            {comparando ? 'Cancelar comparación' : 'Comparar con otro mes'}
          </button>
        )}

        {/* Selector mes comparación */}
        {comparando && modo === 'mes' && (
          <PeriodoSelector
            meses={MESES.filter(m => m.value !== periodoSel.value)}
            value={periodoCmp.value}
            onChange={setPeriodoCmp}
            label="Comparar con"
          />
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      {(data || loading) && (
        <KpiGrid data={data} loading={loading} anterior={comparando ? dataCmp : undefined} />
      )}

      {/* ── Gráfica temporal ──────────────────────────────────────────────────── */}
      {(data || loading) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-[#8B1E3F]" />
              <h3 className="font-semibold text-gray-800 text-sm">Ingresos vs Gastos — {effectiveLabel}</h3>
            </div>
          </div>
          <div className="px-2 pb-3">
            <MiniBarChart serie={data?.serieTemporal ?? []} loading={loading} />
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400" /><span className="text-[10px] text-gray-500">Ingresos</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-300" /><span className="text-[10px] text-gray-500">Gastos</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Comparación ──────────────────────────────────────────────────────── */}
      {comparando && modo === 'mes' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <GitCompare size={16} className="text-violet-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Comparación de períodos</h3>
          </div>
          <div className="p-4">
            <ComparacionPanel
              periodoA={periodoSel} periodoB={periodoCmp}
              dataA={loading ? null : data} dataB={loadCmp ? null : dataCmp}
            />
          </div>
        </div>
      )}

      {/* ── Grids de tablas ────────────────────────────────────────────────────── */}
      {(data || loading) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TablaServiciosTop data={data} loading={loading} />
            <TablaMedodos data={data} loading={loading} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TablaComisiones data={data} loading={loading} />
            <TablaGastosCat data={data} loading={loading} />
          </div>
        </>
      )}

      {/* ── Placeholder si no hay datos ────────────────────────────────────────── */}
      {!data && !loading && !error && modo === 'rango' && !rangoActivo && (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Selecciona un rango y pulsa "Consultar"</p>
        </div>
      )}

      {/* ── Exportación ──────────────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Exportar reporte</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportarCSV(data, effectiveLabel)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:border-[#EFA1B5] hover:text-[#EFA1B5] transition-colors"
            >
              <Download size={15} /> CSV
            </button>
            <button
              onClick={() => exportarExcel(data, effectiveLabel)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:border-emerald-400 hover:text-emerald-600 transition-colors"
            >
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button
              onClick={() => imprimirReporte(data, effectiveLabel)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:border-sky-400 hover:text-sky-600 transition-colors"
            >
              <Printer size={15} /> Imprimir / PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
