'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingDown, Users, BarChart2, Clock, Scissors,
  Download, X, Check, Loader2, Plus, Trash2, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────
type Period   = 'hoy' | 'semana' | 'quincena' | 'mes'
type EspPeriod = 'hoy' | '7dias' | '15dias' | 'este_mes' | 'mes_anterior'

const GASTO_CATEGORIAS = [
  'Productos', 'Insumos', 'Arriendo', 'Publicidad',
  'Servicios Públicos', 'Nómina Administrativa',
  'Equipos', 'Mantenimiento', 'Otros',
] as const
type GastoCategoria = typeof GASTO_CATEGORIAS[number]

interface HistorialItem {
  id: string; fecha: string; titulo: string; subtitulo: string
  especialista: string; valor: number; tipo: 'ingreso' | 'gasto'
  metodo_pago?: string; esManual: boolean
}
interface ChartPoint { label: string; ingresos: number; gastos: number }
interface Especialista { id: string; nombre: string }
interface DashData { ingresosHoy:number; ingresosSemana:number; ingresosMes:number; gastosMes:number; neta:number }

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v)
}
function colDate(dt?: Date) {
  return (dt ?? new Date()).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}
function rangeOf(p: Period): { start: string; end: string } {
  const today = colDate()
  const d = new Date(today + 'T12:00:00-05:00')
  if (p === 'hoy') return { start: today, end: today }
  if (p === 'semana')   { const s = new Date(d); s.setDate(d.getDate()-6);  return { start: colDate(s), end: today } }
  if (p === 'quincena') { const s = new Date(d); s.setDate(d.getDate()-14); return { start: colDate(s), end: today } }
  return { start: colDate(new Date(d.getFullYear(), d.getMonth(), 1)), end: today }
}
function espRangeOf(p: EspPeriod) {
  const today = colDate(); const d = new Date(today + 'T12:00:00-05:00')
  if (p === 'hoy')    return { start: today, end: today }
  if (p === '7dias')  { const s=new Date(d);s.setDate(d.getDate()-6); return {start:colDate(s),end:today} }
  if (p === '15dias') { const s=new Date(d);s.setDate(d.getDate()-14);return {start:colDate(s),end:today} }
  if (p === 'mes_anterior') {
    const s=new Date(d.getFullYear(),d.getMonth()-1,1); const e=new Date(d.getFullYear(),d.getMonth(),0)
    return {start:colDate(s),end:colDate(e)}
  }
  return { start: colDate(new Date(d.getFullYear(),d.getMonth(),1)), end: today }
}
async function fetchGastos(start: string, end: string) {
  const r = await fetch(`/api/gastos?start=${start}&end=${end}`)
  const d = await r.json()
  if (!r.ok) { console.error('[fetchGastos] Error:', d); return [] }
  const arr = Array.isArray(d) ? d as {id:string;fecha:string;descripcion:string;valor:number;categoria:string}[] : []
  console.info(`[fetchGastos] ${start}→${end}: ${arr.length} registros`)
  return arr
}
function esIngreso(desc: string) { return desc.startsWith('[INGRESO]') }
function descLimpia(desc: string) { return desc.startsWith('[INGRESO] ') ? desc.slice(10) : desc }

