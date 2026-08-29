import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
 * Usa getSession() (lectura local del JWT, sin llamada de red)
 * para evitar el timeout de Vercel Edge Runtime.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute      = pathname.startsWith('/admin')
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
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession: lectura local del JWT, sin red → no genera timeout en Edge
  const { data: { session } } = await supabase.auth.getSession()
  const rol = session?.user?.user_metadata?.rol ?? null

  // ── Proteger /admin ──────────────────────────────────────────────────────
  if (isAdminRoute) {
    if (!session) {
      const url = new URL('/login', request.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    if (rol !== 'admin') {
      // Especialista intentando entrar al panel admin → su panel
      return NextResponse.redirect(new URL('/especialista', request.url))
    }
  }

  // ── Proteger /especialista (rutas autenticadas, no login) ────────────────
  if (isEspecialistaRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/especialista/login', request.url))
    }
    if (rol === 'admin') {
      // Admin intentando entrar al panel de especialista → panel admin
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
