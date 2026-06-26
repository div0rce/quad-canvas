// apps/api — rate-limit preHandler factory. Keys by principal (authenticated) or client IP
// (anonymous), scoped per tenant + bucket. On exceed: 429 RATE_LIMITED + Retry-After (never
// conflated with COOLDOWN_ACTIVE). Fails OPEN if the limiter backend errors — abuse protection must
// not take down legitimate traffic when (e.g.) Redis is briefly unavailable.
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { dto } from '@quad/core';
import type { RateLimiter } from './rate-limiter.js';

export interface RateLimitOptions {
  readonly limit: number;
  readonly windowSec: number;
  /** Namespace so different endpoints get independent budgets (e.g. 'place', 'verify'). */
  readonly bucket: string;
}

export function makeRateLimit(limiter: RateLimiter, opts: RateLimitOptions) {
  return async function rateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const subject = request.principal?.userId ?? request.ip;
    const tenantId = request.tenant?.id ?? 'global';
    const key = `${opts.bucket}:${tenantId}:${subject}`;
    let result;
    try {
      result = await limiter.hit(key, opts.limit, opts.windowSec);
    } catch (err) {
      // Fail open — never block legitimate traffic on a limiter backend error — but surface it so a
      // rate-limiting outage is visible (not silently degraded protection).
      request.log.warn({ err, bucket: opts.bucket }, 'rate limiter backend error — failing open');
      return;
    }
    if (!result.allowed) {
      void reply.header('Retry-After', String(result.resetSec));
      const body: dto.ErrorResponse = {
        error: { code: 'RATE_LIMITED', message: 'Too many requests — slow down.', requestId: request.id },
      };
      await reply.status(429).send(body);
    }
  };
}
