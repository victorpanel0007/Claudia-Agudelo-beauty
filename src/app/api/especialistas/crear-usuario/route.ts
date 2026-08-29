import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

/**
 * POST /api/especialistas/crear-usuario
 *
 * Dos modos de uso:
 *
 * MODO A (legado, creación directa):
 *   Body: { email, password, nombre, especialista_id }
 *   Crea el usuario Auth y lo vincula al especialista de una vez.
 *
 * MODO B (nuevo flujo transaccional, PASO 3):
 *   Body: { email, password, nombre, especialista_id, existing_user_id }
 *   El usuario ya fue creado en el PASO 1. Solo actualiza sus metadatos
 *   para añadir el especialista_id correcto.
 *
 * Solo admins pueden llamar este endpoint.
 */
export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()

  try {
    const { email, password, nombre, especialista_id, existing_user_id } = await request.json()

    if (!email || !nombre || !especialista_id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // MODO B: usuario ya existe, solo actualizar metadatos con especialista_id
    if (existing_user_id) {
      const { error } = await supabase.auth.admin.updateUserById(existing_user_id, {
        user_metadata: {
          rol:             'especialista',
          nombre,
          especialista_id,
        },
      })
      if (error) {
        console.error('[crear-usuario] Error actualizando metadatos:', error.message)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, userId: existing_user_id })
    }

    // MODO A (legado): crear usuario desde cero
    if (!password) {
      return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        rol:             'especialista',
        nombre,
        especialista_id,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, userId: data.user.id })
  } catch (err) {
    console.error('[crear-usuario]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
