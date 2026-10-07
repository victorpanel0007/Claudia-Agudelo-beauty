import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/scheduling'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const duracion = searchParams.get('duracion')
  const especialistaId = searchParams.get('especialista_id') || undefined
  const excluirCitaId = searchParams.get('excluir_cita_id') || undefined

  if (!fecha || !duracion) {
    return NextResponse.json({ error: 'fecha y duracion son requeridos' }, { status: 400 })
  }

  const slots = await getAvailableSlots(
    new Date(fecha),
    parseInt(duracion),
    especialistaId,
    excluirCitaId
  )

  return NextResponse.json(slots, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
