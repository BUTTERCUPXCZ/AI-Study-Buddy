import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/theme-toggle'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, FileText, Brain, GraduationCap, Library, LogOut } from 'lucide-react'
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

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [logoutOpen, setLogoutOpen] = useState(false)
  
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/notes', label: 'Study Notes', icon: FileText },
    { to: '/quizzes', label: 'Quizzes', icon: Brain },
    { to: '/tutor', label: 'AI Tutor', icon: GraduationCap },
    { to: '/library', label: 'Library', icon: Library },
  ]

  const currentRoute = navItems.find(item => location.pathname.startsWith(item.to))
  const pageTitle = currentRoute?.label || 'Dashboard'

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar (fixed) */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">SM</div>
          <div>
            <div className="font-semibold">StudyMate AI</div>
            <div className="text-xs text-sidebar-foreground/70">Study smarter</div>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.to)
            return (
              <Link 
                key={item.to}
                to={item.to} 
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                    : 'hover:bg-sidebar-accent/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

  <div className="mt-6 flex flex-col flex-1">
       

          <div className="mt-auto">
               <Separator />
          <div className="mt-4 text-xs text-sidebar-foreground/80">Logged in as</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent" />
            <div className="text-sm">Student</div>
          </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
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
                className=''
                onClick={async () => {
                  try {
                    await authService.logout()
                  } catch (err) {
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
      </aside>

      {/* Main (offset by sidebar) */}
      <div className="flex-1 ml-64">
        <header className="fixed top-0 left-64 right-0 h-16 flex items-center justify-between px-6 border-b border-sidebar-border bg-background z-40">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>

        <main className="p-6 pt-16 min-h-screen overflow-auto">{children}</main>
      </div>
    </div>
  )
}
