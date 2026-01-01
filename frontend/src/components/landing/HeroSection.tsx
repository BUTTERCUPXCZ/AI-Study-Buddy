import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { memo } from 'react'
  

const HeroSection = memo(function HeroSection() {
  return (
    <section className="relative flex min-h-[70vh] md:min-h-[80vh] lg:min-h-[90vh] w-full flex-col items-center overflow-hidden py-12 md:py-20 lg:py-28">

      <div className="relative z-10 w-full">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center justify-center">
            {/* small pill badge (top) */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6"
            >
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight"
            >
              Generate Smarter Study Notes from Your PDFs in Seconds
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-2 text-sm md:text-base max-w-2xl"
            >
              Turn your lectures, PDFs, and topics into
              notes, quizzes, and an AI tutor — instantly.
            </motion.p>

            {/* Email input + CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-6 flex flex-col sm:flex-row items-center gap-3"
            >
              <div className="flex gap-3">
                <Link to="/register">
                  <Button size="lg" className="px-4 py-2 rounded-3xl">Get Started</Button>
                </Link>
              </div>
            </motion.div>

            {/* Large illustration that overlaps bottom */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-12 w-full flex justify-center"
            >
              <div className="relative w-full max-w-6xl">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img  
                    src="/HeroSectionPic.png"
                    alt="Hero screenshot"
                    className="w-full h-auto block max-h-[60vh] md:max-h-[70vh] lg:max-h-[80vh] object-contain"
                    loading="eager"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
})

export default HeroSection
