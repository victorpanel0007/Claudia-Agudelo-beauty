import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('comisiones_config')
    .select('*, especialista:especialistas(id, nombre)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()
  const { especialista_id, porcentaje } = await request.json()

  const { data, error } = await supabase
    .from('comisiones_config')
    .upsert({ especialista_id, porcentaje }, { onConflict: 'especialista_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
