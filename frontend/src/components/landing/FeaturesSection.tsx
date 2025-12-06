import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Trophy, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const FeaturesSection = memo(function FeaturesSection() {
  const features = [
    {
      icon: <FileText className="h-8 w-8" />,
      title: "Smart Summaries",
      description: "Instantly convert lengthy PDFs into concise, structured study notes that highlight key concepts.",
      color: "bg-blue-100 text-blue-600"
    },
    {
      icon: <Trophy className="h-8 w-8" />,
      title: "Practice Quizzes",
      description: "Test your knowledge with AI-generated quizzes tailored to your specific course material.",
      color: "bg-yellow-100 text-yellow-700"
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Instant Answers",
      description: "Ask questions about your documents and get immediate, accurate explanations with citations.",
      color: "bg-emerald-100 text-emerald-700"
    }
  ]

  return (
    <section className="py-24 bg-white relative border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Features</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">Everything You Need to Excel</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Powerful tools designed to help you learn faster and retain more information.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="will-change-transform"
            >
              <Card className="h-full border-2 border-slate-100 bg-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden rounded-2xl">
                <div className={`h-2 w-full ${feature.color.split(' ')[0].replace('bg-', 'bg-')}`} />
                <CardHeader>
                  <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-2xl font-bold text-slate-800">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

export default FeaturesSection
