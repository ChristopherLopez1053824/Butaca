interface SectionHeaderProps {
  title: string
  titleId?: string
  description?: string
  badge?: string
  badgeTone?: 'default' | 'accent' | 'real'
}

export function SectionHeader({
  title,
  titleId,
  description,
  badge,
  badgeTone = 'default',
}: SectionHeaderProps) {
  const badgeClass =
    badgeTone === 'accent'
      ? 'badge badge-accent'
      : badgeTone === 'real'
        ? 'badge badge-real'
        : 'badge'

  return (
    <div className="section-header">
      <div>
        <div className="section-title-row">
          <h2 id={titleId}>{title}</h2>
          {badge && <span className={badgeClass}>{badge}</span>}
        </div>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}
