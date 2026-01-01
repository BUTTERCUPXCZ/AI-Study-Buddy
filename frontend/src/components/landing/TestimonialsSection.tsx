import { Quote } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const TestimonialsSection = memo(function TestimonialsSection() {
  const testimonials = [
    {
      quote: "This app completely changed how I study. I went from C's to A's in one semester.",
      author: "Sarah J.",
      role: "Medical Student",
      color: "bg-yellow-200"
    },
    {
      quote: "The quiz generation feature is a lifesaver. It finds the exact questions I need to practice.",
      author: "Michael C.",
      role: "Computer Science Major",
      color: "bg-blue-200"
    },
    {
      quote: "I love how it summarizes 50-page chapters into digestible notes. Saves me hours.",
      author: "Emily R.",
      role: "Law Student",
      color: "bg-emerald-200"
    }
  ]

  return (
    <section id="testimonials" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">Trusted by Students</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 transition-transform duration-300 will-change-transform`}
            >
              <div className={`h-full p-8 ${t.color} shadow-lg hover:shadow-xl transition-shadow duration-300 relative`}>
                {/* Tape effect */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-white/40 backdrop-blur-sm rotate-1 shadow-sm border border-white/20"></div>
                
                <Quote className="h-10 w-10 text-muted-foreground/20 mb-6" />
                <p className="text-xl mb-8 italic text-slate-800 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900/10 flex items-center justify-center font-bold text-slate-700">
                    {t.author[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t.author}</p>
                    <p className="text-sm text-slate-600 font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

export default TestimonialsSection
