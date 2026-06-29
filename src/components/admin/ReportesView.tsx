'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Users, Scissors, Award } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ReportData {
  ventasDiarias: number
  ventasSemanales: number
  ventasMensuales: number
  citasCompletadas: number
  serviciosMasVendidos: { nombre: string; count: number }[]
  especialistaTopCitas: { nombre: string; count: number }[]
  clientesFrecuentes: { nombre: string; telefono: string; count: number }[]
}

export default function ReportesView() {
  const [data, setData] = useState<ReportData>({
    ventasDiarias: 0,
    ventasSemanales: 0,
    ventasMensuales: 0,
    citasCompletadas: 0,
    serviciosMasVendidos: [],
    especialistaTopCitas: [],
    clientesFrecuentes: [],
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    const todayStr    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const dayStart    = new Date(`${todayStr}T00:00:00-05:00`)
    const weekAgo     = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart  = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1)

    const [daily, weekly, monthly, services, specialists, clients] = await Promise.all([
      supabase.from('citas').select('valor_final').gte('fecha_inicio', dayStart.toISOString()).eq('estado', 'completada'),
      supabase.from('citas').select('valor_final').gte('fecha_inicio', weekAgo.toISOString()).eq('estado', 'completada'),
      supabase.from('citas').select('valor_final').gte('fecha_inicio', monthStart.toISOString()).eq('estado', 'completada'),
      supabase.from('citas').select('servicio:servicios(nombre)').eq('estado', 'completada').limit(200),
      supabase.from('citas').select('especialista:especialistas(nombre)').eq('estado', 'completada').limit(200),
      supabase.from('citas').select('cliente:clientes(nombre, telefono)').eq('estado', 'completada').limit(200),
    ])

    const sumValues = (arr: { valor_final: number | null }[]) =>
      arr.reduce((s, c) => s + (c.valor_final || 0), 0)

    // Count services
    const servCount: Record<string, number> = {}
    for (const c of services.data || []) {
      const name = (c.servicio as unknown as { nombre: string })?.nombre
      if (name) servCount[name] = (servCount[name] || 0) + 1
    }
    const topServices = Object.entries(servCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, count]) => ({ nombre, count }))

    // Count specialists
    const espCount: Record<string, number> = {}
    for (const c of specialists.data || []) {
      const name = (c.especialista as unknown as { nombre: string })?.nombre
      if (name) espCount[name] = (espCount[name] || 0) + 1
    }
    const topEsp = Object.entries(espCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, count]) => ({ nombre, count }))

    // Count clients
    const clientCount: Record<string, { nombre: string; telefono: string; count: number }> = {}
    for (const c of clients.data || []) {
      const cl = c.cliente as unknown as { nombre: string; telefono: string }
      if (cl?.nombre) {
        clientCount[cl.nombre] = clientCount[cl.nombre]
          ? { ...clientCount[cl.nombre], count: clientCount[cl.nombre].count + 1 }
          : { nombre: cl.nombre, telefono: cl.telefono, count: 1 }
      }
    }
    const topClients = Object.values(clientCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    setData({
      ventasDiarias: sumValues(daily.data || []),
      ventasSemanales: sumValues(weekly.data || []),
      ventasMensuales: sumValues(monthly.data || []),
      citasCompletadas: monthly.data?.length || 0,
      serviciosMasVendidos: topServices,
      especialistaTopCitas: topEsp,
      clientesFrecuentes: topClients,
    })
    setLoading(false)
  }

  const ventas = [
    { label: 'Ventas hoy', value: data.ventasDiarias, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
    { label: 'Ventas semana', value: data.ventasSemanales, icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
    { label: 'Ventas mes', value: data.ventasMensuales, icon: TrendingUp, color: 'text-beauty-secondary bg-beauty-rosa-claro' },
    { label: 'Citas completadas (mes)', value: `${data.citasCompletadas}`, icon: Award, color: 'text-purple-600 bg-purple-100' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-beauty-text">Reportes</h2>
        <p className="text-gray-500 text-sm">Análisis y estadísticas del negocio</p>
      </div>

      {/* Ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ventas.map(v => (
          <div key={v.label} className="beauty-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${v.color}`}>
              <v.icon size={20} />
            </div>
            <p className="text-xl font-bold text-beauty-text">
              {loading ? '—' : typeof v.value === 'number' ? formatCurrency(v.value) : v.value}
            </p>
            <p className="text-gray-400 text-xs mt-1">{v.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Servicios más vendidos */}
        <div className="beauty-card">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Scissors size={18} className="text-beauty-secondary" />
              <h3 className="font-semibold text-beauty-text text-sm">Servicios más vendidos</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {data.serviciosMasVendidos.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
            ) : data.serviciosMasVendidos.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-beauty-secondary font-bold text-sm w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-beauty-text text-sm truncate">{s.nombre}</p>
                  <div className="mt-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-beauty-secondary h-1.5 rounded-full"
                      style={{ width: `${(s.count / (data.serviciosMasVendidos[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-400 text-xs shrink-0">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Especialistas */}
        <div className="beauty-card">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-beauty-secondary" />
              <h3 className="font-semibold text-beauty-text text-sm">Especialista top</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {data.especialistaTopCitas.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
            ) : data.especialistaTopCitas.map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-beauty-rosa-claro flex items-center justify-center">
                  <span className="text-beauty-secondary font-bold text-xs">{e.nombre.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-beauty-text text-sm">{e.nombre}</p>
                </div>
                <span className="bg-beauty-secondary/20 text-beauty-secondary-dark text-xs font-medium px-2 py-0.5 rounded-full">
                  {e.count} citas
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Clientes frecuentes */}
        <div className="beauty-card">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-beauty-secondary" />
              <h3 className="font-semibold text-beauty-text text-sm">Clientes frecuentes</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {data.clientesFrecuentes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
            ) : data.clientesFrecuentes.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-beauty-rosa-claro flex items-center justify-center">
                  <span className="text-beauty-secondary font-bold text-xs">{c.nombre.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-beauty-text text-sm truncate">{c.nombre}</p>
                  <p className="text-gray-400 text-xs">{c.telefono}</p>
                </div>
                <span className="bg-beauty-secondary/20 text-beauty-secondary-dark text-xs font-medium px-2 py-0.5 rounded-full">
                  {c.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
