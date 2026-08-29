import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

/**
 * DELETE /api/especialistas/eliminar-usuario
 * Rollback: elimina un usuario de Auth si la creación del especialista falló.
 * Solo admins pueden llamar este endpoint.
 */
export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()

  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

    const supabase = await createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      console.error('[eliminar-usuario] Error rollback:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[eliminar-usuario]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
