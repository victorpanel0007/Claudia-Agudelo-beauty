import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

/**
 * POST /api/especialistas/crear-usuario-temp
 * PASO 1 del flujo de creación: crea el usuario en Supabase Auth.
 * Devuelve el userId para usarlo como ID del especialista en la tabla.
 * Solo admins pueden llamar este endpoint.
 */
export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()

  try {
    const { email, password, nombre } = await request.json()

    if (!email || !password || !nombre) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verificar si ya existe un usuario con ese email
    const { data: existing } = await supabase.auth.admin.listUsers()
    const yaExiste = existing?.users?.some(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    )
    if (yaExiste) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese correo electrónico' }, { status: 409 })
    }

    // Crear usuario en Supabase Auth
    // El especialista_id se añade en el paso 2 (cuando tengamos el ID de la tabla)
    const { data, error } = await supabase.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        rol:    'especialista',
        nombre,
        // especialista_id se actualiza en /api/especialistas/crear-usuario
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, userId: data.user.id })
  } catch (err) {
    console.error('[crear-usuario-temp]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
