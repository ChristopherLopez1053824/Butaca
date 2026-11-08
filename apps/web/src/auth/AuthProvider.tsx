import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { AuthContext } from './AuthContext'
import type { OAuthProvider, SignUpStatus } from './AuthContext'
import { getAuthErrorMessage } from './authErrors'
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SUPABASE_CONFIG_ERROR,
} from '../lib/supabase'

interface AuthProviderProps {
  children: ReactNode
}

function getAuthRedirectUrl() {
  return `${window.location.origin}/auth/callback`
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : SUPABASE_CONFIG_ERROR,
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true
    let client: SupabaseClient

    try {
      client = getSupabaseClient()
    } catch (clientError) {
      setError(getAuthErrorMessage(clientError))
      setLoading(false)
      return
    }

    client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) {
          return
        }

        if (sessionError) {
          setError(getAuthErrorMessage(sessionError))
        }

        setSession(data.session)
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(getAuthErrorMessage(sessionError))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) {
        return
      }

      setSession(nextSession)
      setLoading(false)

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setError(null)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null)
    setPending(true)

    try {
      const client = getSupabaseClient()
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(getAuthErrorMessage(signInError))
        return false
      }

      return true
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  const signUpWithEmail = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
    ): Promise<SignUpStatus> => {
      setError(null)
      setPending(true)

      try {
        const client = getSupabaseClient()
        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })

        if (signUpError) {
          setError(getAuthErrorMessage(signUpError))
          return 'error'
        }

        if (!data.user) {
          setError('No se pudo crear la cuenta. Inténtalo de nuevo.')
          return 'error'
        }

        if (data.session) {
          return 'signed_in'
        }

        return 'confirmation_required'
      } catch (signUpError) {
        setError(getAuthErrorMessage(signUpError))
        return 'error'
      } finally {
        setPending(false)
      }
    },
    [],
  )

  const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
    setError(null)
    setPending(true)

    try {
      const client = getSupabaseClient()
      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      })

      if (oauthError) {
        setError(getAuthErrorMessage(oauthError))
        return false
      }

      return true
    } catch (oauthError) {
      setError(getAuthErrorMessage(oauthError))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    setPending(true)

    try {
      const client = getSupabaseClient()
      const { error: signOutError } = await client.auth.signOut()

      if (signOutError) {
        setError(getAuthErrorMessage(signOutError))
        return false
      }

      return true
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      pending,
      error,
      isConfigured: isSupabaseConfigured,
      signInWithEmail,
      signUpWithEmail,
      signInWithOAuth,
      signOut,
      clearError,
    }),
    [
      session,
      loading,
      pending,
      error,
      signInWithEmail,
      signUpWithEmail,
      signInWithOAuth,
      signOut,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
