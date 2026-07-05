'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Plus, Edit, Save, X, CheckCircle, XCircle, User, Send, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface Especialista {
  id: string
  nombre: string
  activo: boolean
  especialidades: string[]
  horario_inicio: string
  horario_fin: string
  dias_laborales: number[]
  whatsapp?: string
  notificaciones?: boolean
}

interface FormState {
  nombre: string
  horario_inicio: string
  horario_fin: string
  activo: boolean
  whatsapp: string
  notificaciones: boolean
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

const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const totalMins = 360 + i * 30
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0')
  const m = (totalMins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
})

function formatTime12(t: string): string {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${h12}:${m} ${ampm}`
}

/**
 * Calcula cuántos slots de 30 min caben entre inicio y fin,
 * considerando que el servicio tiene que TERMINAR al cierre o antes.
 * Con horario 09:00–19:00: (19:00–09:00) = 600 min / 30 = 20 slots.
 */
function calcSlots(inicio: string, fin: string): number {
  const [sh, sm] = inicio.split(':').map(Number)
  const [eh, em] = fin.split(':').map(Number)
  const totalMins = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, Math.floor(totalMins / 30))
}

const DEFAULT_FORM: FormState = {
  nombre: '',
  horario_inicio: '09:00',
  horario_fin: '19:00',
  activo: true,
  whatsapp: '',
  notificaciones: true,
}

export default function EspecialistasView() {
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [diasSelected, setDiasSelected] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [sendingTest, setSendingTest] = useState<string | null>(null)
  const [waStatus, setWaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const supabase = createClient()

  useEffect(() => {
    loadData()
    checkWaStatus()
  }, [])

  async function checkWaStatus() {
    setWaStatus('checking')
    try {
      const res = await fetch('/api/whatsapp/status')
      const data = await res.json()
      setWaStatus(data.connected ? 'connected' : 'disconnected')
    } catch {
      setWaStatus('disconnected')
    }
  }

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('especialistas').select('*').order('nombre')
    setEspecialistas((data as Especialista[]) || [])
    setLoading(false)
  }

  function openEdit(e: Especialista) {
    setEditingId(e.id)
    setDiasSelected(e.dias_laborales || [1, 2, 3, 4, 5, 6])
    setForm({
      nombre:          e.nombre,
      horario_inicio:  e.horario_inicio || '09:00',
      horario_fin:     e.horario_fin    || '19:00',
      activo:          e.activo,
      whatsapp:        e.whatsapp || '',
      notificaciones:  e.notificaciones !== false,
    })
    setShowForm(true)
  }

  function openNew() {
    setEditingId(null)
    setDiasSelected([1, 2, 3, 4, 5, 6])
    setForm(DEFAULT_FORM)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(DEFAULT_FORM)
  }

  function toggleDia(num: number) {
    setDiasSelected(prev =>
      prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num].sort()
    )
  }

  async function handleEliminarEspecialista() {
    if (!editingId || !form.nombre) return
    if (!confirm(`¿Eliminar a ${form.nombre}? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    const { error } = await supabase.from('especialistas').delete().eq('id', editingId)
    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success(`🗑️ ${form.nombre} eliminada`)
      closeForm()
      loadData()
    }
    setSaving(false)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return }
    if (diasSelected.length === 0) { toast.error('Selecciona al menos un día'); return }

    setSaving(true)
    const payload = {
      nombre:          form.nombre.trim(),
      horario_inicio:  form.horario_inicio,
      horario_fin:     form.horario_fin,
      activo:          form.activo,
      dias_laborales:  diasSelected,
      whatsapp:        form.whatsapp.trim() || null,
      notificaciones:  form.notificaciones,
    }

    if (editingId) {
      const { error, data } = await supabase
        .from('especialistas')
        .update(payload)
        .eq('id', editingId)
        .select()
      if (error) {
        toast.error('Error al guardar: ' + error.message)
      } else if (!data || data.length === 0) {
        toast.error('No se encontró la especialista para actualizar')
      } else {
        toast.success(`✅ ${form.nombre} actualizada correctamente`)
        closeForm()
        loadData()
      }
    } else {
      const { error } = await supabase
        .from('especialistas')
        .insert(payload)
      if (error) {
        toast.error('Error al crear: ' + error.message)
      } else {
        toast.success(`✅ ${form.nombre} creada correctamente`)
        closeForm()
        loadData()
      }
    }
    setSaving(false)
  }

  async function enviarPrueba(e: Especialista) {
    if (!e.whatsapp) {
      toast.error('Esta especialista no tiene número WhatsApp configurado')
      return
    }
    setSendingTest(e.id)
    try {
      const res = await fetch(`/api/especialistas/${e.id}/notificar`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        toast.success(`✅ Mensaje de prueba enviado a ${e.nombre} (${data.telefono})`)
      } else {
        toast.error(`❌ Error: ${data.error || 'No se pudo enviar'}`)
      }
    } catch {
      toast.error('Error de conexión al enviar prueba')
    } finally {
      setSendingTest(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-beauty-text flex items-center gap-2">
            <User size={22} className="text-beauty-secondary" />
            Especialistas
          </h2>
          <p className="text-gray-500 text-sm hidden sm:block">Gestiona horarios y disponibilidad</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Indicador estado Evolution API */}
          {waStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> WA 🟢
            </span>
          ) : waStatus === 'disconnected' ? (
            <span
              onClick={checkWaStatus}
              className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer hover:bg-red-200 transition-colors"
              title="Haz clic para reintentar"
            >
              <span className="w-2 h-2 bg-red-500 rounded-full" /> WA 🔴
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-semibold px-3 py-1.5 rounded-full">
              <RefreshCw size={11} className="animate-spin" /> Verificando...
            </span>
          )}
          <button onClick={openNew} className="btn-beauty text-sm py-2">
            <Plus size={16} /> Nueva
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-beauty-secondary/10 border border-beauty-secondary/30 rounded-xl p-4 flex items-start gap-3">
        <Clock size={18} className="text-beauty-secondary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-beauty-text">Horario del bot de WhatsApp</p>
          <p className="text-gray-600 mt-0.5">
            El bot solo ofrece citas dentro del horario laboral de cada especialista.
            Cambia el horario aquí y se actualizará automáticamente en el bot.
          </p>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="beauty-card p-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {especialistas.map(e => (
            <div key={e.id} className="beauty-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-beauty-primary flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{e.nombre.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-beauty-text">{e.nombre}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      e.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {e.activo ? <><CheckCircle size={10} /> Activa</> : <><XCircle size={10} /> Inactiva</>}
                    </span>
                  </div>
                </div>
                <button onClick={() => openEdit(e)}
                  className="p-2 hover:bg-beauty-rosa-claro rounded-xl transition-colors">
                  <Edit size={16} className="text-beauty-secondary" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-beauty-secondary" />
                    <p className="text-xs font-semibold text-gray-600">Horario de trabajo</p>
                  </div>
                  <p className="text-beauty-text font-bold text-sm">
                    {formatTime12(e.horario_inicio)} — {formatTime12(e.horario_fin)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Días laborales</p>
                  <div className="flex gap-1 flex-wrap">
                    {DIAS.map(d => (
                      <span key={d.num}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          e.dias_laborales?.includes(d.num)
                            ? 'bg-beauty-secondary text-beauty-text'
                            : 'bg-gray-100 text-gray-300'
                        }`}>
                        {d.short}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-beauty-rosa-claro rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Horario de atención</p>
                  <p className="text-beauty-text text-sm font-medium">
                    {formatTime12(e.horario_inicio)} — {formatTime12(e.horario_fin)}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {calcSlots(e.horario_inicio, e.horario_fin)} slots de 30 min disponibles en el día
                  </p>
                </div>

                {/* Estado notificaciones WhatsApp */}
                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {e.whatsapp ? (
                      <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                        <Wifi size={13} className="text-green-500" />
                        WhatsApp: {e.whatsapp}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                        <WifiOff size={13} />
                        Sin WhatsApp configurado
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => enviarPrueba(e)}
                    disabled={!e.whatsapp || sendingTest === e.id}
                    title={e.whatsapp ? 'Enviar mensaje de prueba' : 'Configura el número WhatsApp primero'}
                    className="flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {sendingTest === e.id
                      ? <><RefreshCw size={11} className="animate-spin" /> Enviando...</>
                      : <><Send size={11} /> Prueba</>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">

            {/* Header modal */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-beauty-text">
                {editingId ? `Editar especialista` : 'Nueva Especialista'}
              </h3>
              <button onClick={closeForm} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="input-beauty"
                  placeholder="Nombre de la especialista"
                />
              </div>

              {/* Horario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de apertura</label>
                  <select
                    value={form.horario_inicio}
                    onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))}
                    className="input-beauty"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de cierre</label>
                  <select
                    value={form.horario_fin}
                    onChange={e => setForm(f => ({ ...f, horario_fin: e.target.value }))}
                    className="input-beauty"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                ℹ️ El sistema solo ofrecerá horarios cuyos servicios <em>terminen</em> antes del cierre.<br />
                Ej: cierre 7:00 PM + servicio 60 min → último slot disponible: 6:00 PM.
              </p>

              {/* Vista previa del horario seleccionado */}
              <div className="bg-beauty-rosa-claro rounded-xl p-3 text-sm text-beauty-text font-medium text-center">
                🕐 Apertura: {formatTime12(form.horario_inicio)} — Cierre: {formatTime12(form.horario_fin)}
                <span className="text-xs text-gray-500 block mt-0.5">
                  {calcSlots(form.horario_inicio, form.horario_fin)} slots de 30 min (servicio de 30 min)
                </span>
              </div>

              {/* Días */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Días laborales</label>
                <div className="flex gap-2 flex-wrap">
                  {DIAS.map(d => (
                    <button key={d.num} type="button" onClick={() => toggleDia(d.num)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        diasSelected.includes(d.num)
                          ? 'bg-beauty-secondary text-beauty-text shadow-beauty'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp (para notificaciones)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+57</span>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                    className="input-beauty pl-10"
                    placeholder="3001234567"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Número donde recibirá alertas de nuevas citas</p>
              </div>

              {/* Notificaciones */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer"
                onClick={() => setForm(f => ({ ...f, notificaciones: !f.notificaciones }))}>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${form.notificaciones ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.notificaciones ? 'left-5' : 'left-1'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 cursor-pointer">
                    {form.notificaciones ? '🔔 Recibe notificaciones de nuevas citas' : '🔕 Notificaciones desactivadas'}
                  </p>
                  <p className="text-xs text-gray-400">El sistema le enviará un WhatsApp al confirmar cada cita</p>
                </div>
              </div>

              {/* Activo */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer"
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${form.activo ? 'bg-beauty-primary' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.activo ? 'left-5' : 'left-1'}`} />
                </div>
                <label className="text-sm font-medium text-gray-700 cursor-pointer">
                  {form.activo ? 'Activa — visible para el bot y clientes' : 'Inactiva — no aparece en el bot'}
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm}
                  className="flex-1 border-2 border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 btn-beauty justify-center py-3 disabled:opacity-50">
                  {saving ? 'Guardando...' : <><Save size={16} />{editingId ? 'Guardar cambios' : 'Crear especialista'}</>}
                </button>
              </div>
              {/* Eliminar especialista */}
              {editingId && (
                <button type="button" onClick={handleEliminarEspecialista} disabled={saving}
                  className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 py-2 rounded-xl transition-colors border border-red-200">
                  🗑️ Eliminar especialista permanentemente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
