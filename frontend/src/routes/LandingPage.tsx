import { createFileRoute } from '@tanstack/react-router'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Suspense, lazy } from 'react'

// Lazy load components for better initial load performance
const Navbar = lazy(() => import('@/components/landing/Navbar'))
const HeroSection = lazy(() => import('@/components/landing/HeroSection'))
const FeaturesSection = lazy(() => import('@/components/landing/FeaturesSection'))
const HowItWorksSection = lazy(() => import('@/components/landing/HowItWorksSection'))
const TestimonialsSection = lazy(() => import('@/components/landing/TestimonialsSection'))
const CTASection = lazy(() => import('@/components/landing/CTASection'))
const Footer = lazy(() => import('@/components/landing/Footer'))

export const Route = createFileRoute('/LandingPage')({
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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 relative">
      {/* Notebook Paper Pattern Background - Optimized with CSS only */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-slate-50 bg-[linear-gradient(#e5e7eb_1px,transparent_1px)] [background-size:100%_2rem]" />
      <div className="absolute inset-0 -z-10 h-full w-full border-l-2 border-red-200 ml-8 md:ml-16 opacity-50" />

      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1.5 bg-primary origin-left z-50 will-change-transform"
        style={{ scaleX }}
      />

      <Suspense fallback={<div className="h-20 w-full bg-white/80 backdrop-blur-md fixed top-0 z-40" />}>
        <Navbar />
      </Suspense>

      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><div className="animate-pulse bg-slate-200 h-96 w-full max-w-4xl rounded-3xl"></div></div>}>
        <HeroSection />
      </Suspense>

      <Suspense fallback={<div className="py-24 h-96" />}>
        <FeaturesSection />
      </Suspense>

      <Suspense fallback={<div className="py-24 h-96 bg-slate-800" />}>
        <HowItWorksSection />
      </Suspense>

      <Suspense fallback={<div className="py-24 h-96 bg-slate-50" />}>
        <TestimonialsSection />
      </Suspense>

      <Suspense fallback={<div className="py-24 h-96 bg-primary" />}>
        <CTASection />
      </Suspense>

      <Suspense fallback={<div className="py-8" />}>
        <Footer />
      </Suspense>
    </div>
  )
}
