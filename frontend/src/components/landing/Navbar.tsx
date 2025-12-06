import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { GraduationCap } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo } from 'react'

const Navbar = memo(function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 w-full z-40 border-b border-border/40 bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60 will-change-transform"
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
})

export default Navbar
