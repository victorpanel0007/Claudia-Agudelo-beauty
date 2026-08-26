import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

/**
 * POST /api/especialistas/crear-usuario
 * Crea un usuario en Supabase Auth para una especialista recién creada.
 * Solo admins pueden llamar este endpoint.
 */
export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()

  try {
    const { email, password, nombre, especialista_id } = await request.json()

    if (!email || !password || !nombre || !especialista_id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Crear usuario en Supabase Auth
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
