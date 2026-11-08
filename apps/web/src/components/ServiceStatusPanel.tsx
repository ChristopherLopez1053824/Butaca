import { useCallback, useEffect, useState } from 'react'
import { checkGateway, checkService } from '../services/api'
import type { HealthResponse } from '../services/api'

const services = [
  { name: 'User Service', shortName: 'User', route: 'users' },
  { name: 'Emotion Service', shortName: 'Emotion', route: 'emotions' },
  { name: 'Movie Service', shortName: 'Movie', route: 'movies' },
  { name: 'Favorites Service', shortName: 'Favs', route: 'favorites' },
  { name: 'Dashboard Service', shortName: 'Dash', route: 'dashboard' },
  { name: 'Meme Service', shortName: 'Meme', route: 'memes' },
] as const

type ServiceStatus = 'checking' | 'online' | 'offline'

function getStatus(response: HealthResponse): ServiceStatus {
  return response.status === 'ok' ? 'online' : 'offline'
}

function getStatusLabel(status: ServiceStatus) {
  if (status === 'online') {
    return 'Conectado'
  }

  if (status === 'offline') {
    return 'Desconectado'
  }

  return 'Comprobando...'
}

export function ServiceStatusPanel() {
  const [gateway, setGateway] = useState<ServiceStatus>('checking')
  const [results, setResults] = useState<Record<string, ServiceStatus>>({})
  const [loading, setLoading] = useState(true)

  const checkConnections = useCallback(async () => {
    setLoading(true)
    setGateway('checking')
    setResults({})

    try {
      await checkGateway()
      setGateway('online')
    } catch {
      setGateway('offline')
    }

    const statuses = await Promise.all(
      services.map(async (service) => {
        try {
          const result = await checkService(service.route)
          return [service.route, getStatus(result)] as const
        } catch {
          return [service.route, 'offline'] as const
        }
      }),
    )

    setResults(Object.fromEntries(statuses))
    setLoading(false)
  }, [])

  useEffect(() => {
    void checkConnections()
  }, [checkConnections])

  const onlineCount = Object.values(results).filter(
    (status) => status === 'online',
  ).length

  return (
    <section className="service-bar" aria-labelledby="services-title">
      <div className="service-bar-head">
        <div>
          <span className="eyebrow">Estado del sistema</span>
          <h2 id="services-title">
            Servicios conectados: {onlineCount}/{services.length}
          </h2>
        </div>

        <span className={`status-pill ${gateway}`}>
          {getStatusLabel(gateway)}
        </span>
      </div>

      <div className="service-bar-body">
        <div className="service-bar-list">
          <span className={`service-chip gateway ${gateway}`}>
            <span className="service-dot" aria-hidden="true" />
            API GW
          </span>

          {services.map((service) => {
            const status = results[service.route] ?? 'checking'

            return (
              <span
                className={`service-chip ${status}`}
                key={service.route}
                title={`${service.name}: ${getStatusLabel(status)}`}
                aria-label={`${service.name}: ${getStatusLabel(status)}`}
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
          onClick={checkConnections}
          disabled={loading}
        >
          {loading ? 'Comprobando...' : 'Volver a comprobar'}
        </button>
      </div>
    </section>
  )
}
