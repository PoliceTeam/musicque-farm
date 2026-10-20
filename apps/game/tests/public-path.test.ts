import { describe, expect, it } from 'vitest';
import { publicPath, realtimeUrl, routePath } from '@/application/_utils/public-path';

describe('deployment URLs', () => {
  it('keeps dev paths and prefixes public assets and full-page navigation in production', () => {
    for (const path of ['/', '/icons/icon-192.png', '/chibi-assets/map/a.webp?v=abc']) {
      expect(publicPath(path, '')).toBe(path);
      expect(publicPath(path, '/farm')).toBe(`/farm${path}`);
    }
  });
  it('strips the prefix only at browser-link boundaries, including the Farm entrance route', () => {
    expect(routePath('/farm', '/farm')).toBe('/');
    expect(routePath('/farm?auth=sso#table', '/farm')).toBe('/?auth=sso#table');
    expect(routePath('/farm/farm', '/farm')).toBe('/farm');
    expect(routePath('/farm/play/fun/arcade?room=2', '/farm')).toBe('/play/fun/arcade?room=2');
    expect(routePath('/farmhouse', '/farm')).toBeUndefined();
    expect(routePath('/api', '/farm')).toBeUndefined();
    expect(routePath('/farm', '')).toBe('/farm');
  });
  it('connects to the API WebSocket under the deployed prefix', () => {
    expect(realtimeUrl('/farm/api', 'https://musicque.politetech.com/farm')).toBe(
      'wss://musicque.politetech.com/farm/api/ws',
    );
    expect(realtimeUrl('http://127.0.0.1:3010/api', 'http://127.0.0.1:5173')).toBe('ws://127.0.0.1:3010/api/ws');
  });
});
