import type { Metadata, Viewport } from 'next'
import { Cormorant, Montserrat } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

// ── Fuentes ───────────────────────────────────────────────────────────────
// Cormorant Garamond: serif editorial de lujo para títulos
const cormorant = Cormorant({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  preload: true,
})

// Montserrat: sans-serif moderna para textos y navegación
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
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
  themeColor: '#29332E',
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
      className={`scroll-smooth ${cormorant.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-init" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-WK9X66H4');
          `}
        </Script>
        {/* Preconnect a orígenes críticos */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch para recursos externos */}
        <link rel="dns-prefetch" href="https://maps.google.com" />
        <link rel="dns-prefetch" href="https://wa.me" />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WK9X66H4"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>

        {/* Google Analytics GA4 */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  )
}
