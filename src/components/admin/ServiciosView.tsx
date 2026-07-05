'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Servicio, Categoria } from '@/types/database'
import { Plus, Edit, Trash2, Search, Clock, X } from 'lucide-react'
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
  const [servicios, setServicios]   = useState<Servicio[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Servicio | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ServiceForm>()
  const tipoPrecio = watch('tipo_precio')

  useEffect(() => { loadData() }, [])

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
      nombre:              s.nombre,
      categoria_id:        s.categoria_id,
      precio:              s.precio        ?? undefined,
      precio_desde:        s.precio_desde  ?? undefined,
      tipo_precio:         s.tipo_precio,
      duracion_minutos:    s.duracion_minutos,
      requiere_valoracion: s.requiere_valoracion,
      descripcion:         s.descripcion   ?? undefined,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function onSubmit(data: ServiceForm) {
    setSaving(true)

    // Limpiar precios según tipo para no enviar NaN a Supabase
    const payload = {
      nombre:              data.nombre.trim(),
      categoria_id:        data.categoria_id,
      tipo_precio:         data.tipo_precio,
      duracion_minutos:    data.duracion_minutos,
      requiere_valoracion: data.requiere_valoracion,
      descripcion:         data.descripcion?.trim() || null,
      precio:       data.tipo_precio === 'fijo'   && data.precio       ? Number(data.precio)       : null,
      precio_desde: data.tipo_precio === 'desde'  && data.precio_desde ? Number(data.precio_desde) : null,
    }

    if (editing) {
      const { error } = await supabase.from('servicios').update(payload).eq('id', editing.id)
      if (error) {
        console.error('Error actualizando servicio:', error)
        toast.error(`Error al actualizar: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('✅ Servicio actualizado')
    } else {
      const { error } = await supabase.from('servicios').insert({ ...payload, activo: true })
      if (error) {
        console.error('Error creando servicio:', error)
        toast.error(`Error al crear: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('✅ Servicio creado')
    }

    setSaving(false)
    closeForm()
    loadData()
  }

  async function deleteServicio(id: string) {
    if (!confirm('¿Eliminar este servicio?')) return
    const { error } = await supabase.from('servicios').delete().eq('id', id)
    if (error) return toast.error(`Error al eliminar: ${error.message}`)
    toast.success('Servicio eliminado')
    loadData()
  }

  const filtered = servicios.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-text">Servicios</h2>
          <p className="text-gray-500 text-sm">{servicios.length} servicios en el catálogo</p>
        </div>
        <button onClick={openNew} className="btn-beauty text-sm py-2">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar servicios..."
          className="input-beauty pl-9"
        />
      </div>

      {/* Lista */}
      <div className="beauty-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando servicios...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search ? 'No hay servicios que coincidan.' : 'Sin servicios aún.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(s => (
              <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-beauty-text text-sm">{s.nombre}</p>
                  <p className="text-gray-400 text-xs">
                    {(s.categoria as Categoria | null)?.nombre || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <Clock size={12} /> {s.duracion_minutos}min
                  </div>
                  <div className="text-right min-w-[90px]">
                    {s.tipo_precio === 'fijo' && s.precio ? (
                      <span className="text-beauty-secondary font-semibold text-sm">
                        {formatCurrency(s.precio)}
                      </span>
                    ) : s.tipo_precio === 'desde' && s.precio_desde ? (
                      <span className="text-beauty-secondary font-semibold text-xs">
                        Desde {formatCurrency(s.precio_desde)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Valoración</span>
                    )}
                  </div>
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 hover:bg-beauty-rosa-claro rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit size={14} className="text-beauty-secondary" />
                  </button>
                  <button
                    onClick={() => deleteServicio(s.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">

            {/* Header modal */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-beauty-text">
                {editing ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
              <button onClick={closeForm} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('nombre', { required: 'El nombre es requerido' })}
                  className="input-beauty"
                  placeholder="Ej: Limpieza facial"
                />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('categoria_id', { required: 'Selecciona una categoría' })}
                  className="input-beauty"
                >
                  <option value="">— Selecciona —</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                {errors.categoria_id && <p className="text-red-500 text-xs mt-1">{errors.categoria_id.message}</p>}
              </div>

              {/* Tipo de precio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de precio</label>
                <select {...register('tipo_precio')} className="input-beauty">
                  <option value="fijo">Precio fijo</option>
                  <option value="desde">Precio desde</option>
                  <option value="valoracion">Requiere valoración</option>
                </select>
              </div>

              {/* Precio fijo */}
              {tipoPrecio === 'fijo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP)</label>
                  <input
                    {...register('precio', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="input-beauty"
                    placeholder="Ej: 50000"
                  />
                </div>
              )}

              {/* Precio desde */}
              {tipoPrecio === 'desde' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio desde (COP)</label>
                  <input
                    {...register('precio_desde', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="input-beauty"
                    placeholder="Ej: 80000"
                  />
                </div>
              )}

              {/* Duración */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duración (minutos) <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('duracion_minutos', {
                    valueAsNumber: true,
                    required: 'La duración es requerida',
                    min: { value: 5, message: 'Mínimo 5 minutos' },
                  })}
                  type="number"
                  min="5"
                  step="5"
                  className="input-beauty"
                />
                {errors.duracion_minutos && (
                  <p className="text-red-500 text-xs mt-1">{errors.duracion_minutos.message}</p>
                )}
              </div>

              {/* Requiere valoración */}
              <div
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer"
                onClick={() => {
                  const cur = watch('requiere_valoracion')
                  reset({ ...watch(), requiere_valoracion: !cur })
                }}
              >
                <input
                  {...register('requiere_valoracion')}
                  type="checkbox"
                  id="valoracion"
                  className="rounded accent-beauty-primary cursor-pointer"
                  onClick={e => e.stopPropagation()}
                />
                <label htmlFor="valoracion" className="text-sm text-gray-700 cursor-pointer">
                  Requiere valoración previa
                </label>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  {...register('descripcion')}
                  className="input-beauty resize-none"
                  rows={2}
                  placeholder="Descripción breve del servicio..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 border-2 border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-beauty justify-center py-3 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}
