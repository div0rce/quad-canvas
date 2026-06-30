import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CanvasView } from './canvas-view';

describe('CanvasView', () => {
  it('keeps keyboard instructions on the canvas itself without rendering a separate status paragraph', () => {
    const html = renderToStaticMarkup(<CanvasView />);

    expect(html).toContain('class="quad-canvas"');
    expect(html).toContain('focus the canvas to navigate cells with the arrow keys');
    expect(html).not.toContain('id="canvas-keyboard-status"');
    expect(html).not.toContain('aria-describedby="canvas-keyboard-status"');
    expect(html).not.toContain('class="quad-canvas-keyboard-status"');
    expect(html).toContain('Just placed');
    expect(html).not.toContain('One pixel at a time. The cooldown is the same for everyone on campus.');
  });
});
