'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'
import { Search, User, Phone, Calendar, TrendingUp, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

import toast from 'react-hot-toast'

export default function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadClientes()
  }, [])

  async function loadClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('fecha_registro', { ascending: false })
    setClientes((data as Cliente[]) || [])
    setLoading(false)
  }

  async function deleteCliente(cliente: Cliente) {
    if (!confirm(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const res = await fetch(`/api/clientes?id=${cliente.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Error al eliminar cliente')
    } else {
      toast.success('Cliente eliminado')
      setSelected(null)
      loadClientes()
    }
    setDeleting(false)
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
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="input-beauty pl-10"
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
                onClick={() => setSelected(cliente)}
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
                    {formatCurrency(cliente.total_gastado || 0)}
                  </p>
                  <p className="text-gray-400 text-xs">{cliente.total_citas || 0} citas</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Client detail modal — bottom sheet en móvil */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slide-up">
            {/* Handle bar móvil */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-beauty-secondary flex items-center justify-center shrink-0">
                  <span className="text-beauty-text font-bold text-xl">{getInitials(selected.nombre)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-beauty-text text-base sm:text-lg truncate">{selected.nombre}</h3>
                  <p className="text-gray-500 text-sm">{selected.telefono}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 shrink-0">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-2 gap-3">
              {[
                { icon: <Calendar size={14} />, label: 'Registro', val: formatDate(selected.fecha_registro) },
                { icon: <TrendingUp size={14} />, label: 'Total gastado', val: formatCurrency(selected.total_gastado || 0) },
                { icon: <Phone size={14} />, label: 'Total citas', val: String(selected.total_citas || 0) },
                ...(selected.ultima_visita ? [{ icon: <Calendar size={14} />, label: 'Última visita', val: formatDate(selected.ultima_visita) }] : []),
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

            <div className="p-4 sm:p-6 pt-0 flex gap-3">
              <a
                href={`https://wa.me/57${selected.telefono}?text=Hola ${selected.nombre}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 bg-green-500 text-white py-3.5 rounded-xl text-sm font-semibold text-center hover:bg-green-600 transition-colors flex items-center justify-center gap-2 min-h-[52px]"
              >
                💬 WhatsApp
              </a>
              <button onClick={() => setSelected(null)}
                className="flex-1 btn-beauty justify-center py-3.5">
                Cerrar
              </button>
            </div>
            <div className="px-4 sm:px-6 pb-5">
              <button
                onClick={() => deleteCliente(selected)}
                disabled={deleting}
                className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-2.5 rounded-xl transition-colors border border-red-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={13} /> Eliminar cliente permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
