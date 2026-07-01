import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { reenviarNotificacion } from '@/lib/notificaciones'

export async function GET(request: NextRequest) {
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const especialistaId = searchParams.get('especialista_id')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const buscar = searchParams.get('buscar')

  let query = supabase
    .from('notificaciones_especialista')
    .select('*, cita:citas(id, cliente:clientes(nombre, telefono))')
    .order('created_at', { ascending: false })
    .limit(200)

  if (estado) query = query.eq('estado', estado)
  if (especialistaId) query = query.eq('especialista_id', especialistaId)
  if (desde) query = query.gte('created_at', desde)
  if (hasta) query = query.lte('created_at', hasta)
  if (buscar) query = query.or(`especialista_nombre.ilike.%${buscar}%,whatsapp_destino.ilike.%${buscar}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const ok = await reenviarNotificacion(id, supabase)
  return NextResponse.json({ ok })
}
