import { Upload, Brain, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const HowItWorksSection = memo(function HowItWorksSection() {
  const steps = [
    {
      icon: <Upload className="h-6 w-6" />,
      title: "Upload Materials",
      desc: "Drag & drop your PDF textbooks, lecture slides, or handwritten notes."
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI Processing",
      desc: "Our advanced AI analyzes your content to extract key concepts and structure."
    },
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: "Start Studying",
      desc: "Access your generated summaries, flashcards, and quizzes immediately."
    }
  ]

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-slate-50 text-slate-900 ">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-slate-600">Three simple steps to better grades</p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-slate-200 border-t border-dashed border-slate-300" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative flex flex-col items-center text-center will-change-transform"
            >
              <div className="w-24 h-24 rounded-full bg-slate-50 border-2 border-primary/20 backdrop-blur-sm flex items-center justify-center z-10 mb-8 group hover:bg-primary/10 transition-colors duration-300">
                <div className="text-primary group-hover:scale-110 transition-transform duration-300">
                  {step.icon}
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
              <p className="text-slate-600 max-w-xs text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

export default HowItWorksSection
