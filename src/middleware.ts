import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Solo corre en rutas /admin
  if (!pathname.startsWith('/admin')) {
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
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Usar getSession() en lugar de getUser() — getSession es local (JWT),
  // no hace llamada de red a Supabase y evita el timeout de Edge Runtime.
  const { data: { session } } = await supabase.auth.getSession()

  // Sin sesión → login
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const rol = session.user?.user_metadata?.rol

  // Especialista intentando acceder a /admin → redirigir a su panel
  if (rol !== 'admin') {
    return NextResponse.redirect(new URL('/especialista', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
