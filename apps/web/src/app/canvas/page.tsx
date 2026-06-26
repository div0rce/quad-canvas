import { CanvasView } from '@/canvas/canvas-view';

// The live canvas route: paints the current canvas from the REST snapshot and applies WebSocket
// deltas in real time. Read/view only until placement auth lands (M20).
export default function CanvasPage(): React.ReactElement {
  return (
    <main style={{ padding: '1rem' }}>
      <h1>Live Canvas</h1>
      <CanvasView />
    </main>
  );
}
