import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setGlobalToast } from '@/lib/toast'

type Toast = {
  id: string
  message: string
  type?: 'info' | 'error' | 'success'
}

type ToastContextValue = {
  showToast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toast: Toast = { id, message, type }
    setToasts((s) => [toast, ...s])

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  // Register bridge so non-react modules can show toasts
  useEffect(() => {
    setGlobalToast(showToast)
    return () => setGlobalToast(() => {})
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-xs w-full rounded-md px-4 py-2 shadow-md text-sm text-white ${
              t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-gray-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToastContext = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider')
  return ctx
}

export default ToastProvider
