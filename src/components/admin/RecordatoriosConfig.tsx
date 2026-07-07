'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Save, RefreshCw, Play, CheckCircle, XCircle, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface Config {
  id: number
  activo: boolean
  recordatorio_24h: boolean
  recordatorio_2h: boolean
  notificar_especialista: boolean
  mensaje_24h: string | null
  mensaje_2h: string | null
}

const MENSAJE_24H_DEFAULT = `⏰ *Recordatorio de cita*

Hola *{cliente}* 👋

Te recordamos que tienes una cita *mañana*:

💅 Servicio: *{servicio}*
👩 Especialista: *{especialista}*
📅 Fecha: *{fecha}*
⏰ Hora: *{hora}*

Te esperamos en *Claudia Agudelo Beauty* 💖

¿Necesitas reprogramar? Escríbenos 😊`

const MENSAJE_2H_DEFAULT = `⏰ *Recordatorio de cita*

Hola *{cliente}* 👋

Te recordamos que tienes una cita *en 2 horas*:

💅 Servicio: *{servicio}*
👩 Especialista: *{especialista}*
📅 Fecha: *{fecha}*
⏰ Hora: *{hora}*

Te esperamos en *Claudia Agudelo Beauty* 💖`

function Toggle({ value, onChange, label, desc }: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
  desc?: string
}) {
  return (
    <div
      className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer select-none"
      onClick={() => onChange(!value)}
    >
      <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${value ? 'bg-beauty-primary' : 'bg-gray-300'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-5' : 'left-1'}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-beauty-text">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
    </div>
  )
}

export default function RecordatoriosConfig() {
  const supabase = createClient()
  const [config, setConfig] = useState<Config>({
    id: 1,
    activo: true,
    recordatorio_24h: true,
    recordatorio_2h: true,
    notificar_especialista: false,
    mensaje_24h: null,
    mensaje_2h: null,
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [tab, setTab]           = useState<'config' | 'mensajes'>('config')

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('config_recordatorios')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (data) setConfig(data as Config)
    setLoading(false)
  }

  async function saveConfig() {
    setSaving(true)
    const { error } = await supabase
      .from('config_recordatorios')
      .upsert(config, { onConflict: 'id' })

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      toast.success('✅ Configuración guardada')
    }
    setSaving(false)
  }

  async function runManual() {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/test-reminders', { method: 'POST' })
      const data = await res.json()
      if (data.skipped) {
        toast('Recordatorios desactivados — actívalos primero', { icon: '⚠️' })
      } else {
        toast.success(`✅ Ejecutado: ${data.sent} enviados, ${data.failed} fallidos`)
      }
    } catch {
      toast.error('Error al ejecutar')
    }
    setTesting(false)
  }

  function upd(key: keyof Config, value: unknown) {
    setConfig(c => ({ ...c, [key]: value }))
  }

  if (loading) {
    return <div className="beauty-card p-8 text-center text-gray-400">Cargando...</div>
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-text flex items-center gap-2">
            <Bell size={22} className="text-beauty-borgona" />
            Recordatorios automáticos
          </h2>
          <p className="text-gray-500 text-sm">Configura cuándo y cómo se envían los recordatorios de cita</p>
        </div>
        <button
          onClick={runManual}
          disabled={testing}
          className="flex items-center gap-2 bg-beauty-secondary/20 text-beauty-secondary text-sm font-semibold px-4 py-2 rounded-xl hover:bg-beauty-secondary/30 transition-colors disabled:opacity-50"
          title="Ejecutar manualmente ahora"
        >
          {testing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          Probar ahora
        </button>
      </div>

      {/* Info cron */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold mb-1">¿Cómo funciona?</p>
          <p>Vercel ejecuta automáticamente el cron cada 5 minutos. El sistema busca citas con estado <strong>Confirmada</strong> cuya hora coincida con ±15 minutos del objetivo (2h o 24h antes) y que aún no hayan recibido el recordatorio.</p>
          <p className="mt-1">Variables disponibles en los mensajes: <code className="bg-blue-100 px-1 rounded">{'{cliente}'}</code> <code className="bg-blue-100 px-1 rounded">{'{servicio}'}</code> <code className="bg-blue-100 px-1 rounded">{'{especialista}'}</code> <code className="bg-blue-100 px-1 rounded">{'{fecha}'}</code> <code className="bg-blue-100 px-1 rounded">{'{hora}'}</code></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['config', 'mensajes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize ${
              tab === t ? 'border-beauty-primary text-beauty-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t === 'config' ? 'Configuración' : 'Mensajes'}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="beauty-card p-5 space-y-4">

          {/* Master switch */}
          <Toggle
            value={config.activo}
            onChange={v => upd('activo', v)}
            label={config.activo ? '🔔 Recordatorios activados' : '🔕 Recordatorios desactivados'}
            desc="Activa o desactiva todo el sistema de recordatorios"
          />

          <div className={`space-y-3 transition-opacity ${config.activo ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Cuándo enviar?</p>

            <Toggle
              value={config.recordatorio_24h}
              onChange={v => upd('recordatorio_24h', v)}
              label="Recordatorio 24 horas antes"
              desc="Se envía al cliente el día anterior a la cita"
            />

            <Toggle
              value={config.recordatorio_2h}
              onChange={v => upd('recordatorio_2h', v)}
              label="Recordatorio 2 horas antes"
              desc="Se envía al cliente el mismo día, 2 horas antes"
            />

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">¿A quién notificar?</p>

              <Toggle
                value={config.notificar_especialista}
                onChange={v => upd('notificar_especialista', v)}
                label="Notificar también a la especialista"
                desc="Le enviará un recordatorio de la cita a la especialista asignada"
              />
            </div>
          </div>

          {/* Estado visual */}
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${
            config.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {config.activo
              ? <><CheckCircle size={16} /> Sistema activo — {[config.recordatorio_24h && '24h', config.recordatorio_2h && '2h'].filter(Boolean).join(' y ')} antes de cada cita</>
              : <><XCircle size={16} /> Sistema desactivado — no se enviarán recordatorios</>
            }
          </div>
        </div>
      )}

      {tab === 'mensajes' && (
        <div className="space-y-4">
          {/* Mensaje 24h */}
          {config.recordatorio_24h && (
            <div className="beauty-card p-5">
              <p className="text-sm font-semibold text-beauty-text mb-1">Mensaje recordatorio 24h</p>
              <p className="text-xs text-gray-400 mb-3">Déjalo vacío para usar el mensaje predeterminado</p>
              <textarea
                value={config.mensaje_24h ?? ''}
                onChange={e => upd('mensaje_24h', e.target.value || null)}
                placeholder={MENSAJE_24H_DEFAULT}
                rows={10}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-beauty-primary resize-none"
              />
              <button
                onClick={() => upd('mensaje_24h', null)}
                className="text-xs text-gray-400 hover:text-red-500 mt-1 transition-colors"
              >
                Restaurar mensaje predeterminado
              </button>
            </div>
          )}

          {/* Mensaje 2h */}
          {config.recordatorio_2h && (
            <div className="beauty-card p-5">
              <p className="text-sm font-semibold text-beauty-text mb-1">Mensaje recordatorio 2h</p>
              <p className="text-xs text-gray-400 mb-3">Déjalo vacío para usar el mensaje predeterminado</p>
              <textarea
                value={config.mensaje_2h ?? ''}
                onChange={e => upd('mensaje_2h', e.target.value || null)}
                placeholder={MENSAJE_2H_DEFAULT}
                rows={8}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-beauty-primary resize-none"
              />
              <button
                onClick={() => upd('mensaje_2h', null)}
                className="text-xs text-gray-400 hover:text-red-500 mt-1 transition-colors"
              >
                Restaurar mensaje predeterminado
              </button>
            </div>
          )}

          {!config.recordatorio_24h && !config.recordatorio_2h && (
            <div className="beauty-card p-8 text-center text-gray-400 text-sm">
              Activa al menos un recordatorio en la pestaña Configuración para personalizar los mensajes.
            </div>
          )}
        </div>
      )}

      {/* Guardar */}
      <button
        onClick={saveConfig}
        disabled={saving}
        className="btn-beauty w-full justify-center py-3 disabled:opacity-50"
      >
        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
