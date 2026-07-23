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

  // 1. Registrar el pago
  const { data: pago, error } = await supabase
    .from('pagos_especialistas')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. Marcar citas del período como pagadas ─────────────────────────────
  // Si se pasan fecha_inicio_periodo / fecha_fin_periodo las usamos;
  // si no, usamos la fecha del pago como referencia puntual.
  try {
    const espId     = body.especialista_id as string | undefined
    const periodoIni = (body.fecha_inicio_periodo as string | undefined) ?? (body.fecha as string)
    const periodoFin = (body.fecha_fin_periodo   as string | undefined) ?? (body.fecha as string)

    if (espId && periodoIni && periodoFin) {
      const startTs = `${periodoIni}T00:00:00-05:00`
      const endTs   = `${periodoFin}T23:59:59-05:00`

      // Marcar todas las comisiones pendientes del período como pagadas
      const { error: citaErr } = await supabase
        .from('citas')
        .update({ pago_estado: 'pagado' })
        .eq('especialista_id', espId)
        .eq('estado',          'completada')
        .eq('pago_estado',     'pendiente')
        .gte('fecha_inicio',   startTs)
        .lte('fecha_inicio',   endTs)

      if (citaErr) {
        console.error('[pagos] Error actualizando pago_estado de citas:', citaErr)
      }
    }
  } catch (e) {
    console.error('[pagos] Error marcando citas como pagadas:', e)
  }

  // 3. Auto-registrar en gastos (no bloquea si falla)
  try {
    const descripcion = `Pago comisión - ${body.especialista_nombre ?? 'Especialista'} (${body.periodo ?? 'período'})`
    await supabase.from('gastos').insert({
      fecha:       body.fecha,
      categoria:   'Nómina Administrativa',
      descripcion,
      valor:       body.valor_pagado,
    })
  } catch (e) {
    console.error('[pagos] Error registrando gasto automático:', e)
  }

  return NextResponse.json(pago, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Acceso restringido a administradores')
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Obtener el pago antes de borrar para eliminar el gasto asociado
  const { data: pago } = await supabase
    .from('pagos_especialistas')
    .select('fecha, valor_pagado, especialista_nombre')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('pagos_especialistas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Eliminar el gasto automático asociado (por descripción + fecha + valor)
  if (pago) {
    await supabase.from('gastos')
      .delete()
      .eq('categoria', 'Nómina Administrativa')
      .eq('fecha', pago.fecha)
      .eq('valor', pago.valor_pagado)
      .ilike('descripcion', `%${pago.especialista_nombre}%`)
  }

  return NextResponse.json({ ok: true })
}
