import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, ArrowRight, CheckCircle2, Library } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const HeroSection = memo(function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="will-change-transform"
          >
            <Badge variant="outline" className="mb-6 px-4 py-2 text-sm font-medium border-blue-200 bg-blue-50 text-blue-600 rounded-full shadow-sm">
              <Sparkles className="h-4 w-4 mr-2 inline text-yellow-400 fill-yellow-400" />
              Your Personal AI Tutor
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 text-slate-900 leading-[1.1]">
              Ace Your Exams <br />
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">With AI</span>
                <span className="absolute bottom-2 left-0 w-full h-4 bg-yellow-300 -z-10 -rotate-2 rounded-sm"></span>
              </span>
            </h1>

            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
              Turn your messy notes and textbooks into clear summaries, flashcards, and quizzes instantly. It's like having a genius study buddy 24/7.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register">
                <Button size="lg" className="h-16 px-10 text-xl rounded-2xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all duration-300 bg-primary text-white">
                  Start Studying Free
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-16 px-10 text-xl rounded-2xl border-2 border-slate-200 hover:bg-white hover:border-primary/50 text-slate-700 transition-all duration-300 bg-white/50 backdrop-blur-sm">
                  View Demo
                </Button>
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>Free forever plan</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative will-change-transform"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-8 border-white rotate-2 hover:rotate-0 transition-transform duration-500">
              <img 
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000" 
                alt="Students studying together" 
                className="w-full h-auto object-cover"
                loading="eager"
                width="600"
                height="400"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-lg">
                    <Library className="h-6 w-6 text-white" />
                  </div>
                  <span className="font-semibold text-lg">Smart Library</span>
                </div>
                <p className="text-white/90 text-sm">Access all your study materials in one organized place.</p>
              </div>
            </div>
            
            {/* Decorative Elements - Optimized */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300/50 rounded-full blur-2xl animate-blob" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-300/50 rounded-full blur-2xl animate-blob animation-delay-2000" />
          </motion.div>
        </div>
      </div>
    </section>
  )
})

export default HeroSection
