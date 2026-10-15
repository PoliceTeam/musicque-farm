import { expect, it } from 'vitest';
import { roomKeys } from '../src/redis-keys.js';
import { connectionScript, renewScript, roomScript, unlockScript } from '../src/scripts.js';

it('co-locates each room hash and presence index without collapsing unrelated topics into one slot', () => {
  for (const topic of ['street:1', 'street:2', '{injected}:1', '日本:3']) {
    const [hash, ...indexes] = roomKeys('chibi:', topic);

    const tag = (key: string) => key.match(/\{([^{}]+)\}/)![1];

    for (const index of indexes) expect(tag(hash)).toBe(tag(index));
    expect(tag(hash)).toBe(encodeURIComponent(topic));
  }
  expect(roomKeys('chibi:', 'street:1')[0]).not.toBe(roomKeys('chibi:', 'street:2')[0]);
});

it('only accesses declared KEYS in Lua and never discovers keys or acquires a global room lock', () => {
  for (const script of [roomScript, connectionScript, renewScript, unlockScript]) {
    const calls = [...script.matchAll(/redis\.call\('([^']+)'\s*,\s*([^,\n)]+)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const [, command, key] of calls) {
      expect(['SCAN', 'KEYS']).not.toContain(command);
      expect(key).toMatch(/^KEYS\[[12345]\]$/);
    }
  }
});
