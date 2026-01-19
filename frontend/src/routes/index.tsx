import { createFileRoute } from '@tanstack/react-router'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Suspense, lazy } from 'react'

// Lazy load components for better initial load performance
const Navbar = lazy(() => import('@/components/landing/Navbar'))
const HeroSection = lazy(() => import('@/components/landing/HeroSection'))
const FeaturesSection = lazy(() => import('@/components/landing/FeaturesSection'))
const HowItWorksSection = lazy(() => import('@/components/landing/HowItWorksSection'))
const TestimonialsSection = lazy(() => import('@/components/landing/TestimonialsSection'))
const Pricing = lazy(() => import('@/components/landing/Pricing'))
const CTASection = lazy(() => import('@/components/landing/CTASection'))
const Footer = lazy(() => import('@/components/landing/Footer'))

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left"
        style={{ scaleX }}
      />
      <div className="min-h-screen">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <Navbar />
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <TestimonialsSection />
          <Pricing />
          <CTASection />
          <Footer />
        </Suspense>
      </div>
    </>
  )
}
