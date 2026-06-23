'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'
import { Search, User, Phone, Calendar, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

export default function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Cliente | null>(null)
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

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono.includes(search)
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-beauty-black">Clientes</h2>
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
                onClick={() => setSelected(cliente)}
                className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-beauty-rose-light flex items-center justify-center shrink-0">
                  <span className="text-beauty-gold font-bold text-sm">
                    {getInitials(cliente.nombre)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-beauty-black text-sm">{cliente.nombre}</p>
                  <p className="text-gray-400 text-xs">{cliente.telefono}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-beauty-gold font-semibold text-sm">
                    {formatCurrency(cliente.total_gastado || 0)}
                  </p>
                  <p className="text-gray-400 text-xs">{cliente.total_citas || 0} citas</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Client detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slide-up">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-beauty-gold flex items-center justify-center">
                  <span className="text-beauty-black font-bold text-xl">{getInitials(selected.nombre)}</span>
                </div>
                <div>
                  <h3 className="font-bold text-beauty-black text-lg">{selected.nombre}</h3>
                  <p className="text-gray-500 text-sm">{selected.telefono}</p>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={16} className="text-beauty-gold" />
                  <p className="text-gray-400 text-xs">Registro</p>
                </div>
                <p className="font-semibold text-beauty-black text-sm">
                  {formatDate(selected.fecha_registro)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-beauty-gold" />
                  <p className="text-gray-400 text-xs">Total gastado</p>
                </div>
                <p className="font-semibold text-beauty-black text-sm">
                  {formatCurrency(selected.total_gastado || 0)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone size={16} className="text-beauty-gold" />
                  <p className="text-gray-400 text-xs">Total citas</p>
                </div>
                <p className="font-semibold text-beauty-black text-sm">{selected.total_citas || 0}</p>
              </div>
              {selected.ultima_visita && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={16} className="text-beauty-gold" />
                    <p className="text-gray-400 text-xs">Última visita</p>
                  </div>
                  <p className="font-semibold text-beauty-black text-sm">
                    {formatDate(selected.ultima_visita)}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <a
                href={`https://wa.me/57${selected.telefono}?text=Hola ${selected.nombre}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-medium text-center hover:bg-green-600 transition-colors"
              >
                WhatsApp
              </a>
              <button
                onClick={() => setSelected(null)}
                className="flex-1 btn-beauty justify-center py-3"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
