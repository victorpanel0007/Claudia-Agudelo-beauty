import dynamic from 'next/dynamic'
import Header from '@/components/website/Header'
import WhatsAppFloat from '@/components/website/WhatsAppFloat'

// Hero sin animaciones pesadas — carga inmediata para mejor LCP
const HeroSection = dynamic(() => import('@/components/website/HeroSection'), {
  ssr: true,
})

// Secciones diferidas — no bloquean el primer render
const ServicesSection = dynamic(() => import('@/components/website/ServicesSection'), {
  loading: () => <SectionSkeleton />,
  ssr: false,
})

const BookingSection = dynamic(() => import('@/components/website/BookingSection'), {
  loading: () => <SectionSkeleton />,
  ssr: false,
})

const WhatsAppSection = dynamic(() => import('@/components/website/WhatsAppSection'), {
  loading: () => <SectionSkeleton />,
  ssr: false,
})

const GallerySection = dynamic(() => import('@/components/website/GallerySection'), {
  loading: () => <SectionSkeleton />,
  ssr: false,
})

const TestimonialsSection = dynamic(() => import('@/components/website/TestimonialsSection'), {
  loading: () => <SectionSkeleton />,
  ssr: false,
})

const ContactSection = dynamic(() => import('@/components/website/ContactSection'), {
  loading: () => <SectionSkeleton />,
  ssr: false,
})

const Footer = dynamic(() => import('@/components/website/Footer'), {
  ssr: false,
})

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

export default function HomePage() {
  return (
    <main className="min-h-screen bg-beauty-bg">
      <Header />
      <HeroSection />
      <ServicesSection />
      <BookingSection />
      <WhatsAppSection />
      <GallerySection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <WhatsAppFloat />
    </main>
  )
}
