import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Middleware de protección de rutas.
 *
 * Usa getSession() con un timeout de 3 segundos.
 * Si Supabase tarda más de 3s (refresh de token) → deja pasar.
 * La verificación real de sesión ocurre en el layout de servidor.
 * Esto elimina el MIDDLEWARE_INVOCATION_TIMEOUT (504) en Vercel Edge.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute        = pathname.startsWith('/admin')
  const isEspecialistaRoute = pathname.startsWith('/especialista') &&
                               !pathname.startsWith('/especialista/login')

  if (!isAdminRoute && !isEspecialistaRoute) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Timeout de 3s: si Supabase tarda más (refresh de token en red)
  // dejamos pasar — el layout de admin hará la verificación real.
  let session = null
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ])
    session = (result as { data: { session: unknown } }).data?.session ?? null
  } catch {
    // Timeout o error → dejar pasar, el layout verificará
    return NextResponse.next()
  }

  const rol = (session as { user?: { user_metadata?: { rol?: string } } } | null)
    ?.user?.user_metadata?.rol ?? null

  // ── Proteger /admin ──────────────────────────────────────────────────────
  if (isAdminRoute) {
    if (!session) {
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
    if (!session) {
      return NextResponse.redirect(new URL('/especialista/login', request.url))
    }
    if (rol === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (rol !== 'especialista') {
      return NextResponse.redirect(new URL('/especialista/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/especialista/:path*'],
}
