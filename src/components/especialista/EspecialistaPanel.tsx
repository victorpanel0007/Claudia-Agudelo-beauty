'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { formatTime, formatDate, formatCurrency } from '@/lib/utils'
import type { Cita } from '@/types/database'
import { LogOut, Clock, Calendar, CheckCircle, Phone, RefreshCw } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

const STATUS = {
  confirmada:  { label: 'Confirmada',  cls: 'bg-green-100 text-green-700 border-green-200' },
  pendiente:   { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_proceso:  { label: 'En proceso',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  completada:  { label: 'Completada',  cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  cancelada:   { label: 'Cancelada',   cls: 'bg-red-100 text-red-700 border-red-200' },
}

function dayLabel(fechaKey: string) {
  // fechaKey es YYYY-MM-DD en Colombia
  const d = new Date(`${fechaKey}T12:00:00-05:00`)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const manana = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if (fechaKey === hoy) return 'Hoy'
  if (fechaKey === manana) return 'Mañana'
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

export default function EspecialistaPanel({ userEmail, userName }: { userEmail: string; userName: string }) {
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const loadCitas = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    // Buscar el especialista por nombre (usando email o nombre del metadata)
    const { data: especialistas } = await supabase
      .from('especialistas')
      .select('id, nombre')
      .eq('activo', true)

    // Intentar encontrar el especialista que corresponde a este usuario
    // Matching por nombre en metadata o por posición
    const nombre = userName || userEmail.split('@')[0]
    const esp = especialistas?.find(e =>
      e.nombre.toLowerCase().includes(nombre.toLowerCase()) ||
      nombre.toLowerCase().includes(e.nombre.toLowerCase())
    ) || especialistas?.[0]

    if (!esp) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    // Citas confirmadas y pendientes desde hoy en Colombia (UTC-5)
    const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const hoy = new Date(`${hoyStr}T00:00:00-05:00`)

    const { data } = await supabase
      .from('citas')
      .select(`
        *,
        cliente:clientes(nombre, telefono),
        servicio:servicios(nombre, duracion_minutos, precio, precio_desde, tipo_precio),
        especialista:especialistas(nombre)
      `)
      .eq('especialista_id', esp.id)
      .in('estado', ['confirmada', 'pendiente', 'en_proceso'])
      .gte('fecha_inicio', hoy.toISOString())
      .order('fecha_inicio', { ascending: true })

    setCitas((data as Cita[]) || [])
    setLoading(false)
    setRefreshing(false)
  }, [supabase, userName, userEmail])

  useEffect(() => {
    loadCitas()
    // Realtime
    const ch = supabase.channel('esp-citas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadCitas(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadCitas, supabase])

  async function marcarEnProceso(id: string) {
    await supabase.from('citas').update({ estado: 'en_proceso' }).eq('id', id)
    toast.success('Cita marcada como en proceso')
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

  // Agrupar citas por día en Colombia
  const grupos: Record<string, Cita[]> = {}
  citas.forEach(c => {
    const key = new Date(c.fecha_inicio).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(c)
  })

  const citasHoy = citas.filter(c => {
    const d = new Date(c.fecha_inicio)
    const hoy = new Date()
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) ===
           hoy.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  })

  return (
    <div className="min-h-screen bg-beauty-bg">
      {/* Header */}
      <header className="bg-white border-b border-beauty-primary/20 px-4 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-beauty-primary/30">
              <Image
                src="/WhatsApp Image 2026-06-18 at 8.53.37 PM_1254x1254.png"
                alt="Logo" width={40} height={40} className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-semibold text-beauty-text-dark text-sm">
                {userName || userEmail.split('@')[0]}
              </p>
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

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 gap-3 mb-6">
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

        {/* Lista de citas agrupadas por día */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-beauty-primary/20 p-4 animate-pulse h-28" />
            ))}
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
                {/* Encabezado del día */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${
                    isToday(parseISO(fecha + 'T00:00:00'))
                      ? 'bg-beauty-primary text-white'
                      : 'bg-beauty-secondary/20 text-beauty-secondary'
                  }`}>
                    {dayLabel(fecha)}
                  </span>
                  <span className="text-xs text-beauty-text-muted">{citasDia.length} cita{citasDia.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Citas del día */}
                <div className="space-y-3">
                  {citasDia.map(cita => {
                    const st = STATUS[cita.estado as keyof typeof STATUS] || STATUS.pendiente
                    return (
                      <div key={cita.id}
                        className="bg-white rounded-2xl border border-beauty-primary/20 p-4 shadow-sm hover:shadow-card transition-all">

                        {/* Fila superior: hora + estado */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="bg-beauty-primary/10 rounded-xl px-3 py-1.5">
                              <p className="font-bold text-beauty-primary text-sm">{formatTime(cita.fecha_inicio)}</p>
                            </div>
                            <span className="text-beauty-text-muted text-xs">→ {formatTime(cita.fecha_fin)}</span>
                          </div>
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>
                            {st.label}
                          </span>
                        </div>

                        {/* Cliente y servicio */}
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
                          {/* WhatsApp directo */}
                          {cita.cliente?.telefono && (
                            <a href={`https://wa.me/57${cita.cliente.telefono}?text=Hola%20${encodeURIComponent(cita.cliente.nombre || '')}%2C%20te%20recuerdo%20tu%20cita`}
                              target="_blank" rel="noopener noreferrer"
                              className="w-9 h-9 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors shrink-0">
                              <Phone size={14} className="text-green-600" />
                            </a>
                          )}
                        </div>

                        {/* Observaciones */}
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
                            <button onClick={() => marcarCompletada(cita.id)}
                              className="flex-1 text-xs font-semibold py-2 rounded-xl bg-beauty-primary text-white hover:bg-beauty-primary-dark transition-colors flex items-center justify-center gap-1">
                              <CheckCircle size={13} /> Completar
                            </button>
                          </div>
                        )}
                        {cita.estado === 'en_proceso' && (
                          <div className="mt-3 pt-3 border-t border-beauty-primary/10">
                            <button onClick={() => marcarCompletada(cita.id)}
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
    </div>
  )
}
