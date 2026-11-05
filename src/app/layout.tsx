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
// Dominio canónico principal — siempre claudiaagudelobeauty.com
const CANONICAL_BASE = 'https://claudiaagudelobeauty.com'

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_BASE),
  title: {
    default: 'Claudia Agudelo Beauty | Salón de Belleza en Sabaneta',
    template: '%s | Claudia Agudelo Beauty',
  },
  description:
    'Claudia Agudelo Beauty, salón de belleza en Sabaneta, Antioquia. Manicure, pedicure, maquillaje, masajes, cejas, peluquería, depilación, barbería, limpieza facial y más. Agenda tu cita por WhatsApp.',
  keywords: [
    'salón de belleza Sabaneta',
    'salón de belleza Antioquia',
    'Claudia Agudelo Beauty',
    'manicure Sabaneta',
    'pedicure Sabaneta',
    'maquillaje Sabaneta',
    'masajes Sabaneta',
    'peluquería Sabaneta',
    'cejas Sabaneta',
    'limpieza facial Sabaneta',
    'depilación Sabaneta',
    'barbería Sabaneta',
    'podología Sabaneta',
    'servicios de belleza Sabaneta',
  ],
  authors: [{ name: 'Claudia Agudelo Beauty' }],
  creator: 'Claudia Agudelo Beauty',
  openGraph: {
    title: 'Claudia Agudelo Beauty | Salón de Belleza en Sabaneta',
    description:
      'Salón de belleza en Sabaneta, Antioquia. Manicure, pedicure, maquillaje, masajes, cejas, peluquería y más. Agenda tu cita fácilmente por WhatsApp.',
    type: 'website',
    url: CANONICAL_BASE,
    locale: 'es_CO',
    siteName: 'Claudia Agudelo Beauty',
    images: [
      {
        url: `${CANONICAL_BASE}/logo.png`,
        width: 512,
        height: 512,
        alt: 'Claudia Agudelo Beauty — Salón de belleza en Sabaneta, Antioquia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claudia Agudelo Beauty | Salón de Belleza en Sabaneta',
    description:
      'Salón de belleza en Sabaneta, Antioquia. Manicure, maquillaje, masajes, peluquería y más.',
    images: [`${CANONICAL_BASE}/logo.png`],
  },
  alternates: {
    canonical: CANONICAL_BASE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#EFA1B5',
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
