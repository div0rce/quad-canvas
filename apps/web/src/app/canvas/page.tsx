import { CanvasView } from '@/canvas/canvas-view';

// The live canvas route: paints the current canvas from the REST snapshot, applies WebSocket deltas
// in real time, and lets a signed-in member place a pixel (click a cell → pick a color → confirm).
export default function CanvasPage(): React.ReactElement {
  return (
    <main style={{ padding: '1rem' }}>
      <h1>Live Canvas</h1>
      <p>Click a cell, choose a color, then confirm to place a pixel. Placing requires a signed-in account.</p>
      <CanvasView />
    </main>
  );
}
