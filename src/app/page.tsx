import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Header from '@/components/website/Header'
import HeroSection from '@/components/website/HeroSection'
import BackgroundFondo from '@/components/website/BackgroundFondo'
import WhatsAppFloat from '@/components/website/WhatsAppFloat'
import { createClient } from '@/lib/supabase/server'

// ── Metadata de la página principal ──────────────────────────────────────
const CANONICAL_URL = 'https://claudiaagudelobeauty.com'

export const metadata: Metadata = {
  title: 'Claudia Agudelo Beauty | Salón de Belleza en Sabaneta',
  description:
    'Claudia Agudelo Beauty, salón de belleza en Sabaneta, Antioquia. Manicure, pedicure, maquillaje, masajes, cejas, peluquería, depilación, barbería, limpieza facial y podología. Agenda tu cita por WhatsApp.',
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: 'Claudia Agudelo Beauty | Salón de Belleza en Sabaneta',
    description:
      'Salón de belleza en Sabaneta, Antioquia. Manicure, pedicure, maquillaje, masajes, cejas, peluquería y más. Agenda tu cita fácilmente por WhatsApp.',
    url: CANONICAL_URL,
  },
}

// ── JSON-LD: BeautySalon + LocalBusiness ─────────────────────────────────
// Los datos marcados con ⬜ requieren confirmación. Los datos ✅ están
// verificados en el código fuente (ContactSection, WhatsApp, redes sociales).
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BeautySalon',
  '@id': `${CANONICAL_URL}/#beautysalon`,
  name: 'Claudia Agudelo Beauty',
  url: CANONICAL_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Cl. 74 Sur #46-48',
    addressLocality: 'Sabaneta',
    addressRegion: 'Antioquia',
    addressCountry: 'CO',
  },
  // ✅ Teléfono/WhatsApp confirmado en ContactSection.tsx
  telephone: '+57 302 219 7673',
  // ✅ Horarios confirmados en ContactSection.tsx
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '19:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '09:00',
      closes: '19:00',
    },
  ],
  // ✅ Redes sociales confirmadas en ContactSection.tsx
  sameAs: [
    'https://www.instagram.com/claudiaagudelobeauty',
    'https://www.facebook.com/share/14d4ZJDy6n8/',
    'https://www.tiktok.com/@claudiaagudelobeauty',
  ],
  // ✅ Logo confirmado en /public/logo.png
  image: `${CANONICAL_URL}/logo.png`,
  priceRange: '$$',
  // ✅ Servicios confirmados en el proyecto
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Servicios de Belleza — Claudia Agudelo Beauty',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Manicure y pedicure', description: 'Servicios de manicure y pedicure en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Maquillaje', description: 'Maquillaje profesional en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Masajes', description: 'Masajes relajantes y terapéuticos en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Limpieza facial', description: 'Limpieza facial profunda en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Cejas y pestañas', description: 'Diseño de cejas y tratamiento de pestañas en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Peinados', description: 'Peinados para toda ocasión en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Barbería', description: 'Servicios de barbería en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Depilación corporal', description: 'Depilación corporal en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Peluquería', description: 'Servicios de peluquería en Sabaneta, Antioquia.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Podología', description: 'Servicios de podología en Sabaneta, Antioquia.' } },
    ],
  },
}

const ServicesSection = dynamic(() => import('@/components/website/ServicesSection'), {
  loading: () => <SectionSkeleton />,
})

const BookingSection = dynamic(() => import('@/components/website/BookingSection'), {
  loading: () => <SectionSkeleton />,
})

const GallerySection = dynamic(() => import('@/components/website/GallerySection'), {
  loading: () => <SectionSkeleton />,
})

const TestimonialsSection = dynamic(() => import('@/components/website/TestimonialsSection'), {
  loading: () => <SectionSkeleton />,
})

const ContactSection = dynamic(() => import('@/components/website/ContactSection'), {
  loading: () => <SectionSkeleton />,
})

const Footer = dynamic(() => import('@/components/website/Footer'))

function SectionSkeleton() {
  return (
    <div className="py-20 bg-beauty-bg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-5 bg-beauty-primary/15 rounded-full w-28 mx-auto mb-4 animate-pulse" />
        <div className="h-8 bg-beauty-primary/15 rounded-full w-56 mx-auto mb-8 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 bg-beauty-primary/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function HomePage() {
  // Consultar categorías y servicios activos directamente de Supabase
  const supabase = await createClient()

  const [{ data: categorias }, { data: catImagenes }, { data: galeriaData }] = await Promise.all([
    supabase
      .from('categorias')
      .select('id, nombre, icono, orden')
      .order('orden'),
    supabase
      .from('categoria_imagenes')
      .select('categoria_id, imagen_url'),
    supabase
      .from('galeria')
      .select('url, categoria, descripcion')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  // Mapa categoriaId → imagen_url para acceso rápido en el componente
  const imagenesMap: Record<string, string> = {}
  ;(catImagenes ?? []).forEach((ci: { categoria_id: string; imagen_url: string }) => {
    imagenesMap[ci.categoria_id] = ci.imagen_url
  })

  const galeriaFotos = (galeriaData ?? []) as { url: string; categoria: string; descripcion: string | null }[]

  return (
    <main className="min-h-screen relative">
      {/* JSON-LD — BeautySalon / LocalBusiness para Google y crawlers de IA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BackgroundFondo />
      <Header />
      <HeroSection />
      <ServicesSection
        categorias={categorias ?? []}
        imagenesMap={imagenesMap}
      />
      <GallerySection fotos={galeriaFotos} />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <WhatsAppFloat />
    </main>
  )
}
