import { createContext, useContext } from 'react'

export interface AuthContextProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any | null // could be Supabase User or our backend user shape
  loading: boolean
  refetch: () => void
}

export const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  refetch: () => {}
})

export const useAuth = () => useContext(AuthContext)
