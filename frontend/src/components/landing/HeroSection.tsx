import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { memo } from 'react'

const HeroSection = memo(function HeroSection() {
  return (
    <section className="relative py-16 lg:py-24 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="will-change-transform"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-slate-900 leading-[1.1]">
              Study Smarter,
              <br />
              Not Harder
              <br />
              <span className="text-primary">With AI!</span>
            </h1>

            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-md">
              Transform your notes into summaries, flashcards, and quizzes instantly. Your AI-powered study buddy is here 24/7.
            </p>

            <Link to="/register">
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-blue-500 hover:bg-blue-600 text-white"
              >
                Get Started
              </Button>
            </Link>
          </motion.div>

          {/* Right Side - Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative will-change-transform flex items-center justify-center"
          >
            <img 
              src="/reading_time.png" 
              alt="Person relaxing and studying with tablet" 
              className="w-full max-w-lg h-auto"
              loading="eager"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
})

export default HeroSection
