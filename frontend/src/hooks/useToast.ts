import { useCallback } from 'react'
import { useToastContext } from '@/components/ToastProvider'

export const useToast = () => {
  const { showToast } = useToastContext()

  const info = useCallback((message: string) => showToast(message, 'info'), [showToast])
  const success = useCallback((message: string) => showToast(message, 'success'), [showToast])
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast])

  return { showToast, info, success, error }
}

export default useToast
