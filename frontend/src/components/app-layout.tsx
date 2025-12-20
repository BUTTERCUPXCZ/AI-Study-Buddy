import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContextDefinition'

import { Separator } from '@/components/ui/separator'
import { FileText, Brain, GraduationCap, Library, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/AuthService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { user } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  const navItems = [
    { to: '/notes', label: 'Study Notes', icon: FileText },
    { to: '/quizzes', label: 'Quizzes', icon: Brain },
    { to: '/tutor', label: 'AI Tutor', icon: GraduationCap },
    { to: '/library', label: 'Library', icon: Library },
  ]

  const currentRoute = navItems.find(item => location.pathname.startsWith(item.to))
  const pageTitle = currentRoute?.label || 'Dashboard'

  const SidebarContent = () => (
    <div className="h-full flex flex-col text-slate-600">
        <div className="flex items-center gap-3 mb-6 px-2">
           <img src="/logo.png" alt="Buds logo" className="w-13 h-13 sm:w-15 sm:h-15 object-contain drop-shadow-sm" />
          <div>
            <div className="font-semibold text-slate-900">Buds AI</div>
            <div className="text-xs text-slate-500">Study smarter</div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.to)
            return (
              <Link 
                key={item.to}
                to={item.to} 
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto">
          <Separator className="my-4 bg-slate-200" />
          <div className="px-2">
            <div className="text-xs text-slate-500">Logged in as</div>
            <div className="mt-2 flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <span className="text-xs font-bold">{user?.fullname?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-medium text-slate-900">{user?.fullname || 'Student'}</div>
                <div className="text-xs text-slate-500 truncate max-w-[160px]">{user?.email || ''}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm -ml-2 text-slate-600 hover:text-red-600 hover:bg-red-50"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r border-slate-200 bg-white p-4 flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-64 p-4 bg-white border-r border-slate-200">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 transition-all duration-200 ease-in-out">
        <header className="fixed top-0 left-0 md:left-64 right-0 h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 bg-white/80 backdrop-blur z-20">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden text-slate-600" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
            <div className="text-lg font-semibold text-slate-900">{pageTitle}</div>
          </div>
        </header>

        <main className="p-4 md:p-6 pt-20 min-h-screen overflow-auto">
          {children}
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to sign out? You will need to log back in to access your account.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              className='bg-destructive text-white bg-red-600 hover:bg-red-700 focus:ring-red-700'
              onClick={async () => {
                try {
                  await authService.logout()
                } catch {
                  // ignore
                }
                localStorage.removeItem('access_token')
                localStorage.removeItem('token')
                window.location.href = '/login'
              }}
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
