import dynamic from 'next/dynamic'
import Header from '@/components/website/Header'
import HeroSection from '@/components/website/HeroSection'
import WhatsAppFloat from '@/components/website/WhatsAppFloat'

// ── Carga diferida de secciones no críticas ───────────────────────────────
// Las secciones above-the-fold (Header + Hero) se cargan de forma estática.
// El resto se carga de forma diferida para mejorar LCP y FCP.

const ServicesSection = dynamic(() => import('@/components/website/ServicesSection'), {
  loading: () => <SectionSkeleton />,
})

const BookingSection = dynamic(() => import('@/components/website/BookingSection'), {
  loading: () => <SectionSkeleton />,
})

const WhatsAppSection = dynamic(() => import('@/components/website/WhatsAppSection'), {
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

// Skeleton minimalista para secciones en carga
function SectionSkeleton() {
  return (
    <div className="py-20 bg-beauty-bg animate-pulse">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-6 bg-beauty-primary/20 rounded-full w-32 mx-auto mb-4" />
        <div className="h-10 bg-beauty-primary/20 rounded-full w-64 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-beauty-primary/10 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-beauty-bg">
      {/* Crítico: carga inmediata */}
      <Header />
      <HeroSection />

      {/* Diferido: carga según scroll */}
      <ServicesSection />
      <BookingSection />
      <WhatsAppSection />
      <GallerySection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />

      {/* Float siempre presente */}
      <WhatsAppFloat />
    </main>
  )
}
