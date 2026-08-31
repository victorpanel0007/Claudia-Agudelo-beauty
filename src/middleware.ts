import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware de protección de rutas — SINCRÓNICO, sin llamadas de red.
 * Elimina el MIDDLEWARE_INVOCATION_TIMEOUT (504) en Vercel Edge Runtime.
 *
 * Lee el JWT de Supabase directamente desde las cookies:
 *   sb-<ref>-auth-token  → JSON { access_token, refresh_token, ... }
 *   O en chunks: sb-<ref>-auth-token.0, .1, ...
 */

function base64urlDecode(str: string): string {
  try {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return ''
  }
}

function getRolFromJwt(accessToken: string): { valid: boolean; rol: string | null } {
  const parts = accessToken.split('.')
  if (parts.length !== 3) return { valid: false, rol: null }
  const raw = base64urlDecode(parts[1])
  if (!raw) return { valid: false, rol: null }
  try {
    const payload = JSON.parse(raw) as {
      exp?: number
      user_metadata?: { rol?: string }
    }
    // No rechazar tokens expirados en middleware — el layout los manejará
    const rol = payload.user_metadata?.rol ?? null
    return { valid: true, rol }
  } catch {
    return { valid: false, rol: null }
  }
}

function getSessionFromCookies(request: NextRequest): {
  hasSession: boolean
  rol: string | null
} {
  const cookies = request.cookies.getAll()

  // --- Intentar cookie única primero ---
  // Supabase SSR guarda: sb-<project-ref>-auth-token
  for (const c of cookies) {
    if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
      let rawValue = c.value

      // El valor puede tener prefijo "base64-" seguido de base64 estándar
      if (rawValue.startsWith('base64-')) {
        try {
          rawValue = atob(rawValue.slice(7)) // base64 estándar — no url-safe
        } catch {
          rawValue = base64urlDecode(rawValue.slice(7)) // fallback url-safe
        }
      }

      let accessToken: string | null = null

      // Intentar JSON
      try {
        const parsed = JSON.parse(rawValue) as { access_token?: string }
        accessToken = parsed.access_token ?? null
      } catch {
        // Si no es JSON, puede ser el JWT directamente
        if (rawValue.split('.').length === 3) {
          accessToken = rawValue
        }
      }

      if (accessToken) {
        const { valid, rol } = getRolFromJwt(accessToken)
        if (valid) return { hasSession: true, rol }
      }
    }
  }

  // --- Intentar chunks ---
  // sb-<ref>-auth-token.0, .1, ...
  const chunkMap: Record<number, string> = {}
  for (const c of cookies) {
    const m = c.name.match(/^sb-.+-auth-token\.(\d+)$/)
    if (m) chunkMap[parseInt(m[1])] = c.value
  }

  if (Object.keys(chunkMap).length > 0) {
    const sorted = Object.keys(chunkMap).map(Number).sort((a, b) => a - b)
    const combined = sorted.map(i => chunkMap[i]).join('')

    let accessToken: string | null = null
    try {
      const parsed = JSON.parse(combined) as { access_token?: string }
      accessToken = parsed.access_token ?? null
    } catch {
      // Puede estar en base64url
      try {
        const decoded = base64urlDecode(combined)
        const parsed = JSON.parse(decoded) as { access_token?: string }
        accessToken = parsed.access_token ?? null
      } catch { /* no parseable */ }
    }

    if (accessToken) {
      const { valid, rol } = getRolFromJwt(accessToken)
      if (valid) return { hasSession: true, rol }
    }
  }

  return { hasSession: false, rol: null }
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
