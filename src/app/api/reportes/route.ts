import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

/**
 * GET /api/reportes?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Devuelve un resumen contable completo para el rango indicado.
 * Solo admins pueden consumir este endpoint.
 */
export async function GET(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Acceso restringido a administradores')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json({ error: 'start y end son requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  // Construir timestamps Colombia
  const startTs = `${start}T00:00:00-05:00`
  const endTs   = `${end}T23:59:59-05:00`

  // ── Consultas en paralelo ──────────────────────────────────────────────
  const [citasRes, gastosRes, pagosRes] = await Promise.all([
    supabase
      .from('citas')
      .select(`
        id, fecha_inicio, valor_final, estado, metodo_pago, canal,
        cliente:clientes(id, nombre),
        especialista:especialistas(id, nombre),
        servicio:servicios(id, nombre, precio)
      `)
      .gte('fecha_inicio', startTs)
      .lte('fecha_inicio', endTs)
      .order('fecha_inicio', { ascending: false }),

    supabase
      .from('gastos')
      .select('id, fecha, categoria, descripcion, valor')
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false }),

    supabase
      .from('pagos_especialistas')
      .select('id, fecha, especialista_id, especialista_nombre, valor_pagado, metodo_pago, periodo')
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false }),
  ])

  if (citasRes.error)  return NextResponse.json({ error: citasRes.error.message  }, { status: 500 })
  if (gastosRes.error) return NextResponse.json({ error: gastosRes.error.message }, { status: 500 })
  if (pagosRes.error)  return NextResponse.json({ error: pagosRes.error.message  }, { status: 500 })

  const citas  = citasRes.data  ?? []
  const gastos = gastosRes.data ?? []
  const pagos  = pagosRes.data  ?? []

  // ── Calcular métricas ──────────────────────────────────────────────────
  const citasCompletadas  = citas.filter(c => c.estado === 'completada')
  const citasCanceladas   = citas.filter(c => c.estado === 'cancelada')

  // Ingresos: citas completadas + registros manuales [INGRESO] en gastos
  const ingresosCitas     = citasCompletadas.reduce((a, c) => a + (c.valor_final ?? 0), 0)
  const ingresosManuales  = gastos.filter(g => g.descripcion?.startsWith('[INGRESO]')).reduce((a, g) => a + g.valor, 0)
  const totalIngresos     = ingresosCitas + ingresosManuales

  // Gastos reales (excluye entradas de tipo INGRESO)
  const gastosReales      = gastos.filter(g => !g.descripcion?.startsWith('[INGRESO]')).reduce((a, g) => a + g.valor, 0)
  const ganancia          = totalIngresos - gastosReales

  // Comisiones pagadas a especialistas en el período
  const totalComisiones   = pagos.reduce((a, p) => a + p.valor_pagado, 0)

  // Clientes únicos atendidos
  const clientesSet       = new Set(citasCompletadas.map(c => (c.cliente as { id?: string } | null)?.id).filter(Boolean))
  const clientesAtendidos = clientesSet.size

  // Servicios top
  const svcMap: Record<string, { nombre: string; cantidad: number; total: number }> = {}
  citasCompletadas.forEach(c => {
    const srv = c.servicio as { id?: string; nombre?: string } | null
    const id  = srv?.id ?? 'sin-servicio'
    const nom = srv?.nombre ?? 'Sin servicio'
    if (!svcMap[id]) svcMap[id] = { nombre: nom, cantidad: 0, total: 0 }
    svcMap[id].cantidad++
    svcMap[id].total += c.valor_final ?? 0
  })
  const serviciosTop = Object.values(svcMap).sort((a, b) => b.total - a.total).slice(0, 10)

  // Métodos de pago (citas)
  const metodoMap: Record<string, number> = {}
  citasCompletadas.forEach(c => {
    const m = (c as { metodo_pago?: string }).metodo_pago ?? 'No especificado'
    metodoMap[m] = (metodoMap[m] ?? 0) + (c.valor_final ?? 0)
  })
  const metodosPago = Object.entries(metodoMap)
    .map(([metodo, total]) => ({ metodo, total }))
    .sort((a, b) => b.total - a.total)

  // Comisiones por especialista (de citas completadas)
  const espMap: Record<string, { nombre: string; citas: number; total: number; pagado: number }> = {}
  citasCompletadas.forEach(c => {
    const esp = c.especialista as { id?: string; nombre?: string } | null
    const id  = esp?.id ?? 'sin-especialista'
    const nom = esp?.nombre ?? '—'
    if (!espMap[id]) espMap[id] = { nombre: nom, citas: 0, total: 0, pagado: 0 }
    espMap[id].citas++
    espMap[id].total += c.valor_final ?? 0
  })
  pagos.forEach(p => {
    if (p.especialista_id && espMap[p.especialista_id]) {
      espMap[p.especialista_id].pagado += p.valor_pagado
    }
  })
  const comisionesPorEspecialista = Object.values(espMap).sort((a, b) => b.total - a.total)

  // Gastos por categoría
  const catMap: Record<string, number> = {}
  gastos.filter(g => !g.descripcion?.startsWith('[INGRESO]')).forEach(g => {
    catMap[g.categoria] = (catMap[g.categoria] ?? 0) + g.valor
  })
  const gastosPorCategoria = Object.entries(catMap)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)

  // Promedio diario (solo días con actividad o dividido por días del rango)
  const diasRango = Math.max(1,
    Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1
  )
  const promedioDiario = totalIngresos / diasRango

  // Serie temporal para gráfica (agrupado por día)
  const serieMap: Record<string, { ingresos: number; gastos: number; citas: number }> = {}
  citasCompletadas.forEach(c => {
    const d = c.fecha_inicio.slice(0, 10)
    if (!serieMap[d]) serieMap[d] = { ingresos: 0, gastos: 0, citas: 0 }
    serieMap[d].ingresos += c.valor_final ?? 0
    serieMap[d].citas++
  })
  gastos.forEach(g => {
    const d = g.fecha
    if (!serieMap[d]) serieMap[d] = { ingresos: 0, gastos: 0, citas: 0 }
    if (g.descripcion?.startsWith('[INGRESO]')) serieMap[d].ingresos += g.valor
    else serieMap[d].gastos += g.valor
  })
  const serieTemporal = Object.entries(serieMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }))

  return NextResponse.json({
    // Resumen
    totalIngresos,
    gastosReales,
    ganancia,
    totalCitas:        citas.length,
    citasCompletadas:  citasCompletadas.length,
    citasCanceladas:   citasCanceladas.length,
    clientesAtendidos,
    totalComisiones,
    promedioDiario,
    diasRango,
    // Detalles
    serviciosTop,
    metodosPago,
    comisionesPorEspecialista,
    gastosPorCategoria,
    serieTemporal,
    // Raw para exportación
    citas:  citasCompletadas.map(c => ({
      id:           c.id,
      fecha:        c.fecha_inicio,
      cliente:      (c.cliente as { nombre?: string } | null)?.nombre ?? '—',
      especialista: (c.especialista as { nombre?: string } | null)?.nombre ?? '—',
      servicio:     (c.servicio as { nombre?: string } | null)?.nombre ?? '—',
      valor:        c.valor_final ?? 0,
      metodo_pago:  (c as { metodo_pago?: string }).metodo_pago ?? '—',
      canal:        (c as { canal?: string }).canal ?? '—',
    })),
    gastosDetalle: gastos.filter(g => !g.descripcion?.startsWith('[INGRESO]')).map(g => ({
      id: g.id, fecha: g.fecha, categoria: g.categoria,
      descripcion: g.descripcion, valor: g.valor,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
