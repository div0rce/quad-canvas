// Quad — canvas browser e2e (M19). Drives the live canvas in a real browser against the full edge
// stack and asserts the interaction works: tap-to-select (pointer-up based, robust to pointer
// capture), wheel zoom, drag pan, and a two-finger PINCH via real touch (CDP) — the DOM parts a
// build can't verify. (`pinchScale`/`clampPan` are also unit-tested.) Exits non-zero on any failure
// and runs against the production image set in CI.
//
// Prerequisites:
//   docker compose -f docker-compose.prod.yml --env-file .env.prod.example up -d --build
//   # seed an active canvas (the API serves dims from it):
//   docker exec quad-postgres-1 psql -U quad -d quad \
//     -c "INSERT INTO \"Tenant\"(id,slug,\"publicTitle\",status,\"updatedAt\") VALUES ('ten_rutgers','rutgers','Rutgers Quad','active',now()) ON CONFLICT (id) DO NOTHING;" \
//     -c "INSERT INTO \"Canvas\"(id,\"tenantId\",\"termLabel\",status,width,height,\"updatedAt\") VALUES ('cv_e2e','ten_rutgers','F26','active',40,30,now()) ON CONFLICT (id) DO NOTHING;"
//   pnpm test:e2e:install
//   E2E_URL=http://rutgers.localhost:8088/canvas pnpm test:e2e
import { chromium } from 'playwright';

