// Quad — visual/frontend validation gate.
//
// This is intentionally a contract + artifact gate, not a pixel-baseline test:
// - captures desktop/mobile screenshots for each target route;
// - fails on browser console/page errors;
// - asserts the visible Rutgers frontend contract;
// - optionally enforces the branded design-system surface used for release promotion review.
//
// Usage:
//   pnpm test:e2e:install
//   pnpm test:visual
//   VISUAL_TARGETS='test=https://quad-canvas-web-test.vercel.app,prod=https://quad-canvas-web-production.vercel.app' pnpm test:visual
//   VISUAL_FRONTEND_PROFILE=brand VISUAL_TARGETS='local=http://rutgers.localhost:3002' pnpm test:visual
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_TARGET = 'local=http://rutgers.localhost:3002';
const profile = process.env['VISUAL_FRONTEND_PROFILE'] ?? (process.env['VISUAL_EXPECT_BRANDED'] === '1' ? 'brand' : 'smoke');
if (!['smoke', 'brand'].includes(profile)) {
  throw new Error(`Unsupported VISUAL_FRONTEND_PROFILE "${profile}". Expected "smoke" or "brand".`);
}
const targetSpec =
  process.env['VISUAL_TARGETS'] ??
  (process.env['VISUAL_BASE_URL'] ? `target=${process.env['VISUAL_BASE_URL']}` : DEFAULT_TARGET);
const settleMs = Number(process.env['VISUAL_SETTLE_MS'] ?? '750');

const viewports = [
  { name: 'desktop', width: 1280, height: 720, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

const routes = [
  { name: 'home', path: '/' },
  { name: 'canvas', path: '/canvas' },
];
const ignoredResourceErrorPaths = new Set([
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  // The session badge deliberately degrades to signed-out UI when the API is unavailable; the
  // browser still logs the failed probe as a resource error, which is not a visual failure.
  '/api/v1/session',
]);

function parseTargets(spec) {
  return spec
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const equals = part.indexOf('=');
      const name = equals > 0 ? part.slice(0, equals).trim() : `target-${index + 1}`;
      const url = equals > 0 ? part.slice(equals + 1).trim() : part;
      if (!url) throw new Error(`VISUAL_TARGETS entry "${part}" did not include a URL`);
      return { name: sanitize(name), baseUrl: url.replace(/\/+$/, '') };
    });
}

function sanitize(value) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'target';
}

