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
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full  bg-white"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8 relative">
       
        {/* Logo */}
        <Link to="/" aria-label="AI Study Buddy home" className="flex items-center gap-2">
         <img src="logo_svg.svg" alt="Buds logo" className="w-15 h-15" />
          <span className="text-2xl font-bold tracking-tight text-gray-800" >
            Buds
          </span>
        </Link>

        {/* Desktop Navigation - Centered */}
        <nav className="hidden lg:flex items-center gap-6 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {navItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right side - Buttons */}
        <div className="flex items-center gap-3">
          <Link to="/register" className="hidden text-sm font-medium text-slate-700 hover:text-slate-900 sm:block">
            Sign up
          </Link>

          <Link to="/login">
            <Button className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800">
              Log in
            </Button>
          </Link>

          {/* Mobile menu button */}
          {!isMenuOpen && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleOpenMenu}
              className="text-slate-600 hover:text-slate-900 lg:hidden"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-50 bg-white transition-transform duration-300 lg:hidden ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link to="/" aria-label="AI Study Buddy home" onClick={handleCloseMenu} className="flex items-center gap-2">
            <img src="logo_svg.svg" alt="Buds logo" className="w-10 h-10" />
            <span className="text-2xl font-bold tracking-tight text-gray-800">
              Buds
            </span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCloseMenu}
            className="text-slate-600 hover:text-slate-900"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={handleNavItemClick}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6">
            <Link to="/register" className="w-full" onClick={handleNavItemClick}>
              <Button
                variant="outline"
                className="w-full rounded-full border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              >
                Sign up
              </Button>
            </Link>
            <Link to="/login" className="w-full" onClick={handleNavItemClick}>
              <Button className="w-full rounded-full bg-slate-900 text-white hover:bg-slate-800">Log in</Button>
            </Link>
          </div>
        </nav>
      </div>
    </motion.header>
  )
})

export default Navbar