const E2E_URL = process.env.E2E_URL ?? 'http://rutgers.localhost:8088/canvas';
const DIALOG = '[role="dialog"][aria-label="Place a pixel"]';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, hasTouch: true });
try {
  let currentPixelReads = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/^\/api\/v1\/canvas\/current\/pixels\/\d+\/\d+$/.test(path)) currentPixelReads += 1;
  });
  await page.goto(E2E_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  const box = await (await page.$('canvas')).boundingBox();
  const layoutContract = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.quad-canvas');
    const stage = document.querySelector('.quad-canvas-stage');
    const footer = document.querySelector('.quad-canvas-footer');
    const canvasRect = canvas?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const canvasLabel = canvas?.getAttribute('aria-label') ?? '';

    return {
      canvasAboveFooter: !!canvasRect && !!footerRect && canvasRect.bottom <= footerRect.top + 1,
      canvasFillsStage:
        !!canvasRect &&
        !!stageRect &&
        Math.abs(canvasRect.width - stageRect.width) < 1 &&
        Math.abs(canvasRect.height - stageRect.height) < 1,
      canvasInstructionsOnLabel:
        canvasLabel.includes('focus the canvas to navigate cells with the arrow keys') &&
        canvasLabel.includes('press Enter to choose a color'),
      footerPinnedInViewport: !!footerRect && footerRect.bottom <= window.innerHeight && footerRect.top >= window.innerHeight - 96,
      noCanvasStatusDescription: canvas?.getAttribute('aria-describedby') !== 'canvas-keyboard-status',
      noDocumentScroll: document.documentElement.scrollHeight <= window.innerHeight && document.body.scrollHeight <= window.innerHeight,
      noKeyboardStatusElement:
        !document.getElementById('canvas-keyboard-status') && !document.querySelector('.quad-canvas-keyboard-status'),
    };
  });
  const transformOf = () =>
    page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c?.parentElement ? getComputedStyle(c.parentElement).transform : 'none';
    });
  const scaleOf = () =>
    page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c?.parentElement ? new DOMMatrixReadOnly(getComputedStyle(c.parentElement).transform).a : 1;
    });

  // Tap-to-select (the placement entry point; robust to pointer capture).
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  const selectWorks = !!(await page.waitForSelector(DIALOG, { timeout: 5000 }).catch(() => null));

  // Wheel zoom → the canvas layer scale increases.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const scaleBeforeWheel = await scaleOf();
  await page.mouse.wheel(0, -360);
  const zoomWorks = (await scaleOf()) > scaleBeforeWheel + 0.05;

  // Drag pan → the layer transform changes.
  const before = await transformOf();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 - 60, box.y + box.height * 0.5 - 40, { steps: 6 });
  await page.mouse.up();
  const panWorks = before !== (await transformOf());

  // Tap-to-select still works after the gestures. Close the dialog first so the assertion proves the
  // POST-gesture tap re-opened it (not that the original selection is merely still mounted).
  await page.click('button:has-text("Cancel")');
  await page.waitForSelector(DIALOG, { state: 'detached', timeout: 3000 });
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.45);
  const selectAfterGestures = !!(await page.waitForSelector(DIALOG, { timeout: 3000 }).catch(() => null));
  const pickerChrome = await page.evaluate((dialogSelector) => {
    const dialog = document.querySelector(dialogSelector);
    const paletteButtons = dialog?.querySelectorAll('button[data-palette-color]');
    const customToggle = dialog?.querySelector('button[aria-label="Custom color editor"]');
    const customTextInput = dialog?.querySelector('#quad-custom-color-input');
    return {
      paletteHasThirtyTwoColors: paletteButtons?.length === 32,
      hasCustomToggle: customToggle instanceof HTMLButtonElement,
      hasNoManualCustomColorInput: !(customTextInput instanceof HTMLInputElement),
    };
  }, DIALOG);
  await page.click('button[aria-label="Custom color editor"]');
  await page.waitForSelector('#quad-custom-color-editor', { timeout: 3000 });
  const editorChrome = await page.evaluate(() => {
    const editor = document.querySelector('#quad-custom-color-editor');
    const eyedropper = editor?.querySelector('.quad-eyedropper-btn');
    const nativeInput = editor?.querySelector('input[type="color"]');
    const preview = editor?.querySelector('.quad-custom-preview');
    const textInput = editor?.querySelector('input[type="text"]');
    return {
      customEditorAppearsBelow: !!editor,
      hasHighResEyedropperButton: !!eyedropper && !!eyedropper.querySelector('.quad-eyedropper-icon'),
      hasNativeCustomColorInput: nativeInput instanceof HTMLInputElement,
      hasPixelPreview: preview instanceof HTMLButtonElement,
      editorHasNoTextInput: !(textInput instanceof HTMLInputElement),
    };
  });
  await page.locator('#quad-custom-color-r').evaluate((input) => {
    input.value = '18';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#quad-custom-color-g').evaluate((input) => {
    input.value = '171';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#quad-custom-color-b').evaluate((input) => {
    input.value = '52';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('button:has-text("Save custom color")');
  const customColorEditorWorks = await page.evaluate(() => {
    const editor = document.querySelector('#quad-custom-color-editor');
    const customSwatch = document.querySelector('button[data-custom-color-swatch]');
    const confirm = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Confirm');
    return (
      !editor &&
      customSwatch?.getAttribute('aria-pressed') === 'true' &&
      confirm instanceof HTMLButtonElement &&
      !confirm.disabled
    );
  });

  // Two-finger PINCH via real touch (CDP) → the two-pointer branch zooms in (scale increases).
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const client = await page.context().newCDPSession(page);
  const touch = (type, pts) => client.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const scaleBeforePinch = await scaleOf();
  await touch('touchStart', [{ x: cx - 20, y: cy, id: 1 }, { x: cx + 20, y: cy, id: 2 }]);
  for (let d = 30; d <= 150; d += 30) await touch('touchMove', [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(100);
  const pinchWorks = (await scaleOf()) > scaleBeforePinch + 0.05;
  const oneQuickLookPerSelection = currentPixelReads === 2;

  const results = {
    ...layoutContract,
    selectWorks,
    ...pickerChrome,
    ...editorChrome,
    customColorEditorWorks,
    zoomWorks,
    panWorks,
    selectAfterGestures,
    pinchWorks,
    oneQuickLookPerSelection,
  };
  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  console.log(JSON.stringify(results, null, 2));
  if (failed.length) {
    console.error('CANVAS E2E FAILED: ' + failed.join(', '));
    process.exitCode = 1;
  } else {
    console.log('CANVAS E2E PASSED');
  }
} finally {
  await browser.close();
}
