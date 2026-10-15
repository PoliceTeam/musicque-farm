import type { FastifyRequest } from 'fastify';

/** Request/command metadata only; never log bodies, cookies or outfits. */
export function operationTrace(request: FastifyRequest, operation: string, commandId?: string) {
  const log = request.log.child({ operation, ...(commandId ? { commandId } : {}) });
  return (phase: string) => {
    request.log = log.child({ phase });
    request.log.debug('player operation');
  };
}
