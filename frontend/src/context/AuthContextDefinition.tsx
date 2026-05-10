import { createContext, useContext } from 'react'

export interface AuthContextProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any | null // could be Supabase User or our backend user shape
  loading: boolean
  // Returns the fresh user record (or null) so callers that need to route
  // based on role can do so synchronously after the await — React's setState
  // is async, so reading `user` from the closure right after refetch() is
  // stale.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => Promise<any | null>
}

export const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  refetch: async () => null,
})

export const useAuth = () => useContext(AuthContext)