function joinUrl(baseUrl, routePath) {
  const url = new URL(baseUrl);
  url.pathname = routePath;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function textMatches(text, pattern) {
  return pattern.test(text.replace(/\s+/g, ' '));
}

function classifyConsoleError(message) {
  if (message.type() !== 'error') return true;
  const text = message.text();
  const locationUrl = message.location().url;
  if (!locationUrl || !textMatches(text, /Failed to load resource/i)) return { ignored: false, fatal: true, text };
  try {
    const pathname = new URL(locationUrl).pathname;
    if (ignoredResourceErrorPaths.has(pathname)) return { ignored: true, fatal: false, text };
    if (pathname.startsWith('/api/v1/')) return { ignored: false, fatal: false, text: `${text} (${locationUrl})` };
    return { ignored: false, fatal: true, text: `${text} (${locationUrl})` };
  } catch {
    return { ignored: false, fatal: true, text };
  }
}

function assertContract(result) {
  const failures = [];
  const text = result.bodyText;

  if (text.trim().length < 20) failures.push('page rendered too little visible text');
  if (textMatches(text, /404: This page could not be found|Application error|Unhandled Runtime Error/i)) {
    failures.push('page rendered a framework error surface');
  }
  if ((result.route === 'home' || profile === 'brand') && !textMatches(text, /\bQuad\b/i)) {
    failures.push('page did not render the Quad brand');
  }
  if ((result.route === 'home' || profile === 'brand') && !textMatches(text, /Rutgers|RUTGERS/i)) {
    failures.push('page did not render the Rutgers tenant context');
  }

  if (result.route === 'home') {
    if (!textMatches(text, /Open live canvas|VIEW THE CANVAS|Live canvas/i)) {
      failures.push('home page did not expose a live-canvas entry point');
    }
    if (profile === 'brand') {
      if (!textMatches(text, /One campus/i)) failures.push('branded home page is missing "One campus"');
      if (!textMatches(text, /One pixel/i)) failures.push('branded home page is missing "One pixel"');
      if (!textMatches(text, /One semester/i)) failures.push('branded home page is missing "One semester"');
      if (!textMatches(text, /LIVE NOW/i)) failures.push('branded home page is missing "LIVE NOW"');
      if (!textMatches(text, /SIGN IN/i)) failures.push('branded home page is missing sign-in navigation');
    }
  }

  if (result.route === 'canvas') {
    if (!textMatches(text, /Live canvas/i)) failures.push('canvas page did not render the live-canvas heading');
    if (result.canvasCount < 1) failures.push('canvas page did not render a canvas element');
    if (result.canvasBusyCount > 0) failures.push('canvas remained aria-busy after the settle window');
    if (textMatches(text, /CANVAS LOADING|Loading canvas/i)) failures.push('canvas remained stuck in a loading state');
    if (profile === 'brand') {
      if (!textMatches(text, /YOUR NEXT PIXEL/i)) failures.push('branded canvas is missing the next-pixel panel');
      if (!textMatches(text, /\bLIVE\b/i)) failures.push('branded canvas is missing live status copy');
    }
  }

  for (const error of result.consoleErrors) failures.push(`browser console error: ${error}`);
  for (const error of result.pageErrors) failures.push(`page error: ${error}`);

  return failures;
}

async function inspectPage(page, target, route, viewport) {
  const consoleErrors = [];
  const nonFatalConsoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    const classified = classifyConsoleError(message);
    if (classified === true || classified.ignored) return;
    if (classified.fatal) {
      consoleErrors.push(classified.text);
    } else {
      nonFatalConsoleErrors.push(classified.text);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const url = joinUrl(target.baseUrl, route.path);
  let navigationError = null;
  let loadingSettled = true;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    if (route.name === 'canvas') {
      await page
        .waitForFunction(() => !/CANVAS LOADING|Loading canvas/i.test(document.body.innerText), null, {
          timeout: 15_000,
        })
        .catch(() => {
          loadingSettled = false;
        });
    }
    if (settleMs > 0) await page.waitForTimeout(settleMs);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const pageInfo = await page
    .evaluate(() => {
      const bodyText = document.body?.innerText ?? '';
      const headings = [...document.querySelectorAll('h1,h2')].map((heading) => heading.textContent?.trim() ?? '');
      const canvasElements = [...document.querySelectorAll('canvas')];
      const canvasBusyCount = canvasElements.filter((canvas) => canvas.getAttribute('aria-busy') === 'true').length;
      return {
        bodyText,
        headings,
        htmlClass: document.documentElement.className,
        title: document.title,
        canvasCount: canvasElements.length,
        canvasBusyCount,
      };
    })
    .catch((error) => ({
      bodyText: '',
      headings: [],
      htmlClass: '',
      title: '',
      canvasCount: 0,
      canvasBusyCount: 0,
      evaluateError: error instanceof Error ? error.message : String(error),
    }));

  const screenshotName = `${target.name}-${viewport.name}-${route.name}.png`;
  const screenshotPath = path.join(outputRoot, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
    pageErrors.push(`screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
  });

  const result = {
    target: target.name,
    baseUrl: target.baseUrl,
    route: route.name,
    path: route.path,
    url,
    viewport: viewport.name,
    profile,
    screenshotPath,
    navigationError,
    loadingSettled,
    consoleErrors,
    nonFatalConsoleErrors,
    pageErrors,
    ...pageInfo,
  };

  const failures = assertContract(result);
  if (navigationError) failures.unshift(`navigation failed: ${navigationError}`);
  if (!loadingSettled) failures.push('canvas loading text did not settle before timeout');
  if ('evaluateError' in pageInfo) failures.push(`page evaluation failed: ${pageInfo.evaluateError}`);

  return { ...result, failures };
}

function summarizeResult(result) {
  const state = result.failures.length ? 'FAIL' : 'PASS';
  const textPreview = result.bodyText.replace(/\s+/g, ' ').trim().slice(0, 160);
  return `${state} ${result.target}/${result.viewport}/${result.route} ${result.url}\n  screenshot: ${result.screenshotPath}\n  text: ${textPreview}`;
}

const targets = parseTargets(targetSpec);
const targetRunName = targets.map((target) => target.name).join('-');
const outputRoot = path.resolve(process.env['VISUAL_OUTPUT_DIR'] ?? `test-results/visual-frontend/${profile}/${targetRunName}`);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch();
const results = [];
try {
  for (const target of targets) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        hasTouch: viewport.isMobile,
      });
      try {
        for (const route of routes) {
          const page = await context.newPage();
          try {
            results.push(await inspectPage(page, target, route, viewport));
          } finally {
            await page.close().catch(() => {});
          }
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outputRoot, 'report.json');
await writeFile(reportPath, JSON.stringify({ profile, targets, generatedAt: new Date().toISOString(), results }, null, 2) + '\n');

for (const result of results) {
  console.log(summarizeResult(result));
  for (const failure of result.failures) console.log(`  - ${failure}`);
}
console.log(`VISUAL FRONTEND REPORT: ${reportPath}`);

const failed = results.filter((result) => result.failures.length > 0);
if (failed.length > 0) {
  console.error(`VISUAL FRONTEND GATE FAILED: ${failed.length}/${results.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`VISUAL FRONTEND GATE PASSED: ${results.length} checks passed`);
}
