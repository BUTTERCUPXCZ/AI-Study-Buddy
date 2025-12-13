import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const CTASection = memo(function CTASection() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden bg-primary">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        <div className="absolute inset-0 bg-primary/90" />
      </div>
      <div className="max-w-4xl mx-auto px-4 text-center text-white relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="will-change-transform"
        >
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-8 backdrop-blur-sm">
            <Pencil className="h-6 w-6 text-yellow-300 mr-2" />
            <span className="font-medium text-yellow-100">Start your journey today</span>
          </div>
          
          <h2 className="text-5xl sm:text-6xl font-bold mb-8 tracking-tight">
            Ready to Study Smarter?
          </h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of students using AI to ace their exams. Get started for free today.
          </p>
          <Link to="/register">
            <Button size="lg" className="h-16 px-12 text-xl rounded-full shadow-2xl shadow-black/20 hover:shadow-black/30 hover:-translate-y-1 transition-all duration-300 bg-white text-primary hover:bg-blue-50 font-bold">
              Create Free Account
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
})

export default CTASection
