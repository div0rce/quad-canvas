import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CanvasView } from './canvas-view';

describe('CanvasView', () => {
  it('docks the keyboard status inside the canvas column instead of after the canvas body', () => {
    const html = renderToStaticMarkup(<CanvasView />);
    const canvasColumn = html.indexOf('class="quad-canvas-col"');
    const status = html.indexOf('id="canvas-keyboard-status"');
    const rail = html.indexOf('class="quad-canvas-rail"');

    expect(canvasColumn).toBeGreaterThanOrEqual(0);
    expect(status).toBeGreaterThan(canvasColumn);
    expect(status).toBeLessThan(rail);
    expect(html).toContain('class="quad-canvas-keyboard-status"');
    expect(html).toContain('Focus the canvas to navigate cells');
  });
});
