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

export const Route = createFileRoute('/landingpage')({
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
      {/* Modern SaaS Background - Grid + Glow */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white">
        <div className="absolute h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
      </div>

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

      <Suspense fallback={<div className="py-24 h-96 bg-gradient-to-b from-slate-50 to-white" />}>
        <Pricing />
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
