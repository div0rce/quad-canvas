// apps/api — canonical error handler (T7 shell). Maps Fastify errors to the @quad/core
// ErrorResponse shape. NO DC3 in logs/responses; generic 500 message (no internal leak).
// COOLDOWN_ACTIVE (fairness throttle) is a DISTINCT domain code emitted by the placement
// endpoint later — it is intentionally NOT produced here.
import fp from 'fastify-plugin';
import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { dto } from '@quad/core';

function buildError(code: dto.ErrorCode, message: string, requestId: string): dto.ErrorResponse {
  return { error: { code, message, requestId } };
}

const errorsPlugin: FastifyPluginAsync = async (app) => {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    void reply.status(404).send(buildError('NOT_FOUND', 'Resource not found.', request.id));
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const status = error.statusCode ?? 500;
    let code: dto.ErrorCode;
    let message: string;

    if (error.validation) {
      code = 'VALIDATION_ERROR';
      message = 'Request validation failed.';
    } else if (status === 401) {
      code = 'UNAUTHENTICATED';
      message = 'Authentication required.';
    } else if (status === 403) {
      code = 'FORBIDDEN';
      message = 'Forbidden.';
    } else if (status === 404) {
      code = 'NOT_FOUND';
      message = 'Resource not found.';
    } else if (status === 409) {
      code = 'CONFLICT';
      message = 'Conflict.';
    } else if (status === 429) {
      code = 'RATE_LIMITED';
      message = 'Too many requests.';
    } else if (status >= 400 && status < 500) {
      code = 'VALIDATION_ERROR';
      message = 'Bad request.';
    } else {
      code = 'INTERNAL';
      message = 'Internal server error.';
    }

    // Log server-side detail (never DC3); respond with a safe message only.
    if (status >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'request failed');
    }

    const httpStatus = status >= 400 ? status : 500;
    void reply.status(httpStatus).send(buildError(code, message, request.id));
  });
};

export default fp(errorsPlugin, { name: 'errors' });
