import type { User } from '@supabase/supabase-js'

export interface UserDisplayProfile {
  name: string
  avatarUrl: string | null
  initials: string
}

function readMetadataString(
  metadata: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

export function getUserDisplayProfile(user: User | null): UserDisplayProfile {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const name =
    readMetadataString(metadata, [
      'full_name',
      'name',
      'display_name',
      'user_name',
      'preferred_username',
      'given_name',
    ]) ?? 'Usuario'

  const avatarUrl = readMetadataString(metadata, [
    'avatar_url',
    'picture',
    'image',
  ])

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U'

  return {
    name,
    avatarUrl,
    initials,
  }
}
