import { NextResponse } from 'next/server'

const PLACE_ID      = 'ChIJ5X_5kGiDRo4RkW1pI9FPUGs'
const CACHE_SECONDS = 6 * 60 * 60 // 6 horas

export async function GET() {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  try {
    // Places API (New) — único endpoint disponible actualmente
    const url = `https://places.googleapis.com/v1/places/${PLACE_ID}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        // reviews, reviews.authorAttribution, etc. son campos de la nueva API
        'X-Goog-FieldMask': [
          'rating',
          'userRatingCount',
          'reviews.rating',
          'reviews.text',
          'reviews.relativePublishTimeDescription',
          'reviews.authorAttribution.displayName',
          'reviews.authorAttribution.photoUri',
        ].join(','),
      },
      next: { revalidate: CACHE_SECONDS },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.status ?? 'ERROR', message: data?.error?.message },
        { status: 502 }
      )
    }

    // Mapear formato nuevo → formato que espera el componente
    const reviews = (data.reviews ?? []).map((r: {
      rating: number
      text?: { text: string }
      relativePublishTimeDescription?: string
      authorAttribution?: { displayName: string; photoUri: string }
    }) => ({
      author_name:                  r.authorAttribution?.displayName ?? 'Cliente',
      profile_photo_url:            r.authorAttribution?.photoUri ?? '',
      rating:                       r.rating,
      relative_time_description:    r.relativePublishTimeDescription ?? '',
      text:                         r.text?.text ?? '',
    }))

    return NextResponse.json(
      { rating: data.rating ?? 5, total: data.userRatingCount ?? 38, reviews },
      { headers: { 'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` } }
    )
  } catch {
    return NextResponse.json({ error: 'Error al consultar Google' }, { status: 500 })
  }
}
