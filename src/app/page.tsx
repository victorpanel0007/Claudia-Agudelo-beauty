import dynamic from 'next/dynamic'
import Header from '@/components/website/Header'
import HeroSection from '@/components/website/HeroSection'
import WhatsAppFloat from '@/components/website/WhatsAppFloat'

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
