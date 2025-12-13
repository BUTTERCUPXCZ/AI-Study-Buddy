import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Testimonials', href: '#testimonials' },
]

const Navbar = memo(function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleOpenMenu = useCallback(() => {
    setIsMenuOpen(true)
  }, [])

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const handleNavItemClick = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  return (
    <motion.header
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-4 z-50 flex justify-center px-4"
    >
      <div className="flex w-full max-w-6xl items-center justify-between rounded-full border border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur-md transition-all md:py-4">
        <Link to="/" aria-label="AI Study Buddy home" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="AI Study Buddy Logo"
            className="h-12 w-12 rounded-full border border-slate-200 bg-white object-contain p-1 shadow-sm"
          />
          <span className="hidden text-xl font-semibold tracking-tight text-slate-900 sm:inline">Buds</span>
        </Link>

        <nav
          id="menu"
          aria-label="Primary"
          className={`max-md:absolute max-md:left-0 max-md:top-0 max-md:z-40 max-md:flex max-md:h-full max-md:flex-col max-md:bg-white/95 max-md:backdrop-blur max-md:px-6 max-md:py-10 max-md:shadow-xl max-md:transition-[width] max-md:duration-300 md:static md:flex md:flex-row md:items-center md:justify-center md:gap-8 md:bg-transparent ${
            isMenuOpen
              ? 'max-md:w-full max-md:pointer-events-auto'
              : 'max-md:w-0 max-md:overflow-hidden max-md:pointer-events-none'
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center gap-8 text-sm font-medium text-slate-700 md:flex-row">
            {navItems.map(item => (
              <a
                key={item.label}
                href={item.href}
                onClick={handleNavItemClick}
                className="transition-colors hover:text-primary"
              >
                {item.label}
              </a>
            ))}
            <Link to="/login" className="w-full md:hidden">
              <Button
                variant="outline"
                className="w-full rounded-full border-slate-200 text-slate-700 hover:border-primary/50 hover:text-primary"
                onClick={handleNavItemClick}
              >
                Sign In
              </Button>
            </Link>
            <Link to="/register" className="w-full md:hidden">
              <Button
                className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleNavItemClick}
              >
                Sign Up
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCloseMenu}
              className="mt-6 text-slate-500 hover:text-primary md:hidden"
            >
              <X className="h-6 w-6" aria-hidden="true" />
              <span className="sr-only">Close menu</span>
            </Button>
          </div>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden md:inline-flex">
            <Button
              variant="ghost"
              className="rounded-full px-5 py-2 text-sm font-semibold text-slate-600 hover:text-primary"
            >
              Sign In
            </Button>
          </Link>
          <Link to="/register" className="hidden md:inline-flex">
            <Button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90">
              Sign Up
            </Button>
          </Link>
          {!isMenuOpen && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleOpenMenu}
              className="text-slate-600 hover:text-primary md:hidden"
              aria-controls="menu"
              aria-expanded={isMenuOpen}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  )
})

export default Navbar
