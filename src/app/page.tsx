import dynamic from 'next/dynamic'
import Header from '@/components/website/Header'
import HeroSection from '@/components/website/HeroSection'
import WhatsAppFloat from '@/components/website/WhatsAppFloat'
import { createClient } from '@/lib/supabase/server'

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
      {/* Imagen de portada fija — visible mientras el usuario baja */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/fondo.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
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
