import { NextResponse } from 'next/server'

const PLACE_ID = 'ChIJ5X_5kGiDRo4RkW1pI9FPUGs'
// Caché de 6 horas — evita exceder cuota de la API
const CACHE_SECONDS = 6 * 60 * 60

export async function GET() {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,user_ratings_total,reviews&language=es&reviews_sort=newest&key=${key}`
    const res = await fetch(url, { next: { revalidate: CACHE_SECONDS } })
    const data = await res.json()

    if (data.status !== 'OK') {
      return NextResponse.json({ error: data.status, message: data.error_message }, { status: 502 })
    }

    const { rating, user_ratings_total, reviews } = data.result
    return NextResponse.json(
      { rating, total: user_ratings_total, reviews: reviews ?? [] },
      { headers: { 'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` } }
    )
  } catch (err) {
    return NextResponse.json({ error: 'Error al consultar Google' }, { status: 500 })
  }
}
