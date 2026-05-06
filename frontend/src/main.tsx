import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ToastProvider'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      // A flaky-wifi reconnect should NOT trigger a full re-fetch of
      // every active query — perceived-latency tax for no freshness
      // gain. Users can pull-to-refresh manually.
      refetchOnReconnect: false,
      retry: 1,
    },
  },
})

// Cold-start probe — fires the moment this module parses, racing with
// React's first render. By the time the user's first authenticated
// request lands, the Render free-tier container has either woken up or
// is already warm.
;(() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  fetch(`${apiUrl}/health/live`, { credentials: 'omit' }).catch(() => {
    // Best-effort; we only care about the wakeup, not the response.
  })
})()

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>  
       
          <AuthProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </AuthProvider>
      
      </QueryClientProvider>
    </StrictMode>,
  )
}