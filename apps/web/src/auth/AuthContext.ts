import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type OAuthProvider = 'google' | 'github'

export type SignUpStatus =
  | 'signed_in'
  | 'confirmation_required'
  | 'error'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  pending: boolean
  error: string | null
  isConfigured: boolean
  signInWithEmail: (email: string, password: string) => Promise<boolean>
  signUpWithEmail: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<SignUpStatus>
  signInWithOAuth: (provider: OAuthProvider) => Promise<boolean>
  signOut: () => Promise<boolean>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  }

  return context
}
