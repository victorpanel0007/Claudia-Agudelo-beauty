/**
 * RBAC — Role Based Access Control
 * Sistema de permisos escalable para Claudia Agudelo Beauty
 */

import { createAdminClient } from './supabase/server'
import { createClient } from './supabase/server'
import { NextResponse } from 'next/server'

// ── Definición de Roles ──────────────────────────────────────────────────
export type UserRole = 'admin' | 'especialista'

// ── Permisos por recurso ──────────────────────────────────────────────────
export const PERMISSIONS: Record<UserRole, {
  verContactoCliente: boolean
  verHistorialCliente: boolean
  verPagos: boolean
  verNotasInternas: boolean
  verTelefonoEnWhatsapp: boolean
  editarClientes: boolean
  cancelarCitas: boolean
  exportarDatos: boolean
  gestionarEspecialistas: boolean
  verReportes: boolean
  verComisiones: boolean
}> = {
  admin: {
    verContactoCliente:    true,
    verHistorialCliente:   true,
    verPagos:              true,
    verNotasInternas:      true,
    verTelefonoEnWhatsapp: true,
    editarClientes:        true,
    cancelarCitas:         true,
    exportarDatos:         true,
    gestionarEspecialistas:true,
    verReportes:           true,
    verComisiones:         true,
  },
  especialista: {
    verContactoCliente:    false,
    verHistorialCliente:   false,
    verPagos:              false,
    verNotasInternas:      false,
    verTelefonoEnWhatsapp: false,
    editarClientes:        false,
    cancelarCitas:         false,
    exportarDatos:         false,
    gestionarEspecialistas:false,
    verReportes:           false,
    verComisiones:         false,
  },
}

// ── Obtener rol del usuario actual ────────────────────────────────────────
export async function getUserRole(): Promise<UserRole | null> {
  try {
    // Usar createClient (anon key + cookies) para leer la sesión del usuario logueado.
    // createAdminClient usa service_role y NO lee las cookies de sesión correctamente.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const rol = user.user_metadata?.rol as UserRole | undefined
    return rol ?? 'especialista'
  } catch {
    return null
  }
}

// ── Verificar permiso específico ──────────────────────────────────────────
export async function hasPermission(
  permiso: keyof typeof PERMISSIONS.admin
): Promise<boolean> {
  const rol = await getUserRole()
  if (!rol) return false
  return PERMISSIONS[rol]?.[permiso] ?? false
}

// ── Respuesta 403 estándar ────────────────────────────────────────────────
export function forbidden(mensaje = 'Acceso denegado') {
  return NextResponse.json({ error: mensaje }, { status: 403 })
}

// ── Filtrar datos de cliente según rol ───────────────────────────────────
export function filtrarCliente<T extends {
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  notas?: string | null
}>(cliente: T, rol: UserRole): Omit<T, 'telefono' | 'email' | 'direccion'> & {
  telefono?: string | null
  email?: string | null
  direccion?: string | null
} {
  if (rol === 'admin') return cliente
  // Especialista: ocultar datos de contacto
  return {
    ...cliente,
    telefono: undefined,
    email:    undefined,
    direccion: undefined,
    notas:    undefined,
  }
}

// ── Filtrar cita según rol ────────────────────────────────────────────────
export function filtrarCita(cita: Record<string, unknown>, rol: UserRole): Record<string, unknown> {
  if (rol === 'admin') return cita

  // Especialista solo ve lo necesario para atender
  const allowed = new Set([
    'id', 'fecha_inicio', 'fecha_fin', 'estado',
    'observaciones', 'servicio', 'especialista',
  ])

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(cita)) {
    if (allowed.has(key)) {
      // Para el cliente, solo mostrar nombre
      if (key === 'cliente' && cita[key] && typeof cita[key] === 'object') {
        const cl = cita[key] as Record<string, unknown>
        result[key] = { nombre: cl.nombre }
      } else {
        result[key] = cita[key]
      }
    }
  }
  return result
}
