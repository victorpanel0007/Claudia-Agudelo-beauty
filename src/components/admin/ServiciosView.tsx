'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Servicio, Categoria } from '@/types/database'
import { Plus, Edit, Trash2, Search, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

type ServiceForm = {
  nombre: string
  categoria_id: string
  precio?: number
  precio_desde?: number
  tipo_precio: 'fijo' | 'desde' | 'valoracion'
  duracion_minutos: number
  requiere_valoracion: boolean
  descripcion?: string
}

export default function ServiciosView() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Servicio | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ServiceForm>()
  const tipoPrecio = watch('tipo_precio')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: servs }, { data: cats }] = await Promise.all([
      supabase.from('servicios').select('*, categoria:categorias(*)').order('nombre'),
      supabase.from('categorias').select('*').order('orden'),
    ])
    setServicios((servs as Servicio[]) || [])
    setCategorias((cats as Categoria[]) || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    reset({ tipo_precio: 'fijo', duracion_minutos: 60, requiere_valoracion: false })
    setShowForm(true)
  }

  function openEdit(s: Servicio) {
    setEditing(s)
    reset({
      nombre: s.nombre,
      categoria_id: s.categoria_id,
      precio: s.precio,
      precio_desde: s.precio_desde,
      tipo_precio: s.tipo_precio,
      duracion_minutos: s.duracion_minutos,
      requiere_valoracion: s.requiere_valoracion,
      descripcion: s.descripcion,
    })
    setShowForm(true)
  }

  async function onSubmit(data: ServiceForm) {
    if (editing) {
      const { error } = await supabase.from('servicios').update(data).eq('id', editing.id)
      if (error) return toast.error('Error al actualizar')
      toast.success('Servicio actualizado')
    } else {
      const { error } = await supabase.from('servicios').insert({ ...data, activo: true })
      if (error) return toast.error('Error al crear')
      toast.success('Servicio creado')
    }
    setShowForm(false)
    loadData()
  }

  async function deleteServicio(id: string) {
    if (!confirm('¿Eliminar este servicio?')) return
    const { error } = await supabase.from('servicios').delete().eq('id', id)
    if (error) return toast.error('Error al eliminar')
    toast.success('Servicio eliminado')
    loadData()
  }

  const filtered = servicios.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-text">Servicios</h2>
          <p className="text-gray-500 text-sm">Catálogo de servicios</p>
        </div>
        <button onClick={openNew} className="btn-beauty text-sm py-2">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar servicios..."
          className="input-beauty pl-9"
        />
      </div>

      <div className="beauty-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando servicios...</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(s => (
              <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-beauty-text text-sm">{s.nombre}</p>
                  <p className="text-gray-400 text-xs">
                    {(s.categoria as Categoria)?.nombre || s.categoria_id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <Clock size={12} />
                    {s.duracion_minutos}m
                  </div>
                  <div className="text-right min-w-[80px]">
                    {s.tipo_precio === 'fijo' && s.precio ? (
                      <span className="text-beauty-secondary font-semibold text-sm">
                        {formatCurrency(s.precio)}
                      </span>
                    ) : s.tipo_precio === 'desde' && s.precio_desde ? (
                      <span className="text-beauty-secondary font-semibold text-xs">
                        Desde {formatCurrency(s.precio_desde)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Valoración</span>
                    )}
                  </div>
                  <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-beauty-rosa-claro rounded-lg transition-colors">
                    <Edit size={14} className="text-beauty-secondary" />
                  </button>
                  <button onClick={() => deleteServicio(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-beauty-text">
                {editing ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input {...register('nombre', { required: true })} className="input-beauty" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select {...register('categoria_id', { required: true })} className="input-beauty">
                  <option value="">Selecciona</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de precio</label>
                <select {...register('tipo_precio')} className="input-beauty">
                  <option value="fijo">Precio fijo</option>
                  <option value="desde">Precio desde</option>
                  <option value="valoracion">Requiere valoración</option>
                </select>
              </div>
              {tipoPrecio === 'fijo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP)</label>
                  <input {...register('precio', { valueAsNumber: true })} type="number" className="input-beauty" />
                </div>
              )}
              {tipoPrecio === 'desde' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio desde (COP)</label>
                  <input {...register('precio_desde', { valueAsNumber: true })} type="number" className="input-beauty" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración (minutos)</label>
                <input {...register('duracion_minutos', { valueAsNumber: true, required: true })} type="number" className="input-beauty" />
              </div>
              <div className="flex items-center gap-2">
                <input {...register('requiere_valoracion')} type="checkbox" id="valoracion" className="rounded" />
                <label htmlFor="valoracion" className="text-sm text-gray-700">Requiere valoración previa</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea {...register('descripcion')} className="input-beauty resize-none" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border-2 border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-beauty justify-center py-3">
                  {editing ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
