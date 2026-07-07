'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Servicio, Categoria } from '@/types/database'
import { Plus, Edit, Trash2, Search, Clock, X, Loader2, Check, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Tipos del formulario ──────────────────────────────────────────────────────
type TipoPrecio = 'fijo' | 'desde' | 'valoracion'

interface ServiceForm {
  nombre:              string
  categoria_id:        string
  tipo_precio:         TipoPrecio
  precio:              string
  precio_desde:        string
  duracion_minutos:    string
  requiere_valoracion: boolean
  descripcion:         string
}

const EMPTY_FORM: ServiceForm = {
  nombre: '', categoria_id: '', tipo_precio: 'fijo',
  precio: '', precio_desde: '', duracion_minutos: '60',
  requiere_valoracion: false, descripcion: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json as T
}

// ── Formulario modal ──────────────────────────────────────────────────────────
function ServiceModal({
  editing, categorias, onClose, onSaved,
}: {
  editing:    Servicio | null
  categorias: Categoria[]
  onClose:    () => void
  onSaved:    () => void
}) {
  const [form, setForm] = useState<ServiceForm>(() =>
    editing
      ? {
          nombre:              editing.nombre,
          categoria_id:        editing.categoria_id,
          tipo_precio:         editing.tipo_precio,
          precio:              editing.precio        ? String(editing.precio)        : '',
          precio_desde:        editing.precio_desde  ? String(editing.precio_desde)  : '',
          duracion_minutos:    String(editing.duracion_minutos),
          requiere_valoracion: editing.requiere_valoracion,
          descripcion:         editing.descripcion ?? '',
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceForm, string>>>({})

  function set(k: keyof ServiceForm, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.nombre.trim())      errs.nombre = 'El nombre es requerido'
    if (!form.categoria_id)       errs.categoria_id = 'Selecciona una categoría'
    const dur = Number(form.duracion_minutos)
    if (!dur || dur < 5)          errs.duracion_minutos = 'Mínimo 5 minutos'
    if (form.tipo_precio === 'fijo' && !form.precio)
                                  errs.precio = 'Ingresa el precio'
    if (form.tipo_precio === 'desde' && !form.precio_desde)
                                  errs.precio_desde = 'Ingresa el precio desde'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    if (!validate()) return
    setSaving(true)
    try {
      const body = {
        nombre:              form.nombre.trim(),
        categoria_id:        form.categoria_id,
        tipo_precio:         form.tipo_precio,
        duracion_minutos:    Number(form.duracion_minutos),
        requiere_valoracion: form.requiere_valoracion,
        descripcion:         form.descripcion.trim() || null,
        precio:       form.tipo_precio === 'fijo'   ? Number(form.precio)        : null,
        precio_desde: form.tipo_precio === 'desde'  ? Number(form.precio_desde)  : null,
        ...(editing ? { id: editing.id } : {}),
      }
      if (editing) {
        await apiFetch('/api/servicios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        toast.success('✅ Servicio actualizado')
      } else {
        await apiFetch('/api/servicios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        toast.success('✅ Servicio creado')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#EFA1B5] focus:ring-2 focus:ring-[#EFA1B5]/20 transition-colors'
  const label = 'block text-xs font-semibold text-gray-600 mb-1.5'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[92vh] animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            <p className="text-xs text-gray-400">Todos los campos marcados con * son requeridos</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Nombre */}
          <div>
            <label className={label}>Nombre *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Limpieza facial profunda"
              className={`${field} ${errors.nombre ? 'border-red-400' : ''}`} />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre}</p>}
          </div>

          {/* Categoría */}
          <div>
            <label className={label}>Categoría *</label>
            <div className="relative">
              <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}
                className={`${field} appearance-none pr-8 ${errors.categoria_id ? 'border-red-400' : ''}`}>
                <option value="">— Selecciona una categoría —</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.categoria_id && <p className="text-red-500 text-xs mt-1">{errors.categoria_id}</p>}
          </div>

          {/* Duración */}
          <div>
            <label className={label}>Duración (minutos) *</label>
            <input type="number" min="5" step="5" value={form.duracion_minutos}
              onChange={e => set('duracion_minutos', e.target.value)}
              className={`${field} ${errors.duracion_minutos ? 'border-red-400' : ''}`} />
            {errors.duracion_minutos && <p className="text-red-500 text-xs mt-1">{errors.duracion_minutos}</p>}
          </div>

          {/* Tipo de precio */}
          <div>
            <label className={label}>Tipo de precio</label>
            <div className="grid grid-cols-3 gap-2">
              {(['fijo', 'desde', 'valoracion'] as TipoPrecio[]).map(t => (
                <button key={t} type="button" onClick={() => set('tipo_precio', t)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    form.tipo_precio === t
                      ? 'border-[#EFA1B5] bg-[#EFA1B5]/10 text-[#8B1E3F]'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {t === 'fijo' ? 'Precio fijo' : t === 'desde' ? 'Desde...' : 'Valoración'}
                </button>
              ))}
            </div>
          </div>

          {/* Precio fijo */}
          {form.tipo_precio === 'fijo' && (
            <div>
              <label className={label}>Precio (COP) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" value={form.precio} onChange={e => set('precio', e.target.value)}
                  placeholder="Ej: 46000"
                  className={`${field} pl-7 ${errors.precio ? 'border-red-400' : ''}`} />
              </div>
              {errors.precio && <p className="text-red-500 text-xs mt-1">{errors.precio}</p>}
            </div>
          )}

          {/* Precio desde */}
          {form.tipo_precio === 'desde' && (
            <div>
              <label className={label}>Precio desde (COP) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" value={form.precio_desde} onChange={e => set('precio_desde', e.target.value)}
                  placeholder="Ej: 80000"
                  className={`${field} pl-7 ${errors.precio_desde ? 'border-red-400' : ''}`} />
              </div>
              {errors.precio_desde && <p className="text-red-500 text-xs mt-1">{errors.precio_desde}</p>}
            </div>
          )}

          {/* Requiere valoración */}
          <label className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 cursor-pointer select-none">
            <div onClick={() => set('requiere_valoracion', !form.requiere_valoracion)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                form.requiere_valoracion ? 'bg-[#EFA1B5] border-[#EFA1B5]' : 'border-gray-300'
              }`}>
              {form.requiere_valoracion && <Check size={12} className="text-white" />}
            </div>
            <span className="text-sm text-gray-700">Requiere valoración previa</span>
          </label>

          {/* Descripción */}
          <div>
            <label className={label}>Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={2} placeholder="Descripción breve del servicio..."
              className={`${field} resize-none`} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#EFA1B5] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#e08fa3] transition-colors disabled:opacity-50">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <>{editing ? 'Actualizar' : 'Crear servicio'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Vista principal ───────────────────────────────────────────────────────────
export default function ServiciosView() {
  const [servicios, setServicios]   = useState<Servicio[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [search, setSearch]         = useState('')
  const [editing, setEditing]       = useState<Servicio | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [loading, setLoading]       = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const [servs, cats] = await Promise.all([
        apiFetch<Servicio[]>('/api/servicios'),
        apiFetch<Categoria[]>('/api/categorias'),
      ])
      setServicios(servs)
      setCategorias(cats)
    } catch (err) {
      toast.error(`Error cargando datos: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function deleteServicio(id: string) {
    if (!confirm('¿Eliminar este servicio? Esta acción no se puede deshacer.')) return
    try {
      await apiFetch(`/api/servicios?id=${id}`, { method: 'DELETE' })
      toast.success('Servicio eliminado')
      loadData()
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`)
    }
  }

  const filtered = servicios.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (s.categoria as Categoria | null)?.nombre?.toLowerCase().includes(search.toLowerCase())
  )

  // Agrupar por categoría
  const byCategoria = filtered.reduce<Record<string, Servicio[]>>((acc, s) => {
    const cat = (s.categoria as Categoria | null)?.nombre ?? 'Sin categoría'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Servicios</h2>
          <p className="text-gray-500 text-sm">{servicios.length} servicios en el catálogo</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-[#EFA1B5] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-[#e08fa3] transition-colors shadow-sm">
          <Plus size={16} /> Nuevo servicio
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o categoría..."
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#EFA1B5] focus:ring-2 focus:ring-[#EFA1B5]/20" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg">
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 size={24} className="animate-spin text-[#EFA1B5] mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Cargando servicios...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-4xl mb-3">✂️</p>
          <p className="text-gray-500 font-medium">{search ? 'Sin resultados' : 'Sin servicios aún'}</p>
          <p className="text-gray-400 text-sm mt-1">{search ? `No hay servicios que coincidan con "${search}"` : 'Crea el primer servicio con el botón de arriba'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(byCategoria).map(([cat, svcs]) => (
            <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat}</span>
                <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{svcs.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {svcs.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{s.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-gray-400 text-[11px]">
                          <Clock size={11} /> {s.duracion_minutos} min
                        </span>
                        {s.requiere_valoracion && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">Valoración</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {s.tipo_precio === 'fijo' && s.precio ? (
                        <span className="text-[#8B1E3F] font-bold text-sm">{formatCurrency(s.precio)}</span>
                      ) : s.tipo_precio === 'desde' && s.precio_desde ? (
                        <span className="text-[#8B1E3F] font-semibold text-xs">Desde {formatCurrency(s.precio_desde)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">A valorar</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditing(s); setShowForm(true) }}
                        className="p-2 hover:bg-[#FAD6E0] rounded-xl transition-colors" title="Editar">
                        <Edit size={14} className="text-[#8B1E3F]" />
                      </button>
                      <button onClick={() => deleteServicio(s.id)}
                        className="p-2 hover:bg-red-50 rounded-xl transition-colors" title="Eliminar">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && typeof document !== 'undefined' && (
        <ServiceModal
          editing={editing}
          categorias={categorias}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { loadData() }}
        />
      )}
    </div>
  )
}
