import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

interface HealthResponse {
  status: string;
  timestamp: string;
}

/**
 * Phase-1 placeholder app. Confirms the frontend can reach the backend.
 *
 * Replace with real routing as pages come online:
 *   /           → Dashboard  (WP3)
 *   /habits     → Habit list (WP3)
 *   /habits/:id → Habit detail (WP3)
 *   /analytics  → Global analytics (WP5)
 *   /settings   → Preferences and privacy (WP2+)
 *   /auth/login, /auth/register → (WP2)
 */
export function App(): React.ReactElement {
  const { data, isLoading, isError } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      // Hits /health, which is mounted outside the /api/v1 prefix.
      const url = API_URL.replace(/\/api\/v1\/?$/, '') + '/health';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`health check failed: ${res.status}`);
      return res.json() as Promise<HealthResponse>;
    },
  });

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ color: '#1F3A5F', marginBottom: 8 }}>HabitLab AI</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Phase 1 · scaffolding</p>

      <section style={{ marginTop: 32, padding: 16, borderRadius: 8, border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Backend connection</h2>
        {isLoading && <p>Checking backend…</p>}
        {isError && (
          <p style={{ color: '#c00' }}>
            Backend unreachable. Is it running on port 3001? Try <code>pnpm dev</code>.
          </p>
        )}
        {data && (
          <p style={{ color: '#080' }}>
            ✓ Backend is healthy. Server time: <code>{data.timestamp}</code>
          </p>
        )}
      </section>

      <p style={{ marginTop: 48, color: '#888', fontSize: 14 }}>
        See <code>docs/HabitLab_AI_Analysis_Report.docx</code> for the full spec.
      </p>
    </main>
  );
}
