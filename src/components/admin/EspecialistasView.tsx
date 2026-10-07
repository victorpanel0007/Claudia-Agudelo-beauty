'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Plus, Edit, Save, X, CheckCircle, XCircle, User, Send, RefreshCw, Wifi, WifiOff, Trash2, Coffee, CalendarX, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'

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
  // Credenciales de acceso al panel especialista (solo al crear)
  email: string
  password: string
}

interface Descanso {
  id?: string
  hora_inicio: string
  hora_fin: string
}

interface DiaBloqueado {
  id?: string
  fecha: string   // YYYY-MM-DD
  motivo?: string
}

interface HorarioDia {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
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
  email: '',
  password: '',
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
  // Descansos del especialista que se está editando
  const [descansos, setDescansos] = useState<Descanso[]>([])
  const [savingDescansos, setSavingDescansos] = useState(false)
  // Mapa de descansos por especialista_id para mostrar en las tarjetas
  const [descansosMap, setDescansosMap] = useState<Record<string, Descanso[]>>({})
  // Días bloqueados del especialista que se está editando
  const [diasBloqueados, setDiasBloqueados] = useState<DiaBloqueado[]>([])
  // Mapa de días bloqueados por especialista_id para mostrar en tarjetas
  const [diasBloqueadosMap, setDiasBloqueadosMap] = useState<Record<string, DiaBloqueado[]>>({})
  // Estado del mini-calendario de días bloqueados
  const [calMes, setCalMes] = useState(() => {
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })
  // Horarios específicos por día
  const [horariosPorDia, setHorariosPorDia] = useState<HorarioDia[]>([])
  // Mapa de horarios por especialista_id para mostrar en tarjetas
  const [horariosPorDiaMap, setHorariosPorDiaMap] = useState<Record<string, HorarioDia[]>>({})
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
    const [{ data }, { data: descData }, { data: diasBlData }, { data: horariosData }] = await Promise.all([
      supabase.from('especialistas').select('*').order('nombre'),
      supabase.from('descansos_especialista').select('especialista_id, hora_inicio, hora_fin').order('hora_inicio'),
      supabase.from('dias_bloqueados_especialista').select('especialista_id, fecha, motivo').order('fecha'),
      supabase.from('horarios_especialista').select('especialista_id, dia_semana, hora_inicio, hora_fin, activo').order('dia_semana'),
    ])
    setEspecialistas((data as Especialista[]) || [])
    // Construir mapa especialista_id → descansos
    const map: Record<string, Descanso[]> = {}
    for (const d of descData || []) {
      const key = d.especialista_id as string
      if (!map[key]) map[key] = []
      map[key].push({ hora_inicio: d.hora_inicio as string, hora_fin: d.hora_fin as string })
    }
    setDescansosMap(map)
    // Construir mapa especialista_id → días bloqueados
    const dbMap: Record<string, DiaBloqueado[]> = {}
    for (const d of diasBlData || []) {
      const key = d.especialista_id as string
      if (!dbMap[key]) dbMap[key] = []
      dbMap[key].push({ fecha: d.fecha as string, motivo: d.motivo as string | undefined })
    }
    setDiasBloqueadosMap(dbMap)
    // Construir mapa especialista_id → horarios por día
    const hMap: Record<string, HorarioDia[]> = {}
    for (const h of horariosData || []) {
      const key = h.especialista_id as string
      if (!hMap[key]) hMap[key] = []
      hMap[key].push({
        dia_semana: h.dia_semana as number,
        hora_inicio: h.hora_inicio as string,
        hora_fin: h.hora_fin as string,
        activo: h.activo as boolean,
      })
    }
    setHorariosPorDiaMap(hMap)
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
      email:           '',
      password:        '',
    })
    // Cargar descansos existentes
    supabase
      .from('descansos_especialista')
      .select('id, hora_inicio, hora_fin')
      .eq('especialista_id', e.id)
      .order('hora_inicio')
      .then(({ data }) => setDescansos((data as Descanso[]) || []))
    // Cargar días bloqueados existentes
    supabase
      .from('dias_bloqueados_especialista')
      .select('id, fecha, motivo')
      .eq('especialista_id', e.id)
      .order('fecha')
      .then(({ data }) => setDiasBloqueados((data as DiaBloqueado[]) || []))
    // Cargar horarios por día existentes
    supabase
      .from('horarios_especialista')
      .select('dia_semana, hora_inicio, hora_fin, activo')
      .eq('especialista_id', e.id)
      .order('dia_semana')
      .then(({ data }) => setHorariosPorDia((data as HorarioDia[]) || []))
    // Resetear calendario al mes actual
    const hoy = new Date()
    setCalMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    setShowForm(true)
  }

  function openNew() {
    setEditingId(null)
    setDiasSelected([1, 2, 3, 4, 5, 6])
    setForm(DEFAULT_FORM)
    setDescansos([])
    setDiasBloqueados([])
    setHorariosPorDia([])
    const hoy = new Date()
    setCalMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setDescansos([])
    setDiasBloqueados([])
    setHorariosPorDia([])
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

    // Validar credenciales si se están creando (no editando)
    if (!editingId) {
      if (!form.email.trim()) { toast.error('El correo es requerido para crear una especialista'); return }
      if (!form.password.trim()) { toast.error('La contraseña es requerida para crear una especialista'); return }
      if (form.password.trim().length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email.trim())) { toast.error('El correo no tiene un formato válido'); return }
    }

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
      // ── EDITAR especialista existente ───────────────────────────────────
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
        await saveDescansos(editingId)
        await saveDiasBloqueados(editingId)
        await saveHorariosPorDia(editingId)
        toast.success(`✅ ${form.nombre} actualizada correctamente`)
        closeForm()
        loadData()
      }
    } else {
      // ── CREAR nueva especialista ────────────────────────────────────────
      // PASO 1: Crear usuario en Supabase Auth PRIMERO (operación reversible)
      let authUserId: string | null = null
      try {
        const authRes = await fetch('/api/especialistas/crear-usuario-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:    form.email.trim().toLowerCase(),
            password: form.password.trim(),
            nombre:   form.nombre.trim(),
          }),
        })
        const authResult = await authRes.json()
        if (!authRes.ok) {
          toast.error(`Error al crear acceso: ${authResult.error}`)
          setSaving(false)
          return
        }
        authUserId = authResult.userId
      } catch {
        toast.error('Error de conexión al crear el acceso de la especialista')
        setSaving(false)
        return
      }

      // PASO 2: Crear registro en tabla especialistas con el ID del usuario Auth
      const { error: espError, data: newEsp } = await supabase
        .from('especialistas')
        .insert({ ...payload, id: authUserId ?? undefined })
        .select('id')
        .single()

      if (espError || !newEsp?.id) {
        // Si falla, eliminar el usuario Auth para no dejar cuentas huérfanas
        await fetch('/api/especialistas/eliminar-usuario', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authUserId }),
        }).catch(() => {})
        toast.error('Error al crear la especialista en la base de datos. El acceso fue revertido.')
        setSaving(false)
        return
      }

      // PASO 3: Actualizar el especialista_id en los metadatos del usuario Auth
      await fetch('/api/especialistas/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:           form.email.trim().toLowerCase(),
          password:        form.password.trim(),
          nombre:          form.nombre.trim(),
          especialista_id: newEsp.id,
          existing_user_id: authUserId,
        }),
      }).catch(() => {})

      // PASO 4: Guardar descansos y días bloqueados
      await saveDescansos(newEsp.id)
      await saveDiasBloqueados(newEsp.id)
      await saveHorariosPorDia(newEsp.id)

      toast.success(`✅ ${form.nombre} creada con acceso al Panel de Especialista`)
      closeForm()
      loadData()
    }
    setSaving(false)
  }

  // ── Días bloqueados helpers ──────────────────────────────────────────────
  function toggleDiaBloqueado(fechaStr: string) {
    const existe = diasBloqueados.some(d => d.fecha === fechaStr)
    if (existe) {
      setDiasBloqueados(prev => prev.filter(d => d.fecha !== fechaStr))
    } else {
      setDiasBloqueados(prev => [...prev, { fecha: fechaStr }].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    }
  }

  async function saveDiasBloqueados(especialistaId: string) {
    // Estrategia: eliminar todos los existentes y re-insertar
    await supabase.from('dias_bloqueados_especialista').delete().eq('especialista_id', especialistaId)
    if (diasBloqueados.length > 0) {
      const rows = diasBloqueados.map(d => ({
        especialista_id: especialistaId,
        fecha: d.fecha,
        motivo: d.motivo ?? null,
      }))
      await supabase.from('dias_bloqueados_especialista').insert(rows)
    }
  }

  // ── Horarios por día helpers ──────────────────────────────────────────────
  function toggleHorarioDia(dia: number) {
    const existe = horariosPorDia.find(h => h.dia_semana === dia)
    if (existe) {
      // Toggle activo/inactivo
      setHorariosPorDia(prev => prev.map(h =>
        h.dia_semana === dia ? { ...h, activo: !h.activo } : h
      ))
    } else {
      // Crear nuevo con horario por defecto
      setHorariosPorDia(prev => [...prev, {
        dia_semana: dia,
        hora_inicio: '09:00',
        hora_fin: '19:00',
        activo: true,
      }].sort((a, b) => a.dia_semana - b.dia_semana))
    }
  }

  function updateHorarioDia(dia: number, field: 'hora_inicio' | 'hora_fin', value: string) {
    setHorariosPorDia(prev => prev.map(h =>
      h.dia_semana === dia ? { ...h, [field]: value } : h
    ))
  }

  async function saveHorariosPorDia(especialistaId: string) {
    // Estrategia: eliminar todos los existentes y re-insertar
    await supabase.from('horarios_especialista').delete().eq('especialista_id', especialistaId)
    if (horariosPorDia.length > 0) {
      const rows = horariosPorDia.map(h => ({
        especialista_id: especialistaId,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        activo: h.activo,
      }))
      await supabase.from('horarios_especialista').insert(rows)
    }
  }

  // ── Descansos helpers ────────────────────────────────────────────────────
  function addDescanso() {
    setDescansos(prev => [...prev, { hora_inicio: '12:00', hora_fin: '13:00' }])
  }

  function removeDescanso(idx: number) {
    setDescansos(prev => prev.filter((_, i) => i !== idx))
  }

  function updateDescanso(idx: number, field: 'hora_inicio' | 'hora_fin', value: string) {
    setDescansos(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  async function saveDescansos(especialistaId: string) {
    setSavingDescansos(true)
    // Eliminar todos los descansos actuales y re-insertar
    await supabase.from('descansos_especialista').delete().eq('especialista_id', especialistaId)
    if (descansos.length > 0) {
      const rows = descansos
        .filter(d => d.hora_inicio < d.hora_fin)
        .map(d => ({ especialista_id: especialistaId, hora_inicio: d.hora_inicio, hora_fin: d.hora_fin }))
      if (rows.length > 0) {
        await supabase.from('descansos_especialista').insert(rows)
      }
    }
    setSavingDescansos(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-text flex items-center gap-2">
            <User size={22} className="text-beauty-secondary" />
            Especialistas
          </h2>
          <p className="text-gray-500 text-sm">Gestiona horarios y disponibilidad</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicador estado Evolution API */}
          {waStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> WhatsApp 🟢
            </span>
          ) : waStatus === 'disconnected' ? (
            <span
              onClick={checkWaStatus}
              className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer hover:bg-red-200 transition-colors"
              title="Haz clic para reintentar"
            >
              <span className="w-2 h-2 bg-red-500 rounded-full" /> WhatsApp 🔴
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

                {/* Horarios por día — si existen */}
                {horariosPorDiaMap[e.id]?.filter(h => h.activo).length > 0 ? (
                  <div className="bg-beauty-primary/5 border border-beauty-primary/20 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock size={13} className="text-beauty-primary" />
                      <p className="text-xs font-semibold text-beauty-primary">Horario por día</p>
                    </div>
                    <div className="space-y-1">
                      {horariosPorDiaMap[e.id]
                        .filter(h => h.activo)
                        .sort((a, b) => a.dia_semana - b.dia_semana)
                        .map((h, i) => {
                          const dia = DIAS.find(d => d.num === h.dia_semana)
                          return (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-gray-600 w-8">{dia?.short}</span>
                              <span className="text-gray-500">{formatTime12(h.hora_inicio)} – {formatTime12(h.hora_fin)}</span>
                              <span className="text-gray-400">{calcSlots(h.hora_inicio, h.hora_fin)} slots</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-beauty-rosa-claro rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Horario de atención</p>
                    <p className="text-beauty-text text-sm font-medium">
                      {formatTime12(e.horario_inicio)} — {formatTime12(e.horario_fin)}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {calcSlots(e.horario_inicio, e.horario_fin)} slots de 30 min (horario global)
                    </p>
                  </div>
                )}

                {/* Descansos configurados */}
                {descansosMap[e.id]?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Coffee size={13} className="text-amber-500" />
                      <p className="text-xs font-semibold text-amber-700">Descansos</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {descansosMap[e.id].map((d, i) => (
                        <span key={i} className="text-[10px] bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                          {formatTime12(d.hora_inicio)} – {formatTime12(d.hora_fin)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Días bloqueados (próximos) */}
                {diasBloqueadosMap[e.id]?.length > 0 && (() => {
                  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
                  const proximos = diasBloqueadosMap[e.id]
                    .filter(d => d.fecha >= hoyStr)
                    .slice(0, 3)
                  if (!proximos.length) return null
                  return (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <CalendarX size={13} className="text-red-500" />
                        <p className="text-xs font-semibold text-red-700">Días no disponibles</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {proximos.map((d, i) => (
                          <span key={i} className="text-[10px] bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                            🔴 {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </span>
                        ))}
                        {diasBloqueadosMap[e.id].filter(d => d.fecha >= hoyStr).length > 3 && (
                          <span className="text-[10px] text-red-400 font-medium px-2 py-0.5">
                            +{diasBloqueadosMap[e.id].filter(d => d.fecha >= hoyStr).length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}

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
      <Modal open={showForm} onClose={closeForm}>
        <Modal.Header
          title={editingId ? 'Editar especialista' : 'Nueva Especialista'}
          onClose={closeForm}
        />
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

              {/* ── Horarios por día (nuevo) + fallback global ──────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-beauty-secondary" />
                  <label className="text-sm font-medium text-gray-700">Horario por día de la semana</label>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Configura la apertura y cierre de cada día por separado.
                  Si no configuras un día específico, usa el horario global de abajo como fallback.
                </p>
                <div className="space-y-2">
                  {DIAS.map(d => {
                    const horario = horariosPorDia.find(h => h.dia_semana === d.num)
                    const tieneHorario = !!horario
                    const estaActivo = horario?.activo ?? false

                    return (
                      <div key={d.num} className={`rounded-xl border transition-all ${
                        tieneHorario && estaActivo
                          ? 'border-beauty-primary/40 bg-beauty-primary/5'
                          : tieneHorario && !estaActivo
                            ? 'border-gray-200 bg-gray-50 opacity-60'
                            : 'border-dashed border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-center gap-3 p-3">
                          {/* Toggle día */}
                          <button
                            type="button"
                            onClick={() => toggleHorarioDia(d.num)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                              tieneHorario && estaActivo
                                ? 'bg-beauty-secondary text-beauty-text'
                                : tieneHorario && !estaActivo
                                  ? 'bg-gray-200 text-gray-400'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {d.short}
                          </button>

                          <span className={`text-xs font-semibold w-12 shrink-0 ${
                            tieneHorario && estaActivo ? 'text-gray-700' : 'text-gray-400'
                          }`}>
                            {d.label}
                          </span>

                          {tieneHorario ? (
                            <>
                              <select
                                value={horario.hora_inicio}
                                onChange={e => updateHorarioDia(d.num, 'hora_inicio', e.target.value)}
                                disabled={!estaActivo}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-beauty-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                              </select>
                              <span className="text-xs text-gray-400 shrink-0">–</span>
                              <select
                                value={horario.hora_fin}
                                onChange={e => updateHorarioDia(d.num, 'hora_fin', e.target.value)}
                                disabled={!estaActivo}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-beauty-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                              </select>
                              {/* Quitar configuración específica */}
                              <button
                                type="button"
                                onClick={() => setHorariosPorDia(prev => prev.filter(h => h.dia_semana !== d.num))}
                                className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                title="Usar horario global"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleHorarioDia(d.num)}
                              className="text-xs text-beauty-secondary hover:underline ml-1"
                            >
                              + Configurar este día
                            </button>
                          )}
                        </div>
                        {tieneHorario && estaActivo && (
                          <div className="px-3 pb-2">
                            <p className="text-[10px] text-gray-400">
                              {calcSlots(horario.hora_inicio, horario.hora_fin)} slots de 30 min
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {horariosPorDia.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center bg-gray-50 rounded-xl p-3">
                    Sin horarios específicos — se usará el horario global para todos los días laborales
                  </p>
                )}
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

              {/* ── Descansos ─────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Coffee size={14} className="text-beauty-secondary" />
                    Descansos / Breaks
                  </label>
                  <button type="button" onClick={addDescanso}
                    className="flex items-center gap-1 text-xs text-beauty-secondary border border-beauty-secondary/40 px-2.5 py-1.5 rounded-lg hover:bg-beauty-rosa-claro transition-colors">
                    <Plus size={12} /> Agregar
                  </button>
                </div>
                {descansos.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 text-center">
                    Sin descansos configurados — el bot no bloqueará ninguna franja horaria
                  </p>
                ) : (
                  <div className="space-y-2">
                    {descansos.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <Coffee size={14} className="text-amber-500 shrink-0" />
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={d.hora_inicio}
                            onChange={e => updateDescanso(i, 'hora_inicio', e.target.value)}
                            className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                          </select>
                          <span className="text-xs text-gray-500 shrink-0">a</span>
                          <select
                            value={d.hora_fin}
                            onChange={e => updateDescanso(i, 'hora_fin', e.target.value)}
                            className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                          </select>
                        </div>
                        <button type="button" onClick={() => removeDescanso(i)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 mt-1">
                      ℹ️ El bot no ofrecerá horarios que se superpongan con estos descansos.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Días bloqueados (fechas específicas) ──────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarX size={14} className="text-red-500" />
                  <label className="text-sm font-medium text-gray-700">Días no disponibles</label>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Selecciona los días en que esta especialista no estará disponible (vacaciones, permisos, etc.).
                  Estos días se bloquean aunque sean días laborales habituales.
                </p>

                {/* Mini calendario */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Cabecera del mes */}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() => setCalMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                      className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-semibold text-gray-700 capitalize">
                      {calMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCalMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                      className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => (
                      <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1.5">{d}</div>
                    ))}
                  </div>

                  {/* Celdas del calendario */}
                  <div className="grid grid-cols-7 p-1.5 gap-0.5">
                    {(() => {
                      const year = calMes.getFullYear()
                      const month = calMes.getMonth()
                      const firstDay = new Date(year, month, 1).getDay() // 0=Dom
                      // Convertir: semana empieza en Lunes (1=Lun … 0=Dom→7)
                      const offset = firstDay === 0 ? 6 : firstDay - 1
                      const daysInMonth = new Date(year, month + 1, 0).getDate()
                      const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

                      const cells: React.ReactNode[] = []

                      // Celdas vacías al inicio
                      for (let i = 0; i < offset; i++) {
                        cells.push(<div key={`empty-${i}`} />)
                      }

                      for (let d = 1; d <= daysInMonth; d++) {
                        const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const bloqueado = diasBloqueados.some(db => db.fecha === fechaStr)
                        const esPasado = fechaStr < hoyStr

                        cells.push(
                          <button
                            key={fechaStr}
                            type="button"
                            onClick={() => !esPasado && toggleDiaBloqueado(fechaStr)}
                            disabled={esPasado}
                            className={`
                              w-full aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center
                              ${bloqueado
                                ? 'bg-red-500 text-white shadow-sm'
                                : esPasado
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'hover:bg-red-50 hover:text-red-600 text-gray-600'
                              }
                            `}
                          >
                            {d}
                          </button>
                        )
                      }

                      return cells
                    })()}
                  </div>
                </div>

                {/* Lista de días bloqueados */}
                {diasBloqueados.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Días bloqueados</p>
                    {diasBloqueados.map(db => (
                      <div key={db.fecha} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 text-xs">🔴</span>
                          <span className="text-xs font-medium text-red-700">
                            {new Date(db.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDiasBloqueados(prev => prev.filter(d => d.fecha !== db.fecha))}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 text-center mt-3">
                    Sin días bloqueados — la especialista trabaja todos sus días laborales normalmente
                  </p>
                )}
              </div>

              {/* Credenciales de acceso — solo al crear nueva especialista */}
              {!editingId && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-700">🔑 Acceso al panel de especialista (opcional)</p>
                  <p className="text-xs text-blue-600">Si completas estos campos, la especialista podrá iniciar sesión en su panel personal.</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="input-beauty"
                      placeholder="especialista@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="input-beauty"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>
              )}

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
      </Modal>
    </div>
  )
}
