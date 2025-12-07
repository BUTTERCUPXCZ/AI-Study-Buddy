import { memo } from 'react'

const Footer = memo(function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center text-sm text-slate-500">
          <p>© 2025 AI Buddy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
})

export default Footer
