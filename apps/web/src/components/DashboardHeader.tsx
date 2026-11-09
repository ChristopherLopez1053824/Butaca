import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getUserDisplayProfile } from '../auth/userProfile'
import { ButacaLogo } from './ButacaLogo'
import { LogoutIcon } from './icons'

interface DashboardHeaderProps {
  user: User | null
  pending: boolean
  onSignOut: () => void
}

export function DashboardHeader({
  user,
  pending,
  onSignOut,
}: DashboardHeaderProps) {
  const profile = getUserDisplayProfile(user)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const showAvatar = Boolean(
    profile.avatarUrl && profile.avatarUrl !== failedAvatarUrl,
  )

  return (
    <header className="topbar">
      <ButacaLogo subtitle="Tu butaca emocional" />

      <div className="topbar-actions">
        <div className="user-chip">
          <span className="user-avatar" aria-hidden="true">
            {showAvatar ? (
              <img
                src={profile.avatarUrl ?? ''}
                alt=""
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
              />
            ) : (
              profile.initials
            )}
          </span>
          <span className="user-copy">
            <span className="user-name">{profile.name}</span>
          </span>
        </div>

        <button
          type="button"
          className="button button-ghost button-small"
          onClick={onSignOut}
          disabled={pending}
        >
          <LogoutIcon className="button-icon" />
          {pending ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </header>
  )
}
