'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast, { Toaster } from 'react-hot-toast'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Clock, User, Phone, ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Especialista { id: string; nombre: string }

const schema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  telefono: z.string().min(10, 'Teléfono inválido'),
  categoria_id: z.string().min(1, 'Selecciona una categoría'),
  servicio_idx: z.string().min(1, 'Selecciona un servicio'),
  fecha: z.string().min(1, 'Selecciona una fecha'),
  especialista_id: z.string(),
  observaciones: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function BookingSection() {
  const [step, setStep] = useState(1)
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [availableSlots, setAvailableSlots] = useState<
    { hora: string; especialista_nombre: string; fecha_inicio: string; fecha_fin: string; especialista_id: string }[]
  >([])
  const [selectedSlot, setSelectedSlot] = useState<(typeof availableSlots)[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState<FormData | null>(null)

  // Cargar especialistas desde Supabase dinámicamente
  useEffect(() => {
    const supabase = createClient()
    supabase.from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => { if (data) setEspecialistas(data) })
  }, [])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { especialista_id: '' },
  })

  const categoriaId = watch('categoria_id')
  const servicioIdx = watch('servicio_idx')

  const serviciosDeCat = SERVICIOS_DATA.filter(s => s.cat === categoriaId)
  const servicioSeleccionado = serviciosDeCat[parseInt(servicioIdx) - 1]

  async function checkAvailability(data: FormData) {
    setLoading(true)
    try {
      const servicio = serviciosDeCat[parseInt(data.servicio_idx) - 1]
      if (!servicio) { toast.error('Servicio no válido'); return }

      const params = new URLSearchParams({
        fecha: new Date(data.fecha + 'T12:00:00-05:00').toISOString(),
        duracion: servicio.duracion.toString(),
        ...(data.especialista_id ? { especialista_id: data.especialista_id } : {}),
      })
      const res = await fetch(`/api/disponibilidad?${params}`)
      const slots = await res.json()
      setAvailableSlots(Array.isArray(slots) ? slots : [])
      setFormData(data)
      setStep(2)
    } catch {
      toast.error('Error verificando disponibilidad')
    } finally {
      setLoading(false)
    }
  }

  async function confirmBooking(data: FormData) {
    if (!selectedSlot) { toast.error('Selecciona un horario'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente:  data.nombre,
          telefono:        data.telefono,
          especialista_id: selectedSlot.especialista_id,
          fecha_inicio:    selectedSlot.fecha_inicio,
          fecha_fin:       selectedSlot.fecha_fin,
          servicio_nombre: servicioSeleccionado?.nombre || null,
          observaciones:   data.observaciones || null,
          canal:           'web',
        }),
      })
      if (res.ok) {
        setSuccess(true)
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Error cita:', err)
        toast.error('Error al reservar, intenta nuevamente')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function confirmarDirecto() {
    if (!selectedSlot || !formData) { toast.error('Selecciona un horario'); return }
    await confirmBooking(formData)
  }

  if (success) {
    return (
      <section id="reservar" className="py-20 bg-white">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="beauty-card p-10">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="text-green-600" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-beauty-text-dark mb-3">
              ¡Cita Reservada! 💖
            </h3>
            <p className="text-beauty-text-muted mb-6">
              Tu cita ha sido confirmada. Recibirás un recordatorio por WhatsApp.
            </p>
            <button onClick={() => { setSuccess(false); setStep(1) }} className="btn-beauty w-full justify-center">
              Reservar otra cita
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="reservar" className="py-14 sm:py-20 bg-white">
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-beauty-secondary text-sm font-medium tracking-widest uppercase mb-3">
            ♥ Reserva Online
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-beauty-text-dark mb-2">
            Tu Cita en <span className="text-beauty-primary">3 Pasos</span>
          </h2>
          <div className="gold-divider w-24 mx-auto mt-4" />
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s ? 'bg-beauty-secondary text-white' : 'bg-gray-200 text-gray-400'
              }`}>{s}</div>
              {s < 2 && <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-beauty-secondary' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Paso 1 */}
        {step === 1 && (
          <form onSubmit={handleSubmit(checkAvailability)} className="beauty-card p-6 space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-beauty-text mb-1">
                  <User size={14} className="inline mr-1" /> Nombre completo
                </label>
                <input {...register('nombre')} className="input-beauty" placeholder="Tu nombre" />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-beauty-text mb-1">
                  <Phone size={14} className="inline mr-1" /> Teléfono
                </label>
                <input {...register('telefono')} className="input-beauty" placeholder="3001234567" />
                {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-beauty-text mb-1">Categoría</label>
              <select {...register('categoria_id')} className="input-beauty">
                <option value="">Selecciona una categoría</option>
                {CATEGORIAS.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                ))}
              </select>
              {errors.categoria_id && <p className="text-red-500 text-xs mt-1">{errors.categoria_id.message}</p>}
            </div>

            {categoriaId && (
              <div>
                <label className="block text-sm font-medium text-beauty-text mb-1">Servicio</label>
                <select {...register('servicio_idx')} className="input-beauty">
                  <option value="">Selecciona un servicio</option>
                  {serviciosDeCat.map((s, i) => (
                    <option key={i} value={(i + 1).toString()}>
                      {s.nombre}
                      {s.tipo === 'fijo' && s.precio ? ` — ${formatCurrency(s.precio)}` : ''}
                      {s.tipo === 'desde' && s.precio_desde ? ` desde ${formatCurrency(s.precio_desde)}` : ''}
                    </option>
                  ))}
                </select>
                {errors.servicio_idx && <p className="text-red-500 text-xs mt-1">{errors.servicio_idx.message}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-beauty-text mb-1">
                <Calendar size={14} className="inline mr-1" /> Fecha deseada
              </label>
              <input {...register('fecha')} type="date"
                min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })}
                className="input-beauty" />
              {errors.fecha && <p className="text-red-500 text-xs mt-1">{errors.fecha.message}</p>}
            </div>

            {/* Especialistas dinámicos desde Supabase */}
            <div>
              <label className="block text-sm font-medium text-beauty-text mb-2">Especialista</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label className="cursor-pointer">
                  <input {...register('especialista_id')} type="radio" value="" className="sr-only peer" />
                  <div className="border-2 border-beauty-primary/40 rounded-xl p-3 text-center text-sm font-medium text-beauty-text
                    peer-checked:border-beauty-secondary peer-checked:text-beauty-secondary peer-checked:bg-beauty-secondary/10
                    transition-all cursor-pointer hover:border-beauty-primary min-h-[48px] flex items-center justify-center">
                    Cualquiera
                  </div>
                </label>
                {especialistas.map(esp => (
                  <label key={esp.id} className="cursor-pointer">
                    <input {...register('especialista_id')} type="radio" value={esp.id} className="sr-only peer" />
                    <div className="border-2 border-beauty-primary/40 rounded-xl p-3 text-center text-sm font-medium text-beauty-text
                      peer-checked:border-beauty-secondary peer-checked:text-beauty-secondary peer-checked:bg-beauty-secondary/10
                      transition-all cursor-pointer hover:border-beauty-primary min-h-[48px] flex items-center justify-center">
                      {esp.nombre}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-beauty-text mb-1">Observaciones (opcional)</label>
              <textarea {...register('observaciones')} className="input-beauty resize-none" rows={3}
                placeholder="Alergias, preferencias, etc." />
            </div>

            <button type="submit" disabled={loading} className="btn-beauty w-full justify-center">
              {loading ? 'Verificando...' : <> Ver disponibilidad <ChevronRight size={18} /></>}
            </button>
          </form>
        )}

        {/* Paso 2 */}
        {step === 2 && (
          <div className="beauty-card p-6">
            <h3 className="font-semibold text-beauty-text-dark mb-1">Horarios disponibles</h3>
            <p className="text-beauty-text-muted text-sm mb-5">Selecciona el horario que prefieras</p>

            {availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-beauty-text-muted">No hay disponibilidad para esa fecha.</p>
                <button type="button" onClick={() => setStep(1)}
                  className="btn-beauty-outline mt-4">Cambiar fecha</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                  {availableSlots.map((slot, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedSlot?.fecha_inicio === slot.fecha_inicio &&
                        selectedSlot?.especialista_id === slot.especialista_id
                          ? 'border-beauty-secondary bg-beauty-secondary/10'
                          : 'border-beauty-primary/40 hover:border-beauty-secondary/60'
                      }`}>
                      <div className="flex items-center gap-1 text-beauty-text-dark font-semibold text-sm">
                        <Clock size={12} /> {slot.hora}
                      </div>
                      <p className="text-beauty-text-muted text-xs mt-0.5">{slot.especialista_nombre}</p>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-beauty-outline flex-1 justify-center">Volver</button>
                  <button
                    type="button"
                    onClick={confirmarDirecto}
                    disabled={!selectedSlot || loading}
                    className="btn-beauty flex-1 justify-center disabled:opacity-50">
                    {loading ? 'Reservando...' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
