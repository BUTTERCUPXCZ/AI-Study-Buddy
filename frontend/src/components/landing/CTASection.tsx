import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const CTASection = memo(function CTASection() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden bg-white">
      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="will-change-transform"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-8">
            <Pencil className="h-6 w-6 text-primary mr-2" />
            <span className="font-medium text-primary">Start your journey today</span>
          </div>
          
          <h2 className="text-5xl sm:text-6xl font-extrabold mb-8 tracking-tight text-slate-900">
            Ready to Study Smarter?
          </h2>
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of students using AI to ace their exams. Get started for free today.
          </p>
          <Link to="/register">
            <Button size="lg" className="h-16 px-12 text-xl rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Create Free Account
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
})

export default CTASection
