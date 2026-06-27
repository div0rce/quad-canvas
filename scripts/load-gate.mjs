// Load gate (G6 / launch gate). Drives the built API over real HTTP at a fixed concurrency for a
// fixed duration, measures throughput + latency percentiles + error rate, and exits non-zero if any
// threshold is missed. Self-contained: it boots the app in-process on an ephemeral port and targets
// the dependency-free liveness path, so it needs no Postgres/Redis and is deterministic in CI.
//
// Usage: node scripts/load-gate.mjs  (override CONCURRENCY/DURATION_MS/TARGET_PATH via env)
import { buildApp } from '../apps/api/dist/app.js';

const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 50);
const DURATION_MS = Number(process.env.LOAD_DURATION_MS ?? 5000);
const WARMUP_MS = Number(process.env.LOAD_WARMUP_MS ?? 750);
// Default target is the dependency-free liveness path — so this gauges the HTTP stack baseline
// (routing + the security-headers/access-log/metrics/rate-limit hooks) with no Postgres/Redis. A
// DB-backed workload test against the read path is a follow-up. NOTE: pointing this at a tenant-
// scoped route won't work as-is — Node's fetch forbids setting the `Host` header, so tenant
// resolution can't be driven from here without a proxy/loopback that rewrites Host.
const TARGET_PATH = process.env.LOAD_TARGET_PATH ?? '/healthz';
// Per-request timeout so a regression that accepts the connection but never responds is counted as
// an error (raising the error rate to trip the gate) instead of hanging a worker forever.
const REQ_TIMEOUT_MS = Number(process.env.LOAD_REQ_TIMEOUT_MS ?? 5000);

// Thresholds — modest, with headroom over observed in-process numbers; tighten as infra firms up.
const MIN_RPS = Number(process.env.LOAD_MIN_RPS ?? 2000);
const MAX_P99_MS = Number(process.env.LOAD_MAX_P99_MS ?? 50);
const MAX_ERROR_RATE = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.01);

const app = await buildApp();
await app.listen({ port: 0, host: '127.0.0.1' });
const addr = app.server.address();
const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
const url = `${base}${TARGET_PATH}`;

async function drive(deadline, sink) {
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (performance.now() < deadline) {
      const start = performance.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(REQ_TIMEOUT_MS) });
        await res.text();
        sink.push({ ms: performance.now() - start, ok: res.ok });
      } catch {
        // Timeout/abort/connection error → a failed request (never a hang).
        sink.push({ ms: performance.now() - start, ok: false });
      }
    }
  });
  await Promise.all(workers);
}

// Warm up (JIT, connection setup) without recording, then measure.
await drive(performance.now() + WARMUP_MS, []);
const samples = [];
await drive(performance.now() + DURATION_MS, samples);
await app.close();

const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
const errors = samples.filter((s) => !s.ok).length;
const count = samples.length;
const pct = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] ?? 0;
const rps = count / (DURATION_MS / 1000);
const errorRate = count > 0 ? errors / count : 1;

const result = {
  target: TARGET_PATH,
  concurrency: CONCURRENCY,
  durationMs: DURATION_MS,
  requests: count,
  errors,
  rps: Math.round(rps),
  p50ms: Number(pct(0.5).toFixed(2)),
  p99ms: Number(pct(0.99).toFixed(2)),
  errorRatePct: Number((errorRate * 100).toFixed(3)),
};
console.log(JSON.stringify(result, null, 2));

const failures = [];
if (rps < MIN_RPS) failures.push(`throughput ${result.rps} rps < ${MIN_RPS}`);
if (pct(0.99) > MAX_P99_MS) failures.push(`p99 ${result.p99ms}ms > ${MAX_P99_MS}ms`);
if (errorRate > MAX_ERROR_RATE) failures.push(`error rate ${result.errorRatePct}% > ${MAX_ERROR_RATE * 100}%`);

if (failures.length > 0) {
  console.error(`LOAD GATE FAILED: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`LOAD GATE PASSED (>=${MIN_RPS} rps, p99<=${MAX_P99_MS}ms, errors<=${MAX_ERROR_RATE * 100}%)`);
