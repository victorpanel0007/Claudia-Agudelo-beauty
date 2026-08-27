'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'
import { Search, User, Phone, Calendar, TrendingUp, Edit, Save, X } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// Cliente enriquecido con estadísticas reales desde citas
interface ClienteConStats extends Cliente {
  citas_reales:   number
  gastado_real:   number
  ultima_visita_real: string | null
}

export default function ClientesView() {
  const [clientes, setClientes]       = useState<ClienteConStats[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<ClienteConStats | null>(null)
  const [editando, setEditando]       = useState(false)
  const [editNombre, setEditNombre]   = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [saving, setSaving]           = useState(false)
  const supabase = createClient()

  const loadClientes = useCallback(async () => {
    // Carga clientes + estadísticas reales desde citas completadas
    const [{ data: clientesData }, { data: citasData }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre', { ascending: true }),
      supabase.from('citas')
        .select('cliente_id, valor_final, estado, fecha_inicio')
        .eq('estado', 'completada'),
    ])

    const clientes = (clientesData || []) as Cliente[]
    const citas    = citasData || []

    // Calcular estadísticas por cliente desde citas reales
    const statsMap: Record<string, { citas: number; gastado: number; ultima: string | null }> = {}
    for (const cita of citas) {
      if (!cita.cliente_id) continue
      if (!statsMap[cita.cliente_id]) {
        statsMap[cita.cliente_id] = { citas: 0, gastado: 0, ultima: null }
      }
      statsMap[cita.cliente_id].citas++
      statsMap[cita.cliente_id].gastado += cita.valor_final ?? 0
      const fecha = cita.fecha_inicio as string
      if (!statsMap[cita.cliente_id].ultima || fecha > statsMap[cita.cliente_id].ultima!) {
        statsMap[cita.cliente_id].ultima = fecha
      }
    }

    const enriquecidos: ClienteConStats[] = clientes.map(c => ({
      ...c,
      citas_reales:       statsMap[c.id]?.citas   ?? 0,
      gastado_real:       statsMap[c.id]?.gastado ?? 0,
      ultima_visita_real: statsMap[c.id]?.ultima  ?? null,
    }))

    setClientes(enriquecidos)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadClientes()
  }, [loadClientes])

  // Actualizar el selected si los datos recargaron
  useEffect(() => {
    if (!selected) return
    const actualizado = clientes.find(c => c.id === selected.id)
    if (actualizado) setSelected(actualizado)
  }, [clientes]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirEdicion() {
    if (!selected) return
    setEditNombre(selected.nombre)
    setEditTelefono(selected.telefono)
    setEditando(true)
  }

  function cancelarEdicion() {
    setEditando(false)
    setEditNombre('')
    setEditTelefono('')
  }

  async function guardarEdicion() {
    if (!selected) return
    if (!editNombre.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          nombre: editNombre.trim(),
          telefono: editTelefono.trim(),
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error ?? 'Error al guardar')
      }
      toast.success('✅ Cliente actualizado')
      setEditando(false)
      await loadClientes()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono.includes(search)
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-beauty-text">Clientes</h2>
        <p className="text-gray-500 text-sm">Gestión de clientas registradas</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="input-beauty pl-9"
        />
      </div>

      {/* List */}
      <div className="beauty-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <User size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">
              {search ? 'No se encontraron resultados' : 'No hay clientes registrados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(cliente => (
              <button
                key={cliente.id}
                onClick={() => { setSelected(cliente); setEditando(false) }}
                className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left min-h-[60px]"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-beauty-rosa-claro flex items-center justify-center shrink-0">
                  <span className="text-beauty-secondary font-bold text-sm">
                    {getInitials(cliente.nombre)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-beauty-text text-sm truncate">{cliente.nombre}</p>
                  <p className="text-gray-400 text-xs">{cliente.telefono}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-beauty-secondary font-semibold text-sm">
                    {formatCurrency(cliente.gastado_real)}
                  </p>
                  <p className="text-gray-400 text-xs">{cliente.citas_reales} citas</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle / edición cliente */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); cancelarEdicion() }}
      >
        {selected && (
          <>
            <Modal.Header
              title={editando ? 'Editar cliente' : selected.nombre}
              subtitle={editando ? undefined : selected.telefono}
              onClose={() => { setSelected(null); cancelarEdicion() }}
            />

            {/* ── Modo edición ── */}
            {editando ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-beauty-primary"
                    placeholder="Nombre completo"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={editTelefono}
                    onChange={e => setEditTelefono(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-beauty-primary"
                    placeholder="Ej: 3001234567"
                  />
                </div>
              </div>
            ) : (
              /* ── Modo vista ── */
              <div className="p-4 sm:p-5 grid grid-cols-2 gap-3">
                {[
                  { icon: <Calendar size={14} />, label: 'Registro',      val: formatDate(selected.fecha_registro) },
                  { icon: <TrendingUp size={14} />, label: 'Total gastado', val: formatCurrency(selected.gastado_real) },
                  { icon: <Phone size={14} />,    label: 'Total citas',   val: String(selected.citas_reales) },
                  ...(selected.ultima_visita_real ? [{
                    icon: <Calendar size={14} />,
                    label: 'Última visita',
                    val: formatDate(selected.ultima_visita_real),
                  }] : []),
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1 text-beauty-secondary">
                      {item.icon}
                      <p className="text-gray-400 text-xs">{item.label}</p>
                    </div>
                    <p className="font-semibold text-beauty-text text-sm">{item.val}</p>
                  </div>
                ))}
              </div>
            )}

            <Modal.Footer>
              {editando ? (
                <div className="flex gap-3">
                  <button
                    onClick={cancelarEdicion}
                    className="flex-1 border-2 border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={15} /> Cancelar
                  </button>
                  <button
                    onClick={guardarEdicion}
                    disabled={saving}
                    className="flex-1 btn-beauty justify-center py-3 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? 'Guardando...' : <><Save size={15} /> Guardar</>}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <a
                    href={`https://wa.me/57${selected.telefono}?text=Hola ${selected.nombre}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-semibold text-center hover:bg-green-600 transition-colors flex items-center justify-center gap-1.5 min-h-[48px]"
                  >
                    💬 WhatsApp
                  </a>
                  <button
                    onClick={abrirEdicion}
                    className="flex-1 border-2 border-beauty-primary/40 text-beauty-primary py-3 rounded-xl text-sm font-semibold hover:bg-beauty-rosa-claro transition-colors flex items-center justify-center gap-1.5 min-h-[48px]"
                  >
                    <Edit size={15} /> Editar
                  </button>
                  <button
                    onClick={() => { setSelected(null) }}
                    className="flex-1 btn-beauty justify-center py-3 min-h-[48px]"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  )
}
