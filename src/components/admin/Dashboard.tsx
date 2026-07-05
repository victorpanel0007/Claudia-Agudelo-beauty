'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { formatCurrency, formatTime } from '@/lib/utils'
import type { Cita } from '@/types/database'
import Link from 'next/link'

interface Stats {
  citasHoy: number
  citasPendientes: number
  clientesTotal: number
  ingresosMes: number
}

function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    confirmada: { label: 'Confirmada', icon: <CheckCircle size={12} />, cls: 'badge-confirmada' },
    completada: { label: 'Completada', icon: <CheckCircle size={12} />, cls: 'badge-completada' },
    cancelada:  { label: 'Cancelada',  icon: <XCircle size={12} />,    cls: 'badge-cancelada' },
    pendiente:  { label: 'Pendiente',  icon: <AlertCircle size={12} />, cls: 'badge-pendiente' },
    en_proceso: { label: 'En proceso', icon: <Clock size={12} />,      cls: 'badge-en_proceso' },
  }
  const s = map[estado] || map.pendiente
  return <span className={`${s.cls} flex items-center gap-1`}>{s.icon} {s.label}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ citasHoy: 0, citasPendientes: 0, clientesTotal: 0, ingresosMes: 0 })
  const [citasHoy, setCitasHoy] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()

    // Realtime subscription
    const channel = supabase
      .channel('citas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadData() {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const today    = new Date(`${todayStr}T00:00:00-05:00`)
    const todayEnd = new Date(`${todayStr}T23:59:59-05:00`)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const [citasHoyRes, pendientesRes, clientesRes, ingresosRes] = await Promise.all([
      supabase
        .from('citas')
        .select(`*, cliente:clientes(nombre), especialista:especialistas(nombre), servicio:servicios(nombre)`)
        .gte('fecha_inicio', today.toISOString())
        .lte('fecha_inicio', todayEnd.toISOString())
        .order('fecha_inicio'),
      supabase
        .from('citas')
        .select('id', { count: 'exact' })
        .eq('estado', 'confirmada'),
      supabase
        .from('clientes')
        .select('id', { count: 'exact' }),
      supabase
        .from('citas')
        .select('valor_final')
        .gte('fecha_inicio', monthStart.toISOString())
        .lte('fecha_inicio', monthEnd.toISOString())
        .eq('estado', 'completada'),
    ])

    const ingresos = (ingresosRes.data || []).reduce((sum, c) => sum + (c.valor_final || 0), 0)

    setStats({
      citasHoy: citasHoyRes.data?.length || 0,
      citasPendientes: pendientesRes.count || 0,
      clientesTotal: clientesRes.count || 0,
      ingresosMes: ingresos,
    })
    setCitasHoy((citasHoyRes.data as Cita[]) || [])
    setLoading(false)
  }

  const statCards = [
    { label: 'Citas Hoy', value: stats.citasHoy, icon: Calendar, color: 'text-blue-600 bg-blue-100' },
    { label: 'Confirmadas', value: stats.citasPendientes, icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    { label: 'Clientes', value: stats.clientesTotal, icon: Users, color: 'text-purple-600 bg-purple-100' },
    { label: 'Ingresos del Mes', value: formatCurrency(stats.ingresosMes), icon: TrendingUp, color: 'text-beauty-secondary bg-beauty-rosa-claro' },
  ]


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-beauty-text">Dashboard</h2>
        <p className="text-gray-500 text-sm">Resumen del día</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="beauty-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold text-beauty-text">{loading ? '—' : card.value}</p>
            <p className="text-gray-500 text-xs mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Today's appointments */}
      <div className="beauty-card">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-beauty-text">Citas de Hoy</h3>
          <Link href="/admin/agenda" className="text-beauty-secondary text-sm hover:underline">
            Ver agenda →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : citasHoy.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">No hay citas programadas para hoy</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {citasHoy.map(cita => (
              <div key={cita.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                {/* Time */}
                <div className="text-center min-w-[52px] shrink-0">
                  <p className="font-bold text-beauty-text text-sm">{formatTime(cita.fecha_inicio)}</p>
                  <p className="text-gray-400 text-xs">{formatTime(cita.fecha_fin)}</p>
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-beauty-rosa-claro flex items-center justify-center shrink-0">
                  <span className="text-beauty-secondary font-bold text-sm">
                    {(cita.cliente?.nombre || 'C').charAt(0)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-beauty-text text-sm truncate">
                    {cita.cliente?.nombre || 'Cliente'}
                  </p>
                  <p className="text-gray-500 text-xs truncate">
                    {cita.servicio?.nombre} • {cita.especialista?.nombre}
                  </p>
                </div>

                <div className="shrink-0">
                  <StatusBadge estado={cita.estado} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
