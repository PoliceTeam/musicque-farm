import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './test-app.js';

describe('operation diagnostics', () => {
  let t: Awaited<ReturnType<typeof createTestApp>> | undefined;
  afterEach(async () => t?.close());

  it('correlates transaction phases and rejection reasons without exposing account data', async () => {
    const logs: Record<string, unknown>[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(JSON.parse(String(chunk)));
        callback();
      },
    });
    t = await createTestApp({ logger: { level: 'debug', stream } });
    const account = await t.register('trace_owner');
    const command = { type: 'buy-cosmetic', offerId: 'pet/cat', requestId: 'trace-purchase', mapInstanceId: 'home' };
    const buy = await t.app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { cookie: account.cookie },
      payload: command,
    });
    expect(buy.statusCode).toBe(200);
    const requestId = buy.headers['x-request-id'];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    const phases = logs.filter((line) => line.reqId === requestId && line.msg === 'player operation');
    expect(phases.map((line) => line.phase)).toEqual([
      'lock-player',
      'load-player',
      'load-inventory',
      'run-operation',
      'save-inventory',
      'save-player',
    ]);
    expect(phases.every((line) => line.playerId === account.player.id && line.commandId === command.requestId)).toBe(
      true,
    );

    const retry = await t.app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { cookie: account.cookie },
      payload: { ...command, requestId: 'trace-duplicate' },
    });
    expect(retry.statusCode).toBe(403);
    expect(retry.json()).toEqual({ code: 'NOT_ALLOWED' });
    expect(retry.headers['x-request-id']).not.toBe(requestId);
    const rejected = logs.find(
      (line) => line.reqId === retry.headers['x-request-id'] && line.msg === 'game operation rejected',
    );
    expect(rejected).toMatchObject({
      playerId: account.player.id,
      commandId: 'trace-duplicate',
      operation: 'buy-cosmetic',
      phase: 'run-operation',
      code: 'NOT_ALLOWED',
      reason: 'COSMETIC_ALREADY_OWNED',
    });
    expect(logs.some((line) => line.reqId === retry.headers['x-request-id'] && line.phase === 'save-inventory')).toBe(
      false,
    );
    const text = JSON.stringify(logs);
    for (const sensitive of [account.cookie, 'correct horse', 'trace_owner@example.test'])
      expect(text).not.toContain(sensitive);
  });

  it('authenticates before processing malformed commands', async () => {
    t = await createTestApp();
    const response = await t.app.inject({ method: 'POST', url: '/api/commands', payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: 'UNAUTHENTICATED' });
  });
});
