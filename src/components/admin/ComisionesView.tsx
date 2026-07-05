'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DollarSign, Users, CheckCircle, Wallet, CreditCard,
  AlertCircle, FileText, Download, Printer, Plus, X,
  ChevronDown, Pencil, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────

type PeriodKey = 'hoy' | 'semana' | 'quincena' | 'mes' | 'anio' | 'personalizado'
type PagoEstado = 'pendiente' | 'pagado' | 'parcial'
type PeriodoLabel = 'semanal' | 'quincenal' | 'mensual' | 'personalizado'
type MetodoPago = 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'cheque' | 'otro'

interface Especialista {
  id: string
  nombre: string
}

interface ComisionConfig {
  id: string
  especialista_id: string
  porcentaje: number
}

interface CitaRow {
  id: string
  fecha_inicio: string
  valor_final: number | null
  porcentaje_comision: number | null
  comision_especialista: number | null
  ganancia_spa: number | null
  pago_estado: PagoEstado | null
  servicio: { nombre: string } | null
}

interface PagoRow {
  id: string
  especialista_id: string
  especialista_nombre: string
  fecha: string
  periodo: string
  fecha_inicio_periodo: string | null
  fecha_fin_periodo: string | null
  valor_pagado: number
  metodo_pago: string
  observaciones: string | null
  created_at: string
}

interface PagoForm {
  especialista_id: string
  fecha: string
  periodo: PeriodoLabel
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  valor_pagado: string
  metodo_pago: MetodoPago
  observaciones: string
}

