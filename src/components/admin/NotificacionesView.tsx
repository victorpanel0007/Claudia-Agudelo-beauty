'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, RefreshCw, Send, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

interface Notificacion {
  id: string
  created_at: string
  especialista_nombre: string
  whatsapp_destino: string
  estado: 'enviado' | 'error' | 'pendiente'
  tipo: string
  mensaje: string
  codigo_respuesta?: number
  error_detalle?: string
  cita_id?: string
  cita?: { id: string; cliente?: { nombre?: string; telefono?: string } }
}

interface Especialista { id: string; nombre: string }

const ESTADO_CONFIG = {
  enviado:  { label: 'Enviado',  cls: 'bg-green-100 text-green-700',  icon: CheckCircle },
  error:    { label: 'Error',    cls: 'bg-red-100 text-red-600',      icon: XCircle },
  pendiente:{ label: 'Pendiente',cls: 'bg-amber-100 text-amber-700',  icon: Clock },
}

export default function NotificacionesView() {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)
  const [selected, setSelected] = useState<Notificacion | null>(null)
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroEsp, setFiltroEsp] = useState('')
  const [buscar, setBuscar] = useState('')

  // Stats
  const total    = notifs.length
  const enviados = notifs.filter(n => n.estado === 'enviado').length
  const errores  = notifs.filter(n => n.estado === 'error').length
  const pend     = notifs.filter(n => n.estado === 'pendiente').length

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroEstado) params.set('estado', filtroEstado)
    if (filtroEsp)    params.set('especialista_id', filtroEsp)
    if (buscar)       params.set('buscar', buscar)

    const res = await fetch(`/api/notificaciones?${params}`)
    const data = await res.json()
    setNotifs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filtroEstado, filtroEsp, buscar])

  useEffect(() => {
    supabase.from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setEspecialistas((data as Especialista[]) || []))
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function reenviar(id: string) {
    setResending(id)
    const res = await fetch('/api/notificaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const { ok } = await res.json()
    if (ok) toast.success('✅ Notificación reenviada')
    else    toast.error('❌ No se pudo reenviar')
    setResending(null)
    loadData()
  }

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-text flex items-center gap-2">
            <Bell size={22} className="text-beauty-borgona" /> Notificaciones
          </h2>
          <p className="text-gray-500 text-sm">Historial de mensajes enviados a especialistas</p>
        </div>
        <button onClick={loadData} className="p-2 hover:bg-beauty-rosa-claro rounded-xl transition-colors">
          <RefreshCw size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: total,    color: 'bg-blue-50 text-blue-600' },
          { label: 'Enviadas',  value: enviados,  color: 'bg-green-50 text-green-600' },
          { label: 'Errores',   value: errores,   color: 'bg-red-50 text-red-600' },
          { label: 'Pendientes',value: pend,      color: 'bg-amber-50 text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-beauty-primary/20 rounded-2xl p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-beauty-primary/20 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-gray-400">
            <Filter size={16} /> <span className="text-xs font-medium">Filtrar:</span>
          </div>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-beauty-primary">
            <option value="">Todos los estados</option>
            <option value="enviado">Enviado</option>
            <option value="error">Error</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select value={filtroEsp} onChange={e => setFiltroEsp(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-beauty-primary">
            <option value="">Todas las especialistas</option>
            {especialistas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={buscar} onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por especialista o número..."
              className="w-full text-xs border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-beauty-primary" />
          </div>
          {(filtroEstado || filtroEsp || buscar) && (
            <button onClick={() => { setFiltroEstado(''); setFiltroEsp(''); setBuscar('') }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla + Detalle */}
      <div className="flex gap-4">
        {/* Tabla */}
        <div className="flex-1 bg-white border border-beauty-primary/20 rounded-2xl shadow-sm overflow-hidden min-w-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Cargando...</div>
            ) : notifs.length === 0 ? (
              <div className="p-10 text-center">
                <Bell size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-beauty-bg">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs">Fecha</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs">Especialista</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs">WhatsApp</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs">Cliente</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {notifs.map(n => {
                    const st = ESTADO_CONFIG[n.estado] || ESTADO_CONFIG.pendiente
                    const isSelected = selected?.id === n.id
                    return (
                      <tr key={n.id}
                        onClick={() => setSelected(isSelected ? null : n)}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-beauty-rosa-claro' : 'hover:bg-beauty-bg'
                        }`}>
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{fmt(n.created_at)}</td>
                        <td className="py-3 px-4 font-medium text-beauty-text text-sm">{n.especialista_nombre}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{n.whatsapp_destino}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {(n.cita as { cliente?: { nombre?: string } } | null)?.cliente?.nombre || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>
                            <st.icon size={11} /> {st.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {n.estado === 'error' && (
                              <button
                                onClick={e => { e.stopPropagation(); reenviar(n.id) }}
                                disabled={resending === n.id}
                                className="flex items-center gap-1 text-xs bg-beauty-primary text-white px-2.5 py-1.5 rounded-lg hover:bg-beauty-primary-dark transition-colors disabled:opacity-50"
                              >
                                {resending === n.id
                                  ? <RefreshCw size={11} className="animate-spin" />
                                  : <Send size={11} />
                                }
                                Reenviar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel detalle */}
        {selected && (
          <div className="w-80 shrink-0 bg-white border border-beauty-primary/20 rounded-2xl shadow-sm p-4 space-y-4 overflow-y-auto max-h-[600px]">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-beauty-text text-sm">Detalle</p>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="bg-beauty-bg rounded-xl p-3 space-y-1.5">
                <p><span className="text-gray-400">Especialista:</span> <span className="font-medium">{selected.especialista_nombre}</span></p>
                <p><span className="text-gray-400">WhatsApp:</span> {selected.whatsapp_destino}</p>
                <p><span className="text-gray-400">Tipo:</span> {selected.tipo}</p>
                <p><span className="text-gray-400">Fecha:</span> {fmt(selected.created_at)}</p>
                <p><span className="text-gray-400">Código:</span> {selected.codigo_respuesta || '—'}</p>
                {selected.error_detalle && (
                  <p className="text-red-500"><span className="text-gray-400">Error:</span> {selected.error_detalle}</p>
                )}
              </div>
              <div>
                <p className="text-gray-400 mb-1 font-medium">Mensaje enviado:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {selected.mensaje}
                </pre>
              </div>
              {selected.estado === 'error' && (
                <button onClick={() => reenviar(selected.id)} disabled={resending === selected.id}
                  className="w-full flex items-center justify-center gap-2 bg-beauty-primary text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-beauty-primary-dark transition-colors disabled:opacity-50">
                  {resending === selected.id ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  Reenviar notificación
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
