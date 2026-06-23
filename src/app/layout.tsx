import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

// ── Fuentes optimizadas ───────────────────────────────────────────────────
// Inter: solo subset latin, solo pesos usados (400, 500, 600, 700)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  preload: true,
})

// Playfair: solo pesos y estilos usados
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  preload: true,
})

// ── Metadata completa para SEO ────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL('https://claudiagudelobeauty.com'),
  title: {
    default: 'Claudia Agudelo Beauty | Salón de Belleza Premium',
    template: '%s | Claudia Agudelo Beauty',
  },
  description:
    'Salón de belleza premium en Colombia. Manicura, pedicura, maquillaje, masajes, cejas, pestañas, peluquería y más. Reserva tu cita online o por WhatsApp.',
  keywords: [
    'salón de belleza', 'spa', 'manicura', 'pedicura',
    'maquillaje', 'masajes', 'cejas', 'pestañas', 'peluquería',
    'Claudia Agudelo', 'beauty', 'Colombia',
  ],
  authors: [{ name: 'Claudia Agudelo Beauty' }],
  creator: 'Claudia Agudelo Beauty',
  openGraph: {
    title: 'Claudia Agudelo Beauty | Salón de Belleza Premium',
    description: 'Realzamos tu belleza y tu esencia. Reserva tu cita online.',
    type: 'website',
    locale: 'es_CO',
    siteName: 'Claudia Agudelo Beauty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claudia Agudelo Beauty',
    description: 'Salón de belleza premium. Reserva tu cita online.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#CDA967',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      className={`scroll-smooth ${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect a orígenes críticos */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch para recursos externos */}
        <link rel="dns-prefetch" href="https://maps.google.com" />
        <link rel="dns-prefetch" href="https://wa.me" />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
