/**
 * Cliente Supabase — conexión única y reutilizable.
 *
 * Se conecta a LA MISMA instancia de Supabase que usa el SPA en Vercel.
 * Usa SUPABASE_SERVICE_ROLE_KEY para acceso total (solo backend, nunca frontend).
 *
 * NO crea tablas. NO modifica tablas. Solo consume las existentes.
 *
 * Tablas disponibles (heredadas del SPA):
 *   citas, clientes, especialistas, servicios, categorias,
 *   gastos, pagos_especialistas, comisiones_config, liquidaciones,
 *   conversaciones_bot, mensajes_whatsapp, bot_pausas,
 *   notificaciones_especialista, config_recordatorios
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env'
import { supabaseLog } from '../config/logger'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client

  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession:  false,
      autoRefreshToken: false,
    },
  })

  supabaseLog.info(
    { url: env.SUPABASE_URL.slice(0, 40) + '...' },
    '[Supabase] Conexion inicializada — misma BD que el SPA'
  )
  return _client
}

/** Verificar conectividad con Supabase */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const sb = getSupabase()
    const { error } = await sb.from('especialistas').select('id').limit(1)
    if (error) {
      supabaseLog.error({ error: error.message }, '[Supabase] Error de conexion')
      return false
    }
    supabaseLog.info('[Supabase] Conexion verificada correctamente')
    return true
  } catch (err) {
    supabaseLog.error({ err: (err as Error).message }, '[Supabase] Error inesperado')
    return false
  }
}
