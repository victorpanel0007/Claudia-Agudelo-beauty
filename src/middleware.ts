import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Rutas completamente bloqueadas para especialistas — solo admin entra

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

  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión → login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const rol = user.user_metadata?.rol

  // Especialista intentando acceder a /admin → redirigir a su panel
  if (rol !== 'admin') {
    return NextResponse.redirect(new URL('/especialista', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
