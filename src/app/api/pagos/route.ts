import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Acceso restringido a administradores')
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const especialistaId = searchParams.get('especialista_id')

  let q = supabase.from('pagos_especialistas').select('*').order('fecha', { ascending: false })
  if (especialistaId) q = q.eq('especialista_id', especialistaId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Acceso restringido a administradores')
  const supabase = await createAdminClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('pagos_especialistas')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
