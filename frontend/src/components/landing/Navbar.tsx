import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
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
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center group whitespace-nowrap">
            <img
              src="/logo.png"
              alt="AI Study Buddy Logo"
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain transform-gpu group-hover:scale-110 transition-transform duration-200 drop-shadow-md"
            />
            <span className="text-2xl sm:text-2xl font-extrabold leading-none" style={{ color: '#3B82F6' }}>Buds</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" className="text-muted-foreground hover:text-primary font-medium text-sm py-1">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button className="rounded-full px-4 sm:px-6 py-2.5 text-sm sm:text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all bg-primary text-primary-foreground hover:bg-primary/90">
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
