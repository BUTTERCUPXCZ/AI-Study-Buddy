import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  Brain, 
  Sparkles, 
  Upload, 
  FileText, 
  Trophy,
  ArrowRight,
  CheckCircle2,
  Quote,
  Zap,
  GraduationCap,
  Pencil,
  Library
} from 'lucide-react'
import { motion, useScroll, useSpring } from 'framer-motion'

export const Route = createFileRoute('/LandingPage')({
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
      {/* Notebook Paper Pattern Background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-slate-50 bg-[linear-gradient(#e5e7eb_1px,transparent_1px)] [background-size:100%_2rem]" />
      <div className="absolute inset-0 -z-10 h-full w-full border-l-2 border-red-200 ml-8 md:ml-16 opacity-50" />

      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1.5 bg-primary origin-left z-50"
        style={{ scaleX }}
      />

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  )
}

function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 w-full z-40 border-b border-border/40 bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground shadow-lg group-hover:scale-105 transition-transform">
              <GraduationCap className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-primary">AI Study Buddy</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="text-muted-foreground hover:text-primary font-medium text-lg">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button className="rounded-full px-8 py-6 text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
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
            className="relative"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-8 border-white rotate-2 hover:rotate-0 transition-transform duration-500">
              <img 
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070" 
                alt="Students studying together" 
                className="w-full h-auto object-cover"
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
            
            {/* Decorative Elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
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
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
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
}

function HowItWorksSection() {
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
    <section className="py-24 relative overflow-hidden bg-slate-800 text-white">
      {/* Chalkboard Texture Effect */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-slate-300">Three simple steps to better grades</p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-white/20 border-t border-dashed border-white/40" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-sm flex items-center justify-center z-10 mb-8 group hover:bg-white/20 transition-colors duration-300">
                <div className="text-white group-hover:scale-110 transition-transform duration-300">
                  {step.icon}
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
              <p className="text-slate-300 max-w-xs text-lg leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
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
    <section className="py-24 bg-slate-50">
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
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 transition-transform duration-300`}
            >
              <div className={`h-full p-8 ${t.color} shadow-lg hover:shadow-xl transition-shadow duration-300 relative`}>
                {/* Tape effect */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-white/40 backdrop-blur-sm rotate-1 shadow-sm border border-white/20"></div>
                
                <Quote className="h-10 w-10 text-slate-900/20 mb-6" />
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
}

function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-primary">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        <div className="absolute inset-0 bg-primary/90" />
      </div>
      <div className="max-w-4xl mx-auto px-4 text-center text-white relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
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
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center text-sm text-slate-500">
          <p>© 2024 AI Study Buddy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

