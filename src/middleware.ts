import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware de protección de rutas — sin llamadas de red.
 *
 * Lee el JWT directamente desde las cookies de Supabase SSR.
 * Elimina el MIDDLEWARE_INVOCATION_TIMEOUT causado por refreshes de token.
 *
 * Supabase SSR (Next.js) guarda la sesión dividida en chunks:
 *   sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, ...
 * o en una sola cookie:
 *   sb-<ref>-auth-token
 * El valor es un JSON codificado en base64url con { access_token, ... }
 */

function decodeBase64(str: string): string {
  // Normalizar base64url a base64 estándar
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return atob(b64)
  } catch {
    return ''
  }
}

function parseJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const raw = decodeBase64(parts[1])
    if (!raw) return null
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function getSessionFromCookies(request: NextRequest): {
  hasSession: boolean
  rol: string | null
} {
  const allCookies = request.cookies.getAll()

  // Supabase SSR divide el token en chunks: sb-xxx-auth-token.0, .1, ...
  // Recolectar y ordenar los chunks
  const chunks: Record<string, string> = {}
  let hasChunks = false

  for (const c of allCookies) {
    const chunkMatch = c.name.match(/^(sb-.+-auth-token)\.(\d+)$/)
    if (chunkMatch) {
      chunks[chunkMatch[2]] = c.value
      hasChunks = true
    }
  }

  let sessionJson: string | null = null

  if (hasChunks) {
    // Reconstruir de los chunks ordenados
    const sorted = Object.keys(chunks).sort((a, b) => Number(a) - Number(b))
    const raw = sorted.map(k => chunks[k]).join('')
    try {
      sessionJson = decodeBase64(raw)
    } catch {
      sessionJson = raw
    }
  } else {
    // Buscar cookie única
    for (const c of allCookies) {
      if (
        (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) ||
        c.name === 'sb-access-token'
      ) {
        sessionJson = c.value
        break
      }
    }
  }

  if (!sessionJson) return { hasSession: false, rol: null }

  // Intentar parsear el JSON de sesión
  let accessToken: string | null = null
  try {
    // Puede ser base64 del JSON o JSON directo
    let parsed: unknown
    try {
      parsed = JSON.parse(sessionJson)
    } catch {
      const decoded = decodeBase64(sessionJson)
      parsed = JSON.parse(decoded)
    }
    const session = parsed as { access_token?: string }
    accessToken = session?.access_token ?? null
  } catch {
    // Puede ser el JWT directamente
    if (sessionJson.split('.').length === 3) {
      accessToken = sessionJson
    }
  }

  if (!accessToken) return { hasSession: false, rol: null }

  const payload = parseJwtPayload(accessToken)
  if (!payload) return { hasSession: false, rol: null }

  // Verificar expiración
  const exp = payload['exp'] as number | undefined
  if (exp && exp < Math.floor(Date.now() / 1000)) {
    return { hasSession: false, rol: null }
  }

  const userMetadata = payload['user_metadata'] as Record<string, unknown> | undefined
  const rol = (userMetadata?.['rol'] as string) ?? null

  return { hasSession: true, rol }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute        = pathname.startsWith('/admin')
  const isEspecialistaRoute = pathname.startsWith('/especialista') &&
                               !pathname.startsWith('/especialista/login')

  if (!isAdminRoute && !isEspecialistaRoute) {
    return NextResponse.next()
  }

  const { hasSession, rol } = getSessionFromCookies(request)

  // ── Proteger /admin ──────────────────────────────────────────────────────
  if (isAdminRoute) {
    if (!hasSession) {
      const url = new URL('/login', request.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/especialista', request.url))
    }
  }

  // ── Proteger /especialista ───────────────────────────────────────────────
  if (isEspecialistaRoute) {
    if (!hasSession) {
      return NextResponse.redirect(new URL('/especialista/login', request.url))
    }
    if (rol === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (rol !== 'especialista') {
      return NextResponse.redirect(new URL('/especialista/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/especialista/:path*'],
}
