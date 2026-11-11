import { useCallback, useEffect, useState } from 'react'
import { checkGateway } from '../services/api'
import { useAutoWake } from '../hooks/useAutoWake'
import type { WakeServiceStatus } from '../hooks/useAutoWake'

const services = [
  { name: 'User Service', shortName: 'User', route: 'users' },
  { name: 'Emotion Service', shortName: 'Emotion', route: 'emotions' },
  { name: 'Movie Service', shortName: 'Movie', route: 'movies' },
  { name: 'Favorites Service', shortName: 'Favs', route: 'favorites' },
  { name: 'Dashboard Service', shortName: 'Dash', route: 'dashboard' },
  { name: 'Meme Service', shortName: 'Meme', route: 'memes' },
] as const

type GatewayStatus = 'checking' | 'online' | 'offline'
type DisplayStatus = GatewayStatus | WakeServiceStatus

function getGatewayStatusLabel(status: GatewayStatus) {
  if (status === 'online') {
    return 'Conectado'
  }

  if (status === 'offline') {
    return 'Desconectado'
  }

  return 'Comprobando...'
}

function getServiceStatusLabel(status: DisplayStatus) {
  switch (status) {
    case 'online':
      return 'Conectado'
    case 'waking':
      return 'Despertando...'
    case 'timeout':
      return 'Tiempo de espera agotado'
    case 'error':
      return 'Error'
    case 'offline':
      return 'Desconectado'
    default:
      return 'Comprobando...'
  }
}

export function ServiceStatusPanel() {
  const [gateway, setGateway] = useState<GatewayStatus>('checking')
  const { snapshot, retry } = useAutoWake()

  const checkGatewayStatus = useCallback(async () => {
    setGateway('checking')

    try {
      await checkGateway()
      setGateway('online')
    } catch {
      setGateway('offline')
    }
  }, [])

  useEffect(() => {
    void checkGatewayStatus()
  }, [checkGatewayStatus])

  const loading = snapshot?.waking ?? true
  const onlineCount = snapshot?.onlineCount ?? 0
  const total = snapshot?.total ?? services.length

  function handleRetry() {
    void checkGatewayStatus()
    retry()
  }

  return (
    <section className="service-bar" aria-labelledby="services-title">
      <div className="service-bar-head">
        <div>
          <span className="eyebrow">Estado del sistema</span>
          <h2 id="services-title">
            Servicios conectados: {onlineCount}/{total}
          </h2>
        </div>

        <span className={`status-pill ${gateway}`}>
          {getGatewayStatusLabel(gateway)}
        </span>
      </div>

      <div className="service-bar-body">
        <div className="service-bar-list">
          <span className={`service-chip gateway ${gateway}`}>
            <span className="service-dot" aria-hidden="true" />
            API GW
          </span>

          {services.map((service) => {
            const status: DisplayStatus =
              snapshot?.services[service.route]?.status ?? 'checking'

            return (
              <span
                className={`service-chip ${status}`}
                key={service.route}
                title={`${service.name}: ${getServiceStatusLabel(status)}`}
                aria-label={`${service.name}: ${getServiceStatusLabel(status)}`}
              >
                <span className="service-dot" aria-hidden="true" />
                {service.shortName}
              </span>
            )
          })}
        </div>

        <button
          type="button"
          className="button button-ghost button-small"
          onClick={handleRetry}
          disabled={loading}
        >
          {loading ? 'Despertando servicios...' : 'Volver a comprobar'}
        </button>
      </div>
    </section>
  )
}
