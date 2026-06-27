import { CanvasView } from '@/canvas/canvas-view';
import { SessionBadge } from '@/auth/session-badge';

// The live canvas route: paints the current canvas from the REST snapshot, applies WebSocket deltas
// in real time, and lets a signed-in member place a pixel (click a cell → pick a color → confirm).
export default function CanvasPage(): React.ReactElement {
  return (
    <main style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
        <h1>Live Canvas</h1>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
          <a href="/leaderboards">Leaderboard</a>
          <a href="/archives">Archives</a>
          <SessionBadge />
        </nav>
      </div>
      <p>Click a cell, choose a color, then confirm to place a pixel. Placing requires a signed-in account.</p>
      <CanvasView />
    </main>
  );
}
