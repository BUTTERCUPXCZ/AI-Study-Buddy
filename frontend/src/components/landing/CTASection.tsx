import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const CTASection = memo(function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-primary">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      
      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="will-change-transform"
        >
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-8 backdrop-blur-sm border border-white/20">
            <Pencil className="h-6 w-6 text-white mr-2" />
            <span className="font-medium text-white">Start your journey today</span>
          </div>
          
          <h2 className="text-5xl sm:text-6xl font-extrabold mb-8 tracking-tight text-white">
            Ready to Study Smarter?
          </h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of students using AI to ace their exams. Get started for free today.
          </p>
          <Link to="/register">
            <Button size="lg" className="h-16 px-12 text-xl rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white text-primary hover:bg-blue-50 font-bold border-none">
              Create Free Account
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
})

export default CTASection
