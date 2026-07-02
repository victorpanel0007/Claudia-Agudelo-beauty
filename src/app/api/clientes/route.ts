import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  // Solo admin puede listar clientes con datos completos
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden acceder a los datos de clientes')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')

  let query = supabase
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true })

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,telefono.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden crear clientes')

  const supabase = await createAdminClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('clientes')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden editar clientes')

  const supabase = await createAdminClient()
  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('clientes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
