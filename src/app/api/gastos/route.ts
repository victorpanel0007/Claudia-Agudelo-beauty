import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  // GET: requiere al menos estar autenticado (admin o especialista con acceso a reportes)
  const rol = await getUserRole()
  if (!rol) return forbidden('Debes iniciar sesión')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')
  const id    = searchParams.get('id')

  // Si piden un id específico
  if (id) {
    const { data, error } = await supabase.from('gastos').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  let q = supabase
    .from('gastos')
    .select('id,fecha,descripcion,valor,categoria')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (start) q = q.gte('fecha', start)
  if (end)   q = q.lte('fecha', end)

  const { data, error } = await q
  if (error) {
    console.error('[GET /api/gastos] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden registrar movimientos')

  const supabase = await createAdminClient()
  let body: Record<string, unknown>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const { fecha, categoria, descripcion, valor } = body

  if (!fecha)       return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })
  if (!descripcion) return NextResponse.json({ error: 'descripcion requerida' }, { status: 400 })
  if (!valor || Number(valor) <= 0) return NextResponse.json({ error: 'valor debe ser mayor a 0' }, { status: 400 })

  const { data, error } = await supabase
    .from('gastos')
    .insert({
      fecha,
      categoria: categoria ?? 'Otros',
      descripcion,
      valor: Number(valor),
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/gastos] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden eliminar movimientos')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) {
    console.error('[DELETE /api/gastos] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
