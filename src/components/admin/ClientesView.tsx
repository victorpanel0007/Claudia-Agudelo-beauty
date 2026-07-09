'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'
import { Search, User, Phone, Calendar, TrendingUp, Trash2, Edit, Save, X, Check } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ClienteStat extends Cliente {
  _citas_count: number
  _total_gastado: number
  _ultima_visita: string | null
}

export default function ClientesView() {
  const [clientes, setClientes] = useState<ClienteStat[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<ClienteStat | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({ nombre: '', telefono: '' })
  const [saving, setSaving]     = useState(false)
  const supabase = createClient()

  const loadClientes = useCallback(async () => {
    // Cargar clientes junto con sus citas para calcular stats reales
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('*')
      .order('fecha_registro', { ascending: false })

    if (!clientesData) { setLoading(false); return }

    // Calcular stats desde citas completadas
    const { data: citasData } = await supabase
      .from('citas')
      .select('cliente_id, valor_final, fecha_inicio, estado')
      .in('estado', ['completada'])

    const statsMap: Record<string, { count: number; total: number; ultima: string | null }> = {}
    for (const c of citasData ?? []) {
      if (!statsMap[c.cliente_id]) statsMap[c.cliente_id] = { count: 0, total: 0, ultima: null }
      statsMap[c.cliente_id].count++
      statsMap[c.cliente_id].total += c.valor_final ?? 0
      const fi = c.fecha_inicio
      if (!statsMap[c.cliente_id].ultima || fi > statsMap[c.cliente_id].ultima!) {
        statsMap[c.cliente_id].ultima = fi
      }
    }

    const enriched = clientesData.map(cl => ({
      ...cl,
      _citas_count:   statsMap[cl.id]?.count  ?? 0,
      _total_gastado: statsMap[cl.id]?.total  ?? 0,
      _ultima_visita: statsMap[cl.id]?.ultima ?? null,
    })) as ClienteStat[]

    setClientes(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadClientes() }, [loadClientes])

  function openEdit(c: ClienteStat) {
    setEditForm({ nombre: c.nombre, telefono: c.telefono })
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    if (!editForm.nombre.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    const res = await fetch('/api/clientes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, nombre: editForm.nombre.trim(), telefono: editForm.telefono.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(`Error: ${json.error}`); setSaving(false); return }
    toast.success('Cliente actualizado ✓')
    setSaving(false)
    setEditing(false)
    const updated = { ...selected, nombre: editForm.nombre.trim(), telefono: editForm.telefono.trim() }
    setSelected(updated)
    loadClientes()
  }

  async function deleteCliente(cliente: ClienteStat) {
    if (!confirm(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const res = await fetch(`/api/clientes?id=${cliente.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar cliente') }
    else { toast.success('Cliente eliminado'); setSelected(null); loadClientes() }
    setDeleting(false)
  }

  function formatTel(t: string) {
    const d = t.replace(/\D/g, '')
    return d.startsWith('57') && d.length === 12 ? d.slice(2) : t
  }

  function waLink(t: string, nombre: string) {
    const d = t.replace(/\D/g, '')
    const num = d.startsWith('57') ? d : `57${d}`
    return `https://wa.me/${num}?text=Hola ${encodeURIComponent(nombre)}`
  }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono.includes(search)
  )

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#EFA1B5] focus:ring-2 focus:ring-[#EFA1B5]/20'

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-beauty-text">Clientes</h2>
        <p className="text-gray-500 text-sm">{clientes.length} clientes registradas</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="input-beauty pl-10" />
      </div>

      {/* List */}
      <div className="beauty-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <User size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">{search ? 'Sin resultados' : 'No hay clientes registrados'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(cliente => (
              <button key={cliente.id} onClick={() => { setSelected(cliente); setEditing(false) }}
                className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left min-h-[60px]">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-beauty-rosa-claro flex items-center justify-center shrink-0">
                  <span className="text-beauty-secondary font-bold text-sm">{getInitials(cliente.nombre)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-beauty-text text-sm truncate">{cliente.nombre}</p>
                  <p className="text-gray-400 text-xs">{formatTel(cliente.telefono)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-beauty-secondary font-semibold text-sm">{formatCurrency(cliente._total_gastado)}</p>
                  <p className="text-gray-400 text-xs">{cliente._citas_count} citas</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {selected && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slide-up">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="p-5 border-b border-gray-100">
              {editing ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Editar cliente</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input value={editForm.nombre} onChange={e => setEditForm(f=>({...f,nombre:e.target.value}))} className={inp} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Teléfono / WhatsApp</label>
                    <input value={editForm.telefono} onChange={e => setEditForm(f=>({...f,telefono:e.target.value}))} className={inp} placeholder="3001234567" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-[#EFA1B5] text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                      {saving ? 'Guardando...' : <><Check size={14} /> Guardar</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-beauty-secondary flex items-center justify-center shrink-0">
                    <span className="text-beauty-text font-bold text-xl">{getInitials(selected.nombre)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-beauty-text text-base truncate">{selected.nombre}</h3>
                    <p className="text-gray-500 text-sm">{formatTel(selected.telefono)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(selected)}
                      className="p-2 hover:bg-[#FAD6E0] rounded-xl transition-colors" title="Editar">
                      <Edit size={15} className="text-[#8B1E3F]" />
                    </button>
                    <button onClick={() => setSelected(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!editing && (
              <>
                <div className="p-4 sm:p-5 grid grid-cols-2 gap-3">
                  {[
                    { icon: <Calendar size={14}/>, label: 'Registro',      val: formatDate(selected.fecha_registro) },
                    { icon: <TrendingUp size={14}/>, label: 'Total gastado', val: formatCurrency(selected._total_gastado) },
                    { icon: <Phone size={14}/>,    label: 'Total citas',   val: `${selected._citas_count} citas` },
                    ...(selected._ultima_visita ? [{ icon: <Calendar size={14}/>, label: 'Última visita', val: formatDate(selected._ultima_visita) }] : []),
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1 text-beauty-secondary">{item.icon}
                        <p className="text-gray-400 text-xs">{item.label}</p>
                      </div>
                      <p className="font-semibold text-beauty-text text-sm">{item.val}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 sm:p-5 pt-0 flex gap-3">
                  <a href={waLink(selected.telefono, selected.nombre)} target="_blank" rel="noopener noreferrer"
                    className="flex-1 bg-green-500 text-white py-3.5 rounded-xl text-sm font-semibold text-center hover:bg-green-600 transition-colors flex items-center justify-center gap-2 min-h-[52px]">
                    💬 WhatsApp
                  </a>
                  <button onClick={() => setSelected(null)}
                    className="flex-1 btn-beauty justify-center py-3.5">
                    Cerrar
                  </button>
                </div>
                <div className="px-4 sm:px-5 pb-5">
                  <button onClick={() => deleteCliente(selected)} disabled={deleting}
                    className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-2.5 rounded-xl transition-colors border border-red-100 flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Trash2 size={13} /> Eliminar cliente permanentemente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  )
}
