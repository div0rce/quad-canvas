import { CanvasView } from '@/canvas/canvas-view';
import { SessionBadge } from '@/auth/session-badge';
import { AppBar } from '@/components/ui/app-bar';
import { resolveCurrentTenant } from '@/lib/tenant';

// The live canvas route: paints the current canvas from the REST snapshot, applies WebSocket deltas
// in real time, and lets a signed-in member place a pixel (click a cell → pick a color → confirm).
export default async function CanvasPage(): Promise<React.ReactElement> {
  const tenant = await resolveCurrentTenant();
  return (
    <main className="quad-page">
      <p className="quad-board-label">Live canvas</p>
      <div className="quad-panel quad-canvas-page">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={[
            { label: 'Canvas', href: '/canvas', active: true },
            { label: 'Leaderboard', href: '/leaderboards' },
            { label: 'Archive', href: '/archives' },
          ]}
          right={<SessionBadge />}
        />
        <h1 className="quad-sr-only">Live canvas</h1>
        <CanvasView />
      </div>
    </main>
  );
}
