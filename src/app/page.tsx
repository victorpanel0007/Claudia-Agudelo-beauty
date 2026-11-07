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
  title: 'Claudia Agudelo Beauty | Salón de Belleza, Spa y Barbería en Sabaneta',
  description:
    'Salón de belleza integral y spa en Sabaneta. Expertos en peluquería, manicura, pedicura, masajes, limpieza facial, cejas, pestañas, maquillaje y barbería. ¡Agenda tu cita!',
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: 'Claudia Agudelo Beauty | Salón de Belleza, Spa y Barbería en Sabaneta',
    description:
      'Tu centro integral de belleza y bienestar en Sabaneta. Manicura, peluquería, masajes, barbería y más. Agenda por WhatsApp.',
    url: CANONICAL_URL,
  },
}

// ── JSON-LD: BeautySalon + LocalBusiness ─────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BeautySalon',
  '@id': 'https://claudiaagudelobeauty.com/',
  name: 'Claudia Agudelo Beauty',
  url: 'https://claudiaagudelobeauty.com/',
  telephone: '+573022197673',
  image: 'https://claudiaagudelobeauty.com/logo.png',
  priceRange: '$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Cl. 74 Sur #46-48',
    addressLocality: 'Sabaneta',
    addressRegion: 'Antioquia',
    addressCountry: 'CO',
    postalCode: '055450',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 6.151,
    longitude: -75.614,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '19:00',
    },
  ],
  sameAs: [
    'https://www.instagram.com/claudiaagudelobeauty',
    'https://www.facebook.com/share/14d4ZJDy6n8/',
    'https://www.tiktok.com/@claudiaagudelobeauty',
  ],
  makesOffer: [
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Peluquería y Tratamientos Capilares' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Manicura y Pedicura' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Masajes Relajantes y Spa' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Diseño de Cejas y Pestañas' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Barbería' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Maquillaje Profesional' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Limpieza Facial' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Depilación Corporal' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Peinados' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Podología' } },
  ],
}

// ── JSON-LD: FAQPage ─────────────────────────────────────────────────────
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Dónde están ubicados?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nos encontramos en la Cl. 74 Sur #46-48 (Barrio Holanda), Sabaneta, Antioquia.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Qué servicios ofrecen en el salón?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ofrecemos peluquería, tratamientos capilares, manicura y pedicura, masajes relajantes, limpieza facial profunda, cejas y pestañas, maquillaje profesional y barbería.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cómo puedo agendar una cita?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Puedes agendar de forma automática directamente en nuestra web o a través de nuestro canal de WhatsApp las 24 horas con nuestra recepcionista virtual.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Puedo elegir a mi especialista favorita al reservar?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí, al momento de agendar puedes elegir entre Claudia, Andrea o la primera especialista disponible.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Con cuánta anticipación debo agendar?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Recomendamos reservar con antelación a través de nuestra web o WhatsApp para asegurar tu horario, especialmente para los fines de semana.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Qué métodos de pago aceptan?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Puedes pagar de forma segura directamente en el salón en efectivo o mediante los medios electrónicos disponibles.',
      },
    },
  ],
}

const ServicesSection = dynamic(() => import('@/components/website/ServicesSection'), {  loading: () => <SectionSkeleton />,
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
      {/* JSON-LD — FAQPage para rich results en Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <BackgroundFondo />
      <Header />
      <HeroSection />
      <ServicesSection />
      <GallerySection fotos={galeriaFotos} />
      <TestimonialsSection />
      <Footer />
      <WhatsAppFloat />
    </main>
  )
}
