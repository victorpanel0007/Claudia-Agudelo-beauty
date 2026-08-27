import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Solo corre en rutas /admin
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Leer el token de sesión directamente desde las cookies del request.
  // Esto NO hace ninguna llamada de red — lee solo el JWT local.
  // Evita el timeout de Edge Runtime que causaba el 504.
  const cookieNames = [
    'sb-access-token',
    'supabase-auth-token',
  ]

  // Supabase SSR guarda la sesión en cookies con el patrón sb-<project-ref>-auth-token
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    cookieNames.some(n => c.name.includes(n)) ||
    (c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
  )

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si hay sesión, dejar pasar — la verificación de rol se hace en los layouts/pages
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
