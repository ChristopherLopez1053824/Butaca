import { ClapperIcon } from './icons'

interface ButacaLogoProps {
  subtitle?: string
  size?: 'md' | 'lg'
  centered?: boolean
}

export function ButacaLogo({
  subtitle,
  size = 'md',
  centered = false,
}: ButacaLogoProps) {
  const className = [
    'brand',
    size === 'lg' ? 'brand-large' : '',
    centered ? 'brand-center' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <span className="brand-mark">
        <ClapperIcon />
      </span>
      <span className="brand-copy">
        <span className="brand-name">Butaca</span>
        {subtitle && <span className="brand-subtitle">{subtitle}</span>}
      </span>
    </div>
  )
}
