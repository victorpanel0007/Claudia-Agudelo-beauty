import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const rol = await getUserRole()
  if (!rol) return forbidden('No autorizado')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('clientes')
    .select('id, nombre, telefono')
    .order('nombre')

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
  }

  const { data, error } = await query.limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
