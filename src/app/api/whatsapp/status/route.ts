import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET() {
  const BASE_URL = process.env.EVOLUTION_API_URL
  const API_KEY = process.env.EVOLUTION_API_KEY
  const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME

  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json({ connected: false, reason: 'Missing env variables' })
  }

  try {
    const { data } = await axios.get(
      `${BASE_URL}/instance/connectionState/${INSTANCE}`,
      {
        headers: { apikey: API_KEY },
        timeout: 5000,
      }
    )
    const connected =
      data?.instance?.state === 'open' ||
      data?.state === 'open' ||
      data?.status === 'open'
    return NextResponse.json({ connected, raw: data })
  } catch {
    return NextResponse.json({ connected: false, reason: 'Connection error' })
  }
}