// ── BarChart ────────────────────────────────────────────────────────────────
function BarChart({ data, loading }: { data: ChartPoint[]; loading: boolean }) {
  if (loading) return <div className="h-32 flex items-end gap-1 px-2 pb-2 animate-pulse">{Array(7).fill(0).map((_,i)=><div key={i} className="flex-1 bg-gray-100 rounded-t-md" style={{height:`${30+i*8}%`}} />)}</div>
  if (!data.length) return <p className="text-center text-gray-400 text-sm py-10">Sin datos</p>
  const maxVal = Math.max(...data.flatMap(d=>[d.ingresos,d.gastos]),1)
  return (
    <div className="flex items-end gap-1.5 px-2 pb-0 h-32">
      {data.map((pt,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          <div className="w-full flex items-end gap-0.5" style={{height:'100px'}}>
            <div className="flex-1 bg-emerald-400 rounded-t-sm transition-all duration-500" style={{height:`${(pt.ingresos/maxVal)*100}%`,minHeight:pt.ingresos>0?3:0}} title={`Ingresos: ${fmt(pt.ingresos)}`} />
            <div className="flex-1 bg-rose-300 rounded-t-sm transition-all duration-500" style={{height:`${(pt.gastos/maxVal)*100}%`,minHeight:pt.gastos>0?3:0}} title={`Gastos: ${fmt(pt.gastos)}`} />
          </div>
          <span className="text-[9px] text-gray-400 truncate w-full text-center">{pt.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── EspCard ─────────────────────────────────────────────────────────────────
function EspCard({ esp, period, supabase }: { esp: Especialista; period: EspPeriod; supabase: ReturnType<typeof createClient> }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{total:number;citas:number;comision:number;pct:number;svcs:{nombre:string;cantidad:number;total:number}[]}|null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => { setData(null) }, [period])
  useEffect(() => {
    if (!open || data) return
    setLoading(true)
    const { start, end } = espRangeOf(period)
    Promise.all([
      supabase.from('citas').select('valor_final,servicio:servicios(nombre)').eq('estado','completada').eq('especialista_id',esp.id).gte('fecha_inicio',start+'T00:00:00-05:00').lte('fecha_inicio',end+'T23:59:59-05:00'),
      supabase.from('comisiones_config').select('porcentaje').eq('especialista_id',esp.id).maybeSingle(),
    ]).then(([cRes,comRes]) => {
      const citas = cRes.data??[]; const pct = (comRes.data?.porcentaje as number)??40
      const total = citas.reduce((a,c)=>a+(c.valor_final??0),0)
      const svcMap: Record<string,{cantidad:number;total:number}> = {}
      citas.forEach(c => { const n=(c.servicio as {nombre?:string}|null)?.nombre??'—'; if(!svcMap[n])svcMap[n]={cantidad:0,total:0}; svcMap[n].cantidad++; svcMap[n].total+=c.valor_final??0 })
      setData({ total, citas:citas.length, comision:total*(pct/100), pct, svcs:Object.entries(svcMap).map(([nombre,v])=>({nombre,...v})).sort((a,b)=>b.total-a.total) })
      setLoading(false)
    })
  }, [open, esp.id, period, supabase, data])
  const initials = esp.nombre.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
  const cols = ['bg-pink-100 text-pink-700','bg-purple-100 text-purple-700','bg-sky-100 text-sky-700','bg-amber-100 text-amber-700','bg-emerald-100 text-emerald-700']
  const col = cols[esp.nombre.charCodeAt(0)%cols.length]
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <button onClick={()=>setOpen(v=>!v)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${col}`}>{initials}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{esp.nombre}</p>
          {data&&!loading&&<p className="text-xs text-gray-500">{data.citas} citas · {fmt(data.total)}</p>}
        </div>
        {loading?<Loader2 size={16} className="text-gray-400 animate-spin shrink-0"/>:<ChevronRight size={16} className={`text-gray-400 shrink-0 transition-transform ${open?'rotate-90':''}`}/>}
      </button>
      {open&&(
        <div className="border-t border-gray-100 p-4 space-y-3">
          {loading?<div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i=><div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          :data?(
            <>
              <div className="grid grid-cols-2 gap-2">
                {[{label:'Total facturado',value:fmt(data.total),accent:true},{label:'Citas realizadas',value:String(data.citas)},{label:'Ticket promedio',value:fmt(data.citas?data.total/data.citas:0)},{label:`Comisión ${data.pct}%`,value:fmt(data.comision),red:true}].map(k=>(
                  <div key={k.label} className="bg-[#FFF8EE] rounded-xl p-3">
                    <p className={`text-base font-bold leading-tight ${k.accent?'text-[#8B1E3F]':k.red?'text-rose-600':'text-gray-800'}`}>{k.value}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                <span className="text-sm font-semibold text-rose-700">💸 Valor a pagar</span>
                <span className="text-lg font-bold text-rose-700">{fmt(data.comision)}</span>
              </div>
              {data.svcs.length>0&&(<div className="space-y-1.5"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios realizados</p>{data.svcs.map((s,i)=><div key={i} className="flex items-center gap-2 text-xs"><span className="flex-1 text-gray-700 truncate">{s.nombre}</span><span className="text-gray-400 shrink-0">{s.cantidad}x</span><span className="font-semibold text-[#8B1E3F] shrink-0">{fmt(s.total)}</span></div>)}</div>)}
            </>
          ):null}
        </div>
      )}
    </div>
  )
}

// ── MovimientoModal ─────────────────────────────────────────────────────────
function MovimientoModal({ tipo, onClose, onSaved }: { tipo:'ingreso'|'gasto'; onClose:()=>void; onSaved:()=>void }) {
  const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [form, setForm] = useState({ fecha: fechaHoy, categoria: 'Productos' as GastoCategoria, descripcion: '', valor: '' })
  const [saving, setSaving] = useState(false)
  const isGasto = tipo === 'gasto'

  async function save() {
    if (!form.descripcion.trim()) { toast.error('Agrega una descripción'); return }
    const valor = parseFloat(form.valor)
    if (!valor || valor <= 0) { toast.error('Ingresa un valor válido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: form.fecha,
          categoria: isGasto ? form.categoria : 'Otros',
          descripcion: isGasto ? form.descripcion.trim() : `[INGRESO] ${form.descripcion.trim()}`,
          valor,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(`Error: ${json.error ?? res.statusText}`); setSaving(false); return }
      toast.success(isGasto ? '💸 Gasto registrado' : '💰 Ingreso registrado')
      onSaved(); onClose()
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`); setSaving(false)
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[92vh] animate-slide-up">
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200"/></div>
        <div className={`px-5 pt-4 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0 ${isGasto?'bg-rose-50':'bg-emerald-50'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{isGasto?'💸':'💰'}</span>
            <h4 className="font-bold text-gray-800">{isGasto?'Registrar Gasto':'Registrar Ingreso'}</h4>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/60 rounded-xl"><X size={16} className="text-gray-500"/></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha</label>
            <input type="date" value={form.fecha} readOnly
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 cursor-default" />
          </div>
          {isGasto&&(
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Categoría</label>
              <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value as GastoCategoria}))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#EFA1B5] appearance-none bg-white">
                {GASTO_CATEGORIAS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción</label>
            <input type="text" placeholder={isGasto?'Ej: Compra productos capilares':'Ej: Venta productos'}
              value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#EFA1B5] focus:ring-2 focus:ring-[#EFA1B5]/20"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Valor (COP)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input type="number" min="0" placeholder="0" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))}
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-lg font-bold focus:outline-none focus:border-[#EFA1B5] focus:ring-2 focus:ring-[#EFA1B5]/20"/>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving}
            className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${isGasto?'bg-rose-500 hover:bg-rose-600':'bg-emerald-500 hover:bg-emerald-600'}`}>
            {saving?<Loader2 size={14} className="animate-spin"/>:<Check size={14}/>}
            {isGasto?'Guardar Gasto':'Guardar Ingreso'}
          </button>
        </div>
      </div>
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function ReportesView() {
  const supabase = createClient()
  const [period, setPeriod] = useState<Period>('mes')
  const [espPeriod, setEspPeriod] = useState<EspPeriod>('este_mes')
  const [chartFilter, setChartFilter] = useState<Period>('semana')
  const [modal, setModal] = useState<'ingreso'|'gasto'|null>(null)
  const [dash, setDash] = useState<DashData>({ingresosHoy:0,ingresosSemana:0,ingresosMes:0,gastosMes:0,neta:0})
  const [dashLoading, setDashLoading] = useState(true)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])

  const loadDash = useCallback(async () => {
    setDashLoading(true)
    const today = colDate()
    const d = new Date(today+'T12:00:00-05:00')
    const semStart = colDate(new Date(new Date(d).setDate(d.getDate()-6)))
    const mesStart = colDate(new Date(d.getFullYear(), d.getMonth(), 1))
    const [citHoy, citSem, citMes, gHoy, gSem, gMes] = await Promise.all([
      supabase.from('citas').select('valor_final').eq('estado','completada').gte('fecha_inicio',today+'T00:00:00-05:00').lte('fecha_inicio',today+'T23:59:59-05:00'),
      supabase.from('citas').select('valor_final').eq('estado','completada').gte('fecha_inicio',semStart+'T00:00:00-05:00').lte('fecha_inicio',today+'T23:59:59-05:00'),
      supabase.from('citas').select('valor_final').eq('estado','completada').gte('fecha_inicio',mesStart+'T00:00:00-05:00').lte('fecha_inicio',today+'T23:59:59-05:00'),
      fetchGastos(today, today),
      fetchGastos(semStart, today),
      fetchGastos(mesStart, today),
    ])
    const sumCitas = (r:{valor_final?:number|null}[]) => r.reduce((a,c)=>a+(c.valor_final??0),0)
    const sumIngManuales = (g:{descripcion:string;valor:number}[]) => g.filter(x=>esIngreso(x.descripcion)).reduce((a,x)=>a+x.valor,0)
    const sumGastosReales = (g:{descripcion:string;valor:number}[]) => g.filter(x=>!esIngreso(x.descripcion)).reduce((a,x)=>a+x.valor,0)
    setDash({
      ingresosHoy:    sumCitas(citHoy.data??[])  + sumIngManuales(gHoy),
      ingresosSemana: sumCitas(citSem.data??[])  + sumIngManuales(gSem),
      ingresosMes:    sumCitas(citMes.data??[])  + sumIngManuales(gMes),
      gastosMes:      sumGastosReales(gMes),
      neta:           sumCitas(citMes.data??[]) + sumIngManuales(gMes) - sumGastosReales(gMes),
    })
    setDashLoading(false)
  }, [supabase])

  const loadHistorial = useCallback(async () => {
    setHistLoading(true)
    const { start, end } = rangeOf(period)
    const [cRes, gRaw] = await Promise.all([
      supabase.from('citas').select('id,fecha_inicio,valor_final,cliente:clientes(nombre),servicio:servicios(nombre),especialista:especialistas(nombre),metodo_pago')
        .eq('estado','completada').gte('fecha_inicio',start+'T00:00:00-05:00').lte('fecha_inicio',end+'T23:59:59-05:00').order('fecha_inicio',{ascending:false}).limit(50),
      fetchGastos(start, end),
    ])
    const citasH: HistorialItem[] = (cRes.data??[]).map(c=>({
      id:c.id, fecha:c.fecha_inicio,
      titulo:(c.cliente as {nombre?:string}|null)?.nombre??'—',
      subtitulo:(c.servicio as {nombre?:string}|null)?.nombre??'—',
      especialista:(c.especialista as {nombre?:string}|null)?.nombre??'—',
      valor:c.valor_final??0, tipo:'ingreso', metodo_pago:(c as {metodo_pago?:string}).metodo_pago, esManual:false,
    }))
    const gastosH: HistorialItem[] = gRaw.map(g=>({
      id:g.id, fecha:g.fecha+'T12:00:00-05:00',
      titulo:g.categoria,
      subtitulo:descLimpia(g.descripcion),
      especialista:'—', valor:g.valor,
      tipo:esIngreso(g.descripcion)?'ingreso':'gasto',
      esManual:true,
    }))
    setHistorial([...citasH,...gastosH].sort((a,b)=>b.fecha.localeCompare(a.fecha)))
    setHistLoading(false)
  }, [supabase, period])

  const loadChart = useCallback(async () => {
    setChartLoading(true)
    const { start, end } = rangeOf(chartFilter)
    const [cRes, gRaw] = await Promise.all([
      supabase.from('citas').select('fecha_inicio,valor_final').eq('estado','completada').gte('fecha_inicio',start+'T00:00:00-05:00').lte('fecha_inicio',end+'T23:59:59-05:00'),
      fetchGastos(start, end),
    ])
    const map = new Map<string,{ingresos:number;gastos:number}>()
    const key = (d:string) => chartFilter==='hoy' ? d.slice(11,13)+'h' : d.slice(5,10)
    ;(cRes.data??[]).forEach(c=>{ const k=key(c.fecha_inicio); if(!map.has(k))map.set(k,{ingresos:0,gastos:0}); map.get(k)!.ingresos+=c.valor_final??0 })
    gRaw.forEach(g=>{ const k=g.fecha.slice(5,10); if(!map.has(k))map.set(k,{ingresos:0,gastos:0}); esIngreso(g.descripcion)?map.get(k)!.ingresos+=g.valor:map.get(k)!.gastos+=g.valor })
    setChartData(Array.from(map.entries()).sort(([a],[b])=>a.localeCompare(b)).slice(-10).map(([label,v])=>({label,ingresos:v.ingresos,gastos:v.gastos})))
    setChartLoading(false)
  }, [supabase, chartFilter])

  const loadEsps = useCallback(async()=>{ const {data}=await supabase.from('especialistas').select('id,nombre').eq('activo',true).order('nombre'); setEspecialistas((data??[]) as Especialista[]) },[supabase])

  useEffect(()=>{ loadDash(); loadEsps() },[loadDash,loadEsps])
  useEffect(()=>{ loadHistorial() },[loadHistorial])
  useEffect(()=>{ loadChart() },[loadChart])

  const reload = useCallback(()=>{ loadDash(); loadHistorial(); loadChart() },[loadDash,loadHistorial,loadChart])

  const onDelete = useCallback(async (id: string, label: string) => {
    toast(t=>(
      <span className="flex items-center gap-3 text-sm">
        <span>¿Eliminar <strong>{label}</strong>?</span>
        <button
          onClick={async()=>{
            toast.dismiss(t.id)
            const r = await fetch(`/api/gastos?id=${id}`, { method:'DELETE' })
            if (r.ok) { toast.success('Eliminado') } else { toast.error('Error al eliminar') }
            loadDash(); loadHistorial(); loadChart()
          }}
          className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">Sí</button>
        <button onClick={()=>toast.dismiss(t.id)} className="text-gray-400 text-xs">No</button>
      </span>
    ),{duration:8000})
  },[loadDash,loadHistorial,loadChart])

  const PBTN: {key:Period;label:string}[] = [{key:'hoy',label:'Hoy'},{key:'semana',label:'Semana'},{key:'quincena',label:'Quincena'},{key:'mes',label:'Mes'}]
  const EPBTN: {key:EspPeriod;label:string}[] = [{key:'hoy',label:'Hoy'},{key:'7dias',label:'7d'},{key:'15dias',label:'15d'},{key:'este_mes',label:'Este mes'},{key:'mes_anterior',label:'Mes ant.'}]

  return (
    <div className="space-y-4 animate-fade-in pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-800">Contabilidad</h2><p className="text-xs text-gray-400">Ingresos, gastos y comisiones</p></div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {PBTN.map(b=><button key={b.key} onClick={()=>setPeriod(b.key)} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${period===b.key?'bg-[#EFA1B5] text-white border-[#EFA1B5]':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{b.label}</button>)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {[
          {icon:'💰',label:'Ingresos hoy',     val:dash.ingresosHoy,    color:'bg-emerald-50 text-emerald-700'},
          {icon:'📅',label:'Ingresos semana',  val:dash.ingresosSemana, color:'bg-blue-50 text-blue-700'},
          {icon:'📆',label:'Ingresos del mes', val:dash.ingresosMes,    color:'bg-violet-50 text-violet-700'},
          {icon:'💸',label:'Gastos del mes',   val:dash.gastosMes,      color:'bg-rose-50 text-rose-700'},
          {icon:'📈',label:'Ganancia neta',    val:dash.neta,           color:dash.neta>=0?'bg-teal-50 text-teal-700':'bg-red-50 text-red-700'},
        ].map(c=>(
          <div key={c.label} className={`rounded-2xl p-3.5 flex items-center gap-3 border border-white/50 ${c.color}`}>
            <span className="text-2xl shrink-0">{c.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium opacity-70 truncate">{c.label}</p>
              <p className="text-base font-bold leading-tight">{dashLoading?'—':fmt(c.val)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={()=>setModal('ingreso')} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white font-bold text-sm shadow-sm hover:bg-emerald-600 active:scale-95 transition-all"><Plus size={18}/> Agregar ingreso</button>
        <button onClick={()=>setModal('gasto')}   className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-500 text-white font-bold text-sm shadow-sm hover:bg-rose-600 active:scale-95 transition-all"><TrendingDown size={18}/> Agregar gasto</button>
      </div>

      {/* Gráfica */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2"><BarChart2 size={17} className="text-[#8B1E3F]"/><h3 className="font-semibold text-gray-800 text-sm">Ingresos vs Gastos</h3></div>
          <div className="flex gap-1">{PBTN.map(b=><button key={b.key} onClick={()=>setChartFilter(b.key)} className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${chartFilter===b.key?'bg-[#EFA1B5] text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{b.label}</button>)}</div>
        </div>
        <div className="px-2 pb-3">
          <BarChart data={chartData} loading={chartLoading}/>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400"/><span className="text-[10px] text-gray-500">Ingresos</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-300"/><span className="text-[10px] text-gray-500">Gastos</span></div>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Clock size={17} className="text-[#8B1E3F]"/>
          <h3 className="font-semibold text-gray-800 text-sm">Últimos movimientos</h3>
          <span className="text-[10px] text-gray-400 ml-1">— {period}</span>
        </div>
        {histLoading
          ? <div className="p-4 space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          : historial.length===0
            ? <p className="text-center text-gray-400 text-sm py-8">Sin movimientos en el período</p>
            : <div className="divide-y divide-gray-50">
                {historial.map(h=>(
                  <div key={h.id} className={`flex items-center gap-3 px-4 py-3 min-h-[60px] ${h.tipo==='ingreso'?'hover:bg-emerald-50/50':'hover:bg-rose-50/50'} transition-colors`}>
                    <div className={`w-2 self-stretch rounded-full shrink-0 ${h.tipo==='ingreso'?'bg-emerald-400':'bg-rose-400'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-800 text-sm truncate">{h.titulo}</p>
                        {h.metodo_pago&&<span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{h.metodo_pago}</span>}
                      </div>
                      <p className="text-gray-500 text-xs truncate">{h.subtitulo}</p>
                      <p className="text-gray-400 text-[10px]">
                        {h.especialista!=='—'?`${h.especialista} · `:''}
                        {new Date(h.fecha).toLocaleDateString('es-CO',{timeZone:'America/Bogota',day:'2-digit',month:'short'})}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`font-bold text-sm ${h.tipo==='ingreso'?'text-emerald-600':'text-rose-600'}`}>{h.tipo==='ingreso'?'+':'-'}{fmt(h.valor)}</p>
                      {h.esManual&&<button onClick={()=>onDelete(h.id,h.subtitulo)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12}/></button>}
                    </div>
                  </div>
                ))}
              </div>
        }
      </div>

      {/* Especialistas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Users size={17} className="text-[#8B1E3F]"/><h3 className="font-semibold text-gray-800 text-sm">Producción por especialista</h3></div>
          <div className="flex gap-1 overflow-x-auto scrollbar-none">{EPBTN.map(b=><button key={b.key} onClick={()=>setEspPeriod(b.key)} className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${espPeriod===b.key?'bg-[#EFA1B5] text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{b.label}</button>)}</div>
        </div>
        <div className="space-y-2">
          {especialistas.length===0?<p className="text-center text-gray-400 text-sm py-6">Sin especialistas activas</p>:especialistas.map(e=><EspCard key={e.id} esp={e} period={espPeriod} supabase={supabase}/>)}
        </div>
      </div>

      {/* Top servicios */}
      <TopServicios period={period} supabase={supabase}/>

      {/* Exportar */}
      <button onClick={()=>{
        const rows=[['Fecha','Título','Detalle','Especialista','Valor','Tipo'],...historial.map(h=>[h.fecha.slice(0,10),h.titulo,h.subtitulo,h.especialista,String(h.valor),h.tipo])]
        const csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
        const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`reporte-${period}-${colDate()}.csv`;a.click()
        toast.success('CSV exportado')
      }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium hover:border-[#EFA1B5] hover:text-[#EFA1B5] transition-colors">
        <Download size={16}/> Exportar reporte CSV
      </button>

      {modal&&<MovimientoModal tipo={modal} onClose={()=>setModal(null)} onSaved={reload}/>}
    </div>
  )
}

// ── TopServicios ────────────────────────────────────────────────────────────
function TopServicios({ period, supabase }: { period: Period; supabase: ReturnType<typeof createClient> }) {
  const [data, setData] = useState<{nombre:string;cantidad:number;total:number}[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{
    setLoading(true)
    const { start, end } = rangeOf(period)
    supabase.from('citas').select('valor_final,servicio:servicios(nombre)').eq('estado','completada').gte('fecha_inicio',start+'T00:00:00-05:00').lte('fecha_inicio',end+'T23:59:59-05:00')
      .then(({data:rows})=>{
        const map: Record<string,{cantidad:number;total:number}>={}
        ;(rows??[]).forEach(c=>{ const n=(c.servicio as {nombre?:string}|null)?.nombre??'—'; if(!map[n])map[n]={cantidad:0,total:0}; map[n].cantidad++; map[n].total+=c.valor_final??0 })
        setData(Object.entries(map).map(([nombre,v])=>({nombre,...v})).sort((a,b)=>b.total-a.total))
        setLoading(false)
      })
  },[period,supabase])
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Scissors size={17} className="text-[#8B1E3F]"/>
        <h3 className="font-semibold text-gray-800 text-sm">Top servicios</h3>
      </div>
      {loading?<div className="p-4 space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      :data.length===0?<p className="text-center text-gray-400 text-sm py-8">Sin datos</p>
      :<div className="divide-y divide-gray-50">
        {data.slice(0,8).map((s,i)=>{
          const pct=data[0].total>0?(s.total/data[0].total)*100:0
          return (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[#D4AF37] font-bold text-sm w-5 shrink-0">{i+1}</span>
                <span className="flex-1 text-sm text-gray-800 font-medium truncate">{s.nombre}</span>
                <span className="text-xs text-gray-400 shrink-0">{s.cantidad}x</span>
                <span className="font-bold text-[#8B1E3F] text-sm shrink-0">{fmt(s.total)}</span>
              </div>
              <div className="ml-7 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#EFA1B5] rounded-full transition-all duration-500" style={{width:`${pct}%`}}/>
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