interface Summary {
  totalFacturado: number
  comisionEspecialista: number
  gananciaSpa: number
  citasRealizadas: number
  totalPagado: number
  saldoPendiente: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n)
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function getPeriodRange(key: PeriodKey, custom: { desde: string; hasta: string }): { start: string; end: string } {
  const today = todayStr()
  const d = new Date(today + 'T12:00:00-05:00')
  switch (key) {
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
    case 'personalizado':
      return { start: custom.desde || today, end: custom.hasta || today }
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ComisionesView() {
  const supabase = createClient()

  // Period
  const [period, setPeriod] = useState<PeriodKey>('mes')
  const [custom, setCustom] = useState({ desde: '', hasta: '' })

  // Data
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [configs, setConfigs] = useState<ComisionConfig[]>([])
  const [citas, setCitas] = useState<CitaRow[]>([])
  const [pagos, setPagos] = useState<PagoRow[]>([])

  // Selection
  const [selectedEspId, setSelectedEspId] = useState<string | null>(null)

  // Loading
  const [loadingEsp, setLoadingEsp] = useState(true)
  const [loadingCitas, setLoadingCitas] = useState(true)
  const [loadingPagos, setLoadingPagos] = useState(true)

  // Edit % inline
  const [editingEspId, setEditingEspId] = useState<string | null>(null)
  const [editingPct, setEditingPct] = useState('')
  const [savingPct, setSavingPct] = useState(false)

  // Pago modal
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [savingPago, setSavingPago] = useState(false)
  const [pagoForm, setPagoForm] = useState<PagoForm>({
    especialista_id: '',
    fecha: todayStr(),
    periodo: 'mensual',
    fecha_inicio_periodo: '',
    fecha_fin_periodo: '',
    valor_pagado: '',
    metodo_pago: 'efectivo',
    observaciones: '',
  })

  // ── Load Especialistas & Configs ─────────────────────────────────────────

  const loadEspecialistas = useCallback(async () => {
    setLoadingEsp(true)
    const [espRes, cfgRes] = await Promise.all([
      supabase.from('especialistas').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('comisiones_config').select('id, especialista_id, porcentaje'),
    ])
    setEspecialistas((espRes.data ?? []) as Especialista[])
    setConfigs((cfgRes.data ?? []) as ComisionConfig[])
    setLoadingEsp(false)
  }, [supabase])

  // ── Load Citas ────────────────────────────────────────────────────────────

  const loadCitas = useCallback(async () => {
    setLoadingCitas(true)
    const { start, end } = getPeriodRange(period, custom)
    let q = supabase
      .from('citas')
      .select('id, fecha_inicio, valor_final, porcentaje_comision, comision_especialista, ganancia_spa, pago_estado, servicio:servicios(nombre)')
      .eq('estado', 'completada')
      .gte('fecha_inicio', start + 'T00:00:00-05:00')
      .lte('fecha_inicio', end + 'T23:59:59-05:00')
      .order('fecha_inicio', { ascending: false })

    if (selectedEspId) {
      q = q.eq('especialista_id', selectedEspId)
    }

    const { data, error } = await q
    if (error) toast.error('Error cargando citas')
    setCitas((data ?? []) as unknown as CitaRow[])
    setLoadingCitas(false)
  }, [supabase, period, custom, selectedEspId])

  // ── Load Pagos ────────────────────────────────────────────────────────────

  const loadPagos = useCallback(async () => {
    setLoadingPagos(true)
    const { start, end } = getPeriodRange(period, custom)
    let q = supabase
      .from('pagos_especialistas')
      .select('*')
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false })

    if (selectedEspId) {
      q = q.eq('especialista_id', selectedEspId)
    }

    const { data, error } = await q
    if (error) toast.error('Error cargando pagos')
    setPagos((data ?? []) as PagoRow[])
    setLoadingPagos(false)
  }, [supabase, period, custom, selectedEspId])

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { loadEspecialistas() }, [loadEspecialistas])
  useEffect(() => { loadCitas() }, [loadCitas])
  useEffect(() => { loadPagos() }, [loadPagos])

  // ── Derived: comisión % for selected esp ─────────────────────────────────

  function getPct(espId: string): number {
    return configs.find(c => c.especialista_id === espId)?.porcentaje ?? 40
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const summary: Summary = (() => {
    const totalFacturado = citas.reduce((a, c) => a + (c.valor_final ?? 0), 0)
    const espPct = selectedEspId ? getPct(selectedEspId) : 40
    const comisionEspecialista = citas.reduce((a, c) => {
      const base = c.comision_especialista ?? ((c.valor_final ?? 0) * espPct / 100)
      return a + base
    }, 0)
    const gananciaSpa = totalFacturado - comisionEspecialista
    const citasRealizadas = citas.length
    const totalPagado = pagos.reduce((a, p) => a + p.valor_pagado, 0)
    const saldoPendiente = Math.max(0, comisionEspecialista - totalPagado)
    return { totalFacturado, comisionEspecialista, gananciaSpa, citasRealizadas, totalPagado, saldoPendiente }
  })()

  // ── Edit % inline ─────────────────────────────────────────────────────────

  async function savePct(espId: string) {
    const pct = parseFloat(editingPct)
    if (isNaN(pct) || pct <= 0 || pct > 100) { toast.error('Porcentaje inválido (1-100)'); return }
    setSavingPct(true)
    const res = await fetch('/api/comisiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ especialista_id: espId, porcentaje: pct }),
    })
    if (!res.ok) { toast.error('Error guardando porcentaje'); setSavingPct(false); return }
    toast.success('Porcentaje actualizado')
    setSavingPct(false)
    setEditingEspId(null)
    loadEspecialistas()
  }

  // ── Registrar Pago ────────────────────────────────────────────────────────

  function openPagoModal() {
    const { start, end } = getPeriodRange(period, custom)
    setPagoForm({
      especialista_id: selectedEspId ?? '',
      fecha: todayStr(),
      periodo: 'mensual',
      fecha_inicio_periodo: start,
      fecha_fin_periodo: end,
      valor_pagado: summary.saldoPendiente > 0 ? String(Math.round(summary.saldoPendiente)) : '',
      metodo_pago: 'efectivo',
      observaciones: '',
    })
    setShowPagoModal(true)
  }

  async function savePago() {
    if (!pagoForm.especialista_id) { toast.error('Selecciona un especialista'); return }
    const valor = parseFloat(pagoForm.valor_pagado)
    if (isNaN(valor) || valor <= 0) { toast.error('Ingresa un valor válido'); return }
    setSavingPago(true)
    const esp = especialistas.find(e => e.id === pagoForm.especialista_id)
    const body = {
      especialista_id: pagoForm.especialista_id,
      especialista_nombre: esp?.nombre ?? '',
      fecha: pagoForm.fecha,
      periodo: pagoForm.periodo,
      fecha_inicio_periodo: pagoForm.fecha_inicio_periodo || null,
      fecha_fin_periodo: pagoForm.fecha_fin_periodo || null,
      valor_pagado: valor,
      metodo_pago: pagoForm.metodo_pago,
      observaciones: pagoForm.observaciones || null,
    }
    const res = await fetch('/api/pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { toast.error('Error registrando pago'); setSavingPago(false); return }
    toast.success('Pago registrado exitosamente')
    setSavingPago(false)
    setShowPagoModal(false)
    loadPagos()
    loadCitas()
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Fecha', 'Hora', 'Servicio', 'Valor', '% Comisión', 'Comisión', 'Ganancia Spa', 'Pago Estado']
    const rows = citas.map(c => {
      const espPct = selectedEspId ? getPct(selectedEspId) : (c.porcentaje_comision ?? 40)
      const comision = c.comision_especialista ?? ((c.valor_final ?? 0) * espPct / 100)
      const ganancia = c.ganancia_spa ?? ((c.valor_final ?? 0) - comision)
      return [
        fmtDate(c.fecha_inicio),
        fmtTime(c.fecha_inicio),
        (c.servicio as { nombre?: string } | null)?.nombre ?? '—',
        c.valor_final ?? 0,
        `${espPct}%`,
        comision.toFixed(0),
        ganancia.toFixed(0),
        c.pago_estado ?? 'pendiente',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comisiones_${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF / Print ───────────────────────────────────────────────────────────

  function generatePDF() {
    window.print()
  }

  // ── Period label for display ──────────────────────────────────────────────

  const { start: periodStart, end: periodEnd } = getPeriodRange(period, custom)

  const PERIOD_BTNS: { key: PeriodKey; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'quincena', label: 'Quincena' },
    { key: 'mes', label: 'Mes' },
    { key: 'anio', label: 'Año' },
    { key: 'personalizado', label: 'Personalizado' },
  ]

  const METODOS: { value: MetodoPago; label: string }[] = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'nequi', label: 'Nequi' },
    { value: 'daviplata', label: 'Daviplata' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'otro', label: 'Otro' },
  ]

  const PERIODOS: { value: PeriodoLabel; label: string }[] = [
    { value: 'semanal', label: 'Semanal' },
    { value: 'quincenal', label: 'Quincenal' },
    { value: 'mensual', label: 'Mensual' },
    { value: 'personalizado', label: 'Personalizado' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── PRINT AREA (hidden on screen) ────────────────────────────────── */}
      <div id="print-area" className="hidden print:block text-black text-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Claudia Agudelo Beauty</h1>
          <h2 className="text-lg">Reporte de Comisiones</h2>
          {selectedEspId && (
            <p className="mt-1">Especialista: <strong>{especialistas.find(e => e.id === selectedEspId)?.nombre}</strong></p>
          )}
          <p>Período: {periodStart} — {periodEnd}</p>
          <p className="text-xs text-gray-500">Generado: {new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</p>
        </div>

        {/* Summary table */}
        <table className="w-full border-collapse border border-gray-300 mb-6 text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">Indicador</th>
              <th className="border border-gray-300 p-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Total Facturado', formatCurrency(summary.totalFacturado)],
              ['Comisión Especialista', formatCurrency(summary.comisionEspecialista)],
              ['Ganancia Spa', formatCurrency(summary.gananciaSpa)],
              ['Citas Realizadas', String(summary.citasRealizadas)],
              ['Total Pagado', formatCurrency(summary.totalPagado)],
              ['Saldo Pendiente', formatCurrency(summary.saldoPendiente)],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="border border-gray-300 p-2">{k}</td>
                <td className="border border-gray-300 p-2 text-right font-medium">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Citas */}
        <h3 className="font-bold mb-2">Citas Completadas</h3>
        <table className="w-full border-collapse border border-gray-300 mb-6 text-xs">
          <thead>
            <tr className="bg-gray-100">
              {['Fecha', 'Hora', 'Servicio', 'Valor', '% Com.', 'Comisión', 'Ganancia Spa', 'Pago'].map(h => (
                <th key={h} className="border border-gray-300 p-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {citas.map(c => {
              const pct = c.porcentaje_comision ?? (selectedEspId ? getPct(selectedEspId) : 40)
              const com = c.comision_especialista ?? ((c.valor_final ?? 0) * pct / 100)
              const gan = c.ganancia_spa ?? ((c.valor_final ?? 0) - com)
              return (
                <tr key={c.id}>
                  <td className="border border-gray-300 p-1">{fmtDate(c.fecha_inicio)}</td>
                  <td className="border border-gray-300 p-1">{fmtTime(c.fecha_inicio)}</td>
                  <td className="border border-gray-300 p-1">{(c.servicio as { nombre?: string } | null)?.nombre ?? '—'}</td>
                  <td className="border border-gray-300 p-1 text-right">{formatCurrency(c.valor_final ?? 0)}</td>
                  <td className="border border-gray-300 p-1 text-center">{pct}%</td>
                  <td className="border border-gray-300 p-1 text-right">{formatCurrency(com)}</td>
                  <td className="border border-gray-300 p-1 text-right">{formatCurrency(gan)}</td>
                  <td className="border border-gray-300 p-1 capitalize">{c.pago_estado ?? 'pendiente'}</td>
                </tr>
              )
            })}
            <tr className="font-bold bg-gray-50">
              <td className="border border-gray-300 p-1" colSpan={3}>TOTALES</td>
              <td className="border border-gray-300 p-1 text-right">{formatCurrency(summary.totalFacturado)}</td>
              <td className="border border-gray-300 p-1"></td>
              <td className="border border-gray-300 p-1 text-right">{formatCurrency(summary.comisionEspecialista)}</td>
              <td className="border border-gray-300 p-1 text-right">{formatCurrency(summary.gananciaSpa)}</td>
              <td className="border border-gray-300 p-1"></td>
            </tr>
          </tbody>
        </table>

        {/* Pagos */}
        <h3 className="font-bold mb-2">Historial de Pagos</h3>
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100">
              {['Fecha', 'Período', 'Especialista', 'Valor', 'Método', 'Observaciones'].map(h => (
                <th key={h} className="border border-gray-300 p-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagos.map(p => (
              <tr key={p.id}>
                <td className="border border-gray-300 p-1">{p.fecha}</td>
                <td className="border border-gray-300 p-1 capitalize">{p.periodo}</td>
                <td className="border border-gray-300 p-1">{p.especialista_nombre}</td>
                <td className="border border-gray-300 p-1 text-right">{formatCurrency(p.valor_pagado)}</td>
                <td className="border border-gray-300 p-1 capitalize">{p.metodo_pago}</td>
                <td className="border border-gray-300 p-1">{p.observaciones ?? '—'}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td className="border border-gray-300 p-1" colSpan={3}>TOTAL PAGADO</td>
              <td className="border border-gray-300 p-1 text-right">{formatCurrency(summary.totalPagado)}</td>
              <td className="border border-gray-300 p-1" colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── SCREEN CONTENT ───────────────────────────────────────────────── */}
      <div className="print:hidden space-y-6">

        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-beauty-text">Comisiones y Pagos</h2>
            <p className="text-beauty-text-muted text-sm">Gestión de comisiones por especialista y registro de pagos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 bg-white border border-beauty-primary/40 text-beauty-borgona text-sm px-3 py-2 rounded-lg hover:bg-beauty-rosa-claro transition-colors"
            >
              <Download size={15} /> Exportar CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-white border border-beauty-primary/40 text-beauty-borgona text-sm px-3 py-2 rounded-lg hover:bg-beauty-rosa-claro transition-colors"
            >
              <Printer size={15} /> Exportar Excel
            </button>
            <button
              onClick={generatePDF}
              className="flex items-center gap-1.5 bg-white border border-beauty-primary/40 text-beauty-borgona text-sm px-3 py-2 rounded-lg hover:bg-beauty-rosa-claro transition-colors"
            >
              <FileText size={15} /> Generar PDF
            </button>
          </div>
        </div>

        {/* 2. Period Filter */}
        <div className="bg-white border border-beauty-primary/20 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-2 mb-3">
            {PERIOD_BTNS.map(b => (
              <button
                key={b.key}
                onClick={() => setPeriod(b.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  period === b.key
                    ? 'bg-beauty-primary text-white shadow-sm'
                    : 'bg-beauty-bg border border-beauty-primary/30 text-beauty-text hover:border-beauty-primary'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          {period === 'personalizado' && (
            <div className="flex flex-wrap gap-3 items-center mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-beauty-text-muted font-medium">Desde:</label>
                <input
                  type="date"
                  value={custom.desde}
                  onChange={e => setCustom(p => ({ ...p, desde: e.target.value }))}
                  className="border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-beauty-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-beauty-text-muted font-medium">Hasta:</label>
                <input
                  type="date"
                  value={custom.hasta}
                  onChange={e => setCustom(p => ({ ...p, hasta: e.target.value }))}
                  className="border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-beauty-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Specialist Selector */}
        <div className="bg-white border border-beauty-primary/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users size={17} className="text-beauty-borgona" />
            <h3 className="font-semibold text-beauty-text text-sm">Especialistas</h3>
            <span className="text-xs text-beauty-text-muted ml-1">— click para filtrar</span>
          </div>
          {loadingEsp ? (
            <div className="flex gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-28 h-20 bg-beauty-rosa-claro/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {/* "Todos" card */}
              <button
                onClick={() => setSelectedEspId(null)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all min-w-[90px] ${
                  selectedEspId === null
                    ? 'border-beauty-primary bg-beauty-rosa-claro/50'
                    : 'border-beauty-primary/20 bg-beauty-bg hover:border-beauty-primary/50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-beauty-primary/20 flex items-center justify-center text-beauty-borgona font-bold text-sm">
                  ★
                </div>
                <span className="text-xs font-medium text-beauty-text">Todos</span>
              </button>

              {especialistas.map(esp => {
                const pct = getPct(esp.id)
                const isSelected = selectedEspId === esp.id
                const isEditing = editingEspId === esp.id
                return (
                  <div
                    key={esp.id}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all min-w-[90px] cursor-pointer relative ${
                      isSelected
                        ? 'border-beauty-primary bg-beauty-rosa-claro/50'
                        : 'border-beauty-primary/20 bg-beauty-bg hover:border-beauty-primary/50'
                    }`}
                    onClick={() => !isEditing && setSelectedEspId(esp.id)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-beauty-borgona flex items-center justify-center text-white font-bold text-sm uppercase">
                      {esp.nombre.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-beauty-text text-center leading-tight">{esp.nombre.split(' ')[0]}</span>

                    {/* % badge */}
                    {isEditing ? (
                      <div
                        className="flex items-center gap-1 mt-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={editingPct}
                          onChange={e => setEditingPct(e.target.value)}
                          className="w-12 text-xs border border-beauty-secondary rounded px-1 py-0.5 text-center focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => savePct(esp.id)}
                          disabled={savingPct}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditingEspId(null)} className="text-red-400 hover:text-red-600">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="bg-beauty-secondary/20 text-beauty-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {pct}%
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditingEspId(esp.id)
                            setEditingPct(String(pct))
                          }}
                          className="text-beauty-text-muted hover:text-beauty-borgona transition-colors"
                          title="Editar %"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: 'Total Facturado',
              value: formatCurrency(summary.totalFacturado),
              icon: DollarSign,
              color: 'bg-emerald-100 text-emerald-600',
            },
            {
              label: 'Comisión Especialista',
              value: formatCurrency(summary.comisionEspecialista),
              icon: Users,
              color: 'bg-beauty-rosa-claro text-beauty-borgona',
            },
            {
              label: 'Ganancia Spa',
              value: formatCurrency(summary.gananciaSpa),
              icon: Wallet,
              color: 'bg-blue-100 text-blue-600',
            },
            {
              label: 'Citas Realizadas',
              value: String(summary.citasRealizadas),
              icon: CheckCircle,
              color: 'bg-violet-100 text-violet-600',
              isCount: true,
            },
            {
              label: 'Total Pagado',
              value: formatCurrency(summary.totalPagado),
              icon: CreditCard,
              color: 'bg-teal-100 text-teal-600',
            },
            {
              label: 'Saldo Pendiente',
              value: formatCurrency(summary.saldoPendiente),
              icon: AlertCircle,
              color: summary.saldoPendiente > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600',
              highlight: true,
            },
          ].map(card => (
            <div
              key={card.label}
              className={`bg-white border rounded-2xl p-4 shadow-sm ${
                card.highlight && summary.saldoPendiente > 0
                  ? 'border-red-200'
                  : card.highlight
                  ? 'border-green-200'
                  : 'border-beauty-primary/20'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${card.color}`}>
                <card.icon size={18} />
              </div>
              {loadingCitas || loadingPagos ? (
                <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mb-1" />
              ) : (
                <p className="text-base font-bold text-beauty-text leading-tight">{card.value}</p>
              )}
              <p className="text-[11px] text-beauty-text-muted mt-0.5 leading-tight">{card.label}</p>
            </div>
          ))}
        </div>

        {/* 5. Citas Table */}
        <div className="bg-white border border-beauty-primary/20 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <CheckCircle size={17} className="text-beauty-borgona" />
            <h3 className="font-semibold text-beauty-text text-sm">Citas Completadas</h3>
            {!loadingCitas && (
              <span className="ml-auto text-xs text-beauty-text-muted">{citas.length} cita{citas.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {loadingCitas ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-beauty-rosa-claro/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : citas.length === 0 ? (
            <p className="text-beauty-text-muted text-sm text-center py-10">
              Sin citas completadas en el período seleccionado
            </p>
          ) : (
            <>
              {/* Desktop tabla */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-beauty-bg border-b border-gray-100">
                      {['Fecha', 'Hora', 'Servicio', 'Valor', '% Comisión', 'Comisión', 'Ganancia Spa', 'Pago'].map(h => (
                        <th key={h} className="text-left py-2.5 px-4 text-beauty-text-muted font-medium text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map(c => {
                      const pct = c.porcentaje_comision ?? (selectedEspId ? getPct(selectedEspId) : 40)
                      const comision = c.comision_especialista ?? ((c.valor_final ?? 0) * pct / 100)
                      const ganancia = c.ganancia_spa ?? ((c.valor_final ?? 0) - comision)
                      return (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-beauty-bg transition-colors">
                          <td className="py-2.5 px-4 text-beauty-text-muted text-xs whitespace-nowrap">{fmtDate(c.fecha_inicio)}</td>
                          <td className="py-2.5 px-4 text-beauty-text-muted text-xs">{fmtTime(c.fecha_inicio)}</td>
                          <td className="py-2.5 px-4 text-beauty-text">{(c.servicio as { nombre?: string } | null)?.nombre ?? '—'}</td>
                          <td className="py-2.5 px-4 font-medium text-beauty-text">{formatCurrency(c.valor_final ?? 0)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="bg-beauty-secondary/20 text-beauty-secondary text-xs font-bold px-2 py-0.5 rounded-full">{pct}%</span>
                          </td>
                          <td className="py-2.5 px-4 text-beauty-borgona font-medium">{formatCurrency(comision)}</td>
                          <td className="py-2.5 px-4 text-emerald-600 font-medium">{formatCurrency(ganancia)}</td>
                          <td className="py-2.5 px-4">
                            {c.pago_estado === 'pagado' ? (
                              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Pagado</span>
                            ) : c.pago_estado === 'parcial' ? (
                              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">Parcial</span>
                            ) : (
                              <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Pendiente</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-beauty-bg border-t-2 border-beauty-primary/20 font-bold">
                      <td className="py-2.5 px-4 text-xs text-beauty-borgona" colSpan={3}>TOTALES</td>
                      <td className="py-2.5 px-4 text-beauty-text">{formatCurrency(summary.totalFacturado)}</td>
                      <td className="py-2.5 px-4"></td>
                      <td className="py-2.5 px-4 text-beauty-borgona">{formatCurrency(summary.comisionEspecialista)}</td>
                      <td className="py-2.5 px-4 text-emerald-700">{formatCurrency(summary.gananciaSpa)}</td>
                      <td className="py-2.5 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-50">
                {citas.map(c => {
                  const pct = c.porcentaje_comision ?? (selectedEspId ? getPct(selectedEspId) : 40)
                  const comision = c.comision_especialista ?? ((c.valor_final ?? 0) * pct / 100)
                  const ganancia = c.ganancia_spa ?? ((c.valor_final ?? 0) - comision)
                  return (
                    <div key={c.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-beauty-text text-sm">{(c.servicio as { nombre?: string } | null)?.nombre ?? '—'}</p>
                          <p className="text-xs text-beauty-text-muted">{fmtDate(c.fecha_inicio)} · {fmtTime(c.fecha_inicio)}</p>
                        </div>
                        {c.pago_estado === 'pagado' ? (
                          <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Pagado</span>
                        ) : c.pago_estado === 'parcial' ? (
                          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">Parcial</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Pendiente</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-beauty-bg rounded-lg p-2 text-center">
                          <p className="font-bold text-beauty-text">{formatCurrency(c.valor_final ?? 0)}</p>
                          <p className="text-beauty-text-muted">Valor</p>
                        </div>
                        <div className="bg-beauty-bg rounded-lg p-2 text-center">
                          <p className="font-bold text-beauty-borgona">{formatCurrency(comision)}</p>
                          <p className="text-beauty-text-muted">Comisión {pct}%</p>
                        </div>
                        <div className="bg-beauty-bg rounded-lg p-2 text-center">
                          <p className="font-bold text-emerald-600">{formatCurrency(ganancia)}</p>
                          <p className="text-beauty-text-muted">Ganancia</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="p-4 bg-beauty-bg flex justify-between text-xs font-bold text-beauty-borgona">
                  <span>TOTALES</span>
                  <span>{formatCurrency(summary.totalFacturado)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 6. Registrar Pago Button */}
        <div className="flex justify-end">
          <button
            onClick={openPagoModal}
            className="flex items-center gap-2 bg-beauty-borgona text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-beauty-borgona-dark transition-colors shadow-beauty"
          >
            <Plus size={18} /> Registrar Pago
          </button>
        </div>

        {/* 7. Historial de Pagos */}
        <div className="bg-white border border-beauty-primary/20 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <CreditCard size={17} className="text-beauty-borgona" />
            <h3 className="font-semibold text-beauty-text text-sm">Historial de Pagos</h3>
            {!loadingPagos && (
              <span className="ml-auto text-xs text-beauty-text-muted">{pagos.length} registro{pagos.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {loadingPagos ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-beauty-rosa-claro/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : pagos.length === 0 ? (
            <p className="text-beauty-text-muted text-sm text-center py-10">
              Sin pagos registrados en el período seleccionado
            </p>
          ) : (
            <>
              {/* Desktop tabla */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-beauty-bg border-b border-gray-100">
                      {['Fecha', 'Período', 'Especialista', 'Valor', 'Método', 'Observaciones'].map(h => (
                        <th key={h} className="text-left py-2.5 px-4 text-beauty-text-muted font-medium text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-beauty-bg transition-colors">
                        <td className="py-2.5 px-4 text-beauty-text-muted text-xs whitespace-nowrap">{p.fecha}</td>
                        <td className="py-2.5 px-4">
                          <span className="bg-beauty-rosa-claro text-beauty-borgona text-xs font-medium px-2 py-0.5 rounded-full capitalize">{p.periodo}</span>
                        </td>
                        <td className="py-2.5 px-4 text-beauty-text font-medium">{p.especialista_nombre}</td>
                        <td className="py-2.5 px-4 text-beauty-borgona font-bold">{formatCurrency(p.valor_pagado)}</td>
                        <td className="py-2.5 px-4 capitalize text-beauty-text-muted">{p.metodo_pago}</td>
                        <td className="py-2.5 px-4 text-beauty-text-muted text-xs max-w-[200px] truncate">{p.observaciones ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-beauty-bg border-t-2 border-beauty-primary/20 font-bold">
                      <td className="py-2.5 px-4 text-xs text-beauty-borgona" colSpan={3}>TOTAL PAGADO</td>
                      <td className="py-2.5 px-4 text-beauty-borgona">{formatCurrency(summary.totalPagado)}</td>
                      <td className="py-2.5 px-4" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-50">
                {pagos.map(p => (
                  <div key={p.id} className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-beauty-text text-sm">{p.especialista_nombre}</p>
                      <p className="font-bold text-beauty-borgona text-sm">{formatCurrency(p.valor_pagado)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="text-beauty-text-muted">{p.fecha}</span>
                      <span className="bg-beauty-rosa-claro text-beauty-borgona px-2 py-0.5 rounded-full capitalize">{p.periodo}</span>
                      <span className="text-beauty-text-muted capitalize">{p.metodo_pago}</span>
                    </div>
                    {p.observaciones && <p className="text-xs text-beauty-text-muted mt-1">{p.observaciones}</p>}
                  </div>
                ))}
                <div className="p-4 bg-beauty-bg flex justify-between text-xs font-bold text-beauty-borgona">
                  <span>TOTAL PAGADO</span>
                  <span>{formatCurrency(summary.totalPagado)}</span>
                </div>
              </div>
            </>
          )}
        </div>

      </div>{/* end print:hidden */}

      {/* ── PAGO MODAL ──────────────────────────────────────────────────────── */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-beauty-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-beauty-text">Registrar Pago a Especialista</h3>
              <button onClick={() => setShowPagoModal(false)} className="text-beauty-text-muted hover:text-beauty-borgona">
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">

              {/* Especialista */}
              <div>
                <label className="block text-xs font-medium text-beauty-text mb-1">Especialista *</label>
                <div className="relative">
                  <select
                    value={pagoForm.especialista_id}
                    onChange={e => setPagoForm(p => ({ ...p, especialista_id: e.target.value }))}
                    className="w-full appearance-none bg-beauty-bg border border-beauty-primary/30 text-beauty-text text-sm rounded-xl px-3 py-2.5 pr-9 focus:outline-none focus:border-beauty-primary"
                  >
                    <option value="">— Seleccionar —</option>
                    {especialistas.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-beauty-text mb-1">Fecha *</label>
                <input
                  type="date"
                  value={pagoForm.fecha}
                  onChange={e => setPagoForm(p => ({ ...p, fecha: e.target.value }))}
                  className="w-full border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-beauty-primary"
                />
              </div>

              {/* Período */}
              <div>
                <label className="block text-xs font-medium text-beauty-text mb-1">Período</label>
                <div className="relative">
                  <select
                    value={pagoForm.periodo}
                    onChange={e => setPagoForm(p => ({ ...p, periodo: e.target.value as PeriodoLabel }))}
                    className="w-full appearance-none bg-beauty-bg border border-beauty-primary/30 text-beauty-text text-sm rounded-xl px-3 py-2.5 pr-9 focus:outline-none focus:border-beauty-primary"
                  >
                    {PERIODOS.map(pe => (
                      <option key={pe.value} value={pe.value}>{pe.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Período fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-beauty-text mb-1">Fecha inicio período</label>
                  <input
                    type="date"
                    value={pagoForm.fecha_inicio_periodo}
                    onChange={e => setPagoForm(p => ({ ...p, fecha_inicio_periodo: e.target.value }))}
                    className="w-full border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-beauty-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-beauty-text mb-1">Fecha fin período</label>
                  <input
                    type="date"
                    value={pagoForm.fecha_fin_periodo}
                    onChange={e => setPagoForm(p => ({ ...p, fecha_fin_periodo: e.target.value }))}
                    className="w-full border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-beauty-primary"
                  />
                </div>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-beauty-text mb-1">Valor a pagar *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={pagoForm.valor_pagado}
                  onChange={e => setPagoForm(p => ({ ...p, valor_pagado: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-beauty-primary"
                />
                {summary.saldoPendiente > 0 && (
                  <p className="text-xs text-beauty-text-muted mt-1">
                    Saldo pendiente: <strong className="text-beauty-borgona">{formatCurrency(summary.saldoPendiente)}</strong>
                  </p>
                )}
              </div>

              {/* Método */}
              <div>
                <label className="block text-xs font-medium text-beauty-text mb-1">Método de pago</label>
                <div className="relative">
                  <select
                    value={pagoForm.metodo_pago}
                    onChange={e => setPagoForm(p => ({ ...p, metodo_pago: e.target.value as MetodoPago }))}
                    className="w-full appearance-none bg-beauty-bg border border-beauty-primary/30 text-beauty-text text-sm rounded-xl px-3 py-2.5 pr-9 focus:outline-none focus:border-beauty-primary"
                  >
                    {METODOS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-beauty-text mb-1">Observaciones</label>
                <textarea
                  rows={3}
                  value={pagoForm.observaciones}
                  onChange={e => setPagoForm(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="w-full border border-beauty-primary/30 bg-beauty-bg text-beauty-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-beauty-primary resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowPagoModal(false)}
                className="px-4 py-2 text-sm text-beauty-text-muted hover:text-beauty-borgona border border-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={savePago}
                disabled={savingPago}
                className="flex items-center gap-2 bg-beauty-borgona text-white font-semibold px-5 py-2 rounded-xl hover:bg-beauty-borgona-dark transition-colors disabled:opacity-60"
              >
                {savingPago ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <><Check size={16} /> Guardar Pago</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
