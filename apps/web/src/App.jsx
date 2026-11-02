import { useEffect, useState } from 'react';
import { checkGateway, checkService } from './services/api';
import './App.css';

const services = [
  { name: 'User Service', route: 'users' },
  { name: 'Emotion Service', route: 'emotions' },
  { name: 'Movie Service', route: 'movies' },
  { name: 'Favorites Service', route: 'favorites' },
  { name: 'Dashboard Service', route: 'dashboard' },
  { name: 'Meme Service', route: 'memes' }
];

function App() {
  const [gateway, setGateway] = useState('checking');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  async function checkConnections() {
    setLoading(true);

    try {
      await checkGateway();
      setGateway('online');
    } catch {
      setGateway('offline');
    }

    const statuses = await Promise.all(
      services.map(async (service) => {
        try {
          const result = await checkService(service.route);
          return [service.route, result.status === 'ok' ? 'online' : 'offline'];
        } catch {
          return [service.route, 'offline'];
        }
      })
    );

    setResults(Object.fromEntries(statuses));
    setLoading(false);
  }

  useEffect(() => {
    checkConnections();
  }, []);

  const onlineCount = Object.values(results)
    .filter((status) => status === 'online').length;

  return (
    <main className="container">
      <header>
        <h1>Butaca 🎬</h1>
        <p>Panel de conexión de microservicios</p>
      </header>

      <section className="gateway">
        <h2>API Gateway</h2>
        <span className={`status ${gateway}`}>
          {gateway === 'online' ? 'Conectado' :
           gateway === 'offline' ? 'Desconectado' : 'Comprobando...'}
        </span>
      </section>

      <section className="services">
        {services.map((service) => {
          const status = results[service.route] || 'checking';

          return (
            <article className="service-card" key={service.route}>
              <h3>{service.name}</h3>
              <span className={`status ${status}`}>
                {status === 'online' ? 'Conectado' :
                 status === 'offline' ? 'Desconectado' : 'Comprobando...'}
              </span>
            </article>
          );
        })}
      </section>

      <footer>
        <p>
          Servicios conectados: {onlineCount}/{services.length}
        </p>

        <button onClick={checkConnections} disabled={loading}>
          {loading ? 'Comprobando...' : 'Volver a comprobar'}
        </button>
      </footer>
    </main>
  );
}

export default App;
