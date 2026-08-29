import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware de protección de rutas.
 *
 * /admin/* → requiere sesión + rol = 'admin'
 *            - Sin sesión → redirige a /login
 *            - Con sesión pero rol ≠ 'admin' → redirige a /especialista
 *
 * /especialista/* → requiere sesión + rol = 'especialista'
 *            - Sin sesión → redirige a /especialista/login
 *            - Con sesión pero rol = 'admin' → redirige a /admin
 *
 * Lee el JWT directamente desde las cookies — CERO llamadas de red.
 * Elimina el MIDDLEWARE_INVOCATION_TIMEOUT que ocurría cuando
 * @supabase/ssr intentaba refrescar el token haciendo una llamada de red
 * desde Edge Runtime (puede bloquear hasta 25 s).
 */

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Edge Runtime tiene atob disponible
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

function getSessionFromCookies(request: NextRequest): {
  hasSession: boolean
  rol: string | null
} {
  // Supabase SSR guarda la sesión en cookies con patrón sb-<ref>-auth-token
  // También puede estar como sb-access-token en versiones anteriores
  const allCookies = request.cookies.getAll()

  for (const cookie of allCookies) {
    const name = cookie.name
    if (
      (name.startsWith('sb-') && name.endsWith('-auth-token')) ||
      name === 'sb-access-token'
    ) {
      try {
        // El valor puede ser JSON con access_token, o directamente el JWT
        let accessToken: string | null = null
        try {
          const parsed = JSON.parse(cookie.value) as { access_token?: string }
          accessToken = parsed?.access_token ?? null
        } catch {
          // Si no es JSON, puede ser el JWT directamente
          accessToken = cookie.value
        }

        if (!accessToken) continue

        const payload = parseJwtPayload(accessToken)
        if (!payload) continue

        // Verificar que el token no esté expirado
        const exp = payload['exp'] as number | undefined
        if (exp && exp < Math.floor(Date.now() / 1000)) continue

        // Extraer el rol de user_metadata
        const userMetadata = payload['user_metadata'] as Record<string, unknown> | undefined
        const rol = (userMetadata?.['rol'] as string) ?? null

        return { hasSession: true, rol }
      } catch {
        continue
      }
    }
  }

  return { hasSession: false, rol: null }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute       = pathname.startsWith('/admin')
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

  // ── Proteger /especialista (rutas autenticadas, no login) ────────────────
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
