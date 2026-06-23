'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { Clock, Plus, Edit, Save, X, CheckCircle, XCircle, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface Especialista {
  id: string
  nombre: string
  foto?: string
  activo: boolean
  especialidades: string[]
  horario_inicio: string
  horario_fin: string
  dias_laborales: number[]
}

const DIAS = [
  { num: 0, label: 'Dom', short: 'D' },
  { num: 1, label: 'Lun', short: 'L' },
  { num: 2, label: 'Mar', short: 'M' },
  { num: 3, label: 'Mié', short: 'X' },
  { num: 4, label: 'Jue', short: 'J' },
  { num: 5, label: 'Vie', short: 'V' },
  { num: 6, label: 'Sáb', short: 'S' },
]

// Generate time options every 30 min — 6:00 AM to 10:00 PM
const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const totalMins = 360 + i * 30  // 6:00 = 360 min, 22:00 = 1320 min
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0')
  const m = (totalMins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
})

type FormData = {
  nombre: string
  horario_inicio: string
  horario_fin: string
  activo: boolean
}

export default function EspecialistasView() {
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Especialista | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [diasSelected, setDiasSelected] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const supabase = createClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('especialistas').select('*').order('nombre')
    setEspecialistas((data as Especialista[]) || [])
    setLoading(false)
  }

  function openEdit(e: Especialista) {
    setEditing(e)
    setDiasSelected(e.dias_laborales || [1, 2, 3, 4, 5, 6])
    reset({
      nombre: e.nombre,
      horario_inicio: e.horario_inicio,
      horario_fin: e.horario_fin,
      activo: e.activo,
    })
    setShowForm(true)
  }

  function openNew() {
    setEditing(null)
    setDiasSelected([1, 2, 3, 4, 5, 6])
    reset({ nombre: '', horario_inicio: '09:00', horario_fin: '19:00', activo: true })
    setShowForm(true)
  }

  function toggleDia(num: number) {
    setDiasSelected(prev =>
      prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num].sort()
    )
  }

  async function onSubmit(data: FormData) {
    if (diasSelected.length === 0) {
      toast.error('Selecciona al menos un día laboral')
      return
    }

    const payload = {
      nombre: data.nombre,
      horario_inicio: data.horario_inicio,
      horario_fin: data.horario_fin,
      activo: data.activo,
      dias_laborales: diasSelected,
    }

    if (editing) {
      const { error } = await supabase.from('especialistas').update(payload).eq('id', editing.id)
      if (error) { toast.error('Error al actualizar'); return }
      toast.success(`✅ ${data.nombre} actualizada correctamente`)
    } else {
      const { error } = await supabase.from('especialistas').insert(payload)
      if (error) { toast.error('Error al crear'); return }
      toast.success(`✅ ${data.nombre} creada correctamente`)
    }

    setShowForm(false)
    loadData()
  }

  function formatHorario(inicio: string, fin: string) {
    const fmt = (t: string) => {
      const [h, m] = t.split(':')
      const hour = parseInt(h)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      return `${h12}:${m} ${ampm}`
    }
    return `${fmt(inicio)} — ${fmt(fin)}`
  }

  function formatDias(dias: number[]) {
    return DIAS.filter(d => dias.includes(d.num)).map(d => d.label).join(', ')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-black flex items-center gap-2">
            <User size={22} className="text-beauty-gold" />
            Especialistas
          </h2>
          <p className="text-gray-500 text-sm">Gestiona horarios y disponibilidad</p>
        </div>
        <button onClick={openNew} className="btn-beauty text-sm py-2">
          <Plus size={16} /> Nueva
        </button>
      </div>

      {/* Info box */}
      <div className="bg-beauty-gold/10 border border-beauty-gold/30 rounded-xl p-4 flex items-start gap-3">
        <Clock size={18} className="text-beauty-gold mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-beauty-black">Horario del bot de WhatsApp</p>
          <p className="text-gray-600 mt-0.5">
            El bot solo ofrece citas dentro del horario laboral de cada especialista.
            Cambia el horario aquí y se actualizará automáticamente en el bot.
          </p>
        </div>
      </div>

      {/* Especialistas cards */}
      {loading ? (
        <div className="beauty-card p-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {especialistas.map(e => (
            <div key={e.id} className="beauty-card p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-beauty-gold flex items-center justify-center">
                    <span className="text-beauty-black font-bold text-lg">{e.nombre.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-beauty-black">{e.nombre}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      e.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {e.activo ? <><CheckCircle size={10} /> Activa</> : <><XCircle size={10} /> Inactiva</>}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openEdit(e)}
                  className="p-2 hover:bg-beauty-rose-light rounded-xl transition-colors"
                >
                  <Edit size={16} className="text-beauty-gold" />
                </button>
              </div>

              {/* Horario */}
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-beauty-gold" />
                    <p className="text-xs font-semibold text-gray-600">Horario de trabajo</p>
                  </div>
                  <p className="text-beauty-black font-bold text-sm">
                    {formatHorario(e.horario_inicio, e.horario_fin)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Días laborales</p>
                  <div className="flex gap-1 flex-wrap">
                    {DIAS.map(d => (
                      <span
                        key={d.num}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          e.dias_laborales?.includes(d.num)
                            ? 'bg-beauty-gold text-beauty-black'
                            : 'bg-gray-100 text-gray-300'
                        }`}
                      >
                        {d.short}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Slots preview */}
                <div className="bg-beauty-rose-light rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    Ventana de citas
                  </p>
                  <p className="text-beauty-black text-sm font-medium">
                    Desde {formatTime12(e.horario_inicio)} — última cita a las {formatTime12(e.horario_fin)}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {calcSlots(e.horario_inicio, e.horario_fin)} slots de 30 min · la cita puede terminar después
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / New form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-beauty-black">
                {editing ? `Editar — ${editing.nombre}` : 'Nueva Especialista'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  {...register('nombre', { required: 'Requerido' })}
                  className="input-beauty"
                  placeholder="Nombre de la especialista"
                />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>

              {/* Horario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primera cita
                  </label>
                  <select {...register('horario_inicio', { required: true })} className="input-beauty">
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Última cita inicia
                  </label>
                  <select {...register('horario_fin', { required: true })} className="input-beauty">
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                ℹ️ La última cita puede <em>iniciar</em> a esa hora — termina cuando el servicio lo requiera.
              </p>

              {/* Días */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días laborales
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DIAS.map(d => (
                    <button
                      key={d.num}
                      type="button"
                      onClick={() => toggleDia(d.num)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        diasSelected.includes(d.num)
                          ? 'bg-beauty-gold text-beauty-black shadow-beauty'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activo */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <input
                  {...register('activo')}
                  type="checkbox"
                  id="activo"
                  className="w-4 h-4 accent-beauty-gold"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                  Especialista activa (visible para el bot y clientes)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border-2 border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-beauty justify-center py-3">
                  <Save size={16} />
                  {editing ? 'Guardar cambios' : 'Crear especialista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function calcSlots(inicio: string, fin: string): number {
  const [sh, sm] = inicio.split(':').map(Number)
  const [eh, em] = fin.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  // +1 because the end slot itself is available
  return Math.max(0, Math.floor((endMins - startMins) / 30) + 1)
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${h12}:${m} ${ampm}`
}
