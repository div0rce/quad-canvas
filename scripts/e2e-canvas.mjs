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

  // Wheel zoom → the Reset-view control appears (scale > fit).
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -360);
  const zoomWorks = !!(await page.waitForSelector('button:has-text("Reset view")', { timeout: 4000 }).catch(() => null));

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

  const results = { selectWorks, zoomWorks, panWorks, selectAfterGestures, pinchWorks, oneQuickLookPerSelection };
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
