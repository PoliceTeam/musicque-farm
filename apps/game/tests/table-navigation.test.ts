import { guardTableBack } from '@chibi-town/arcade-games-react/table-navigation';
import { expect, it } from 'vitest';

function browserHistory() {
  const target = new EventTarget();
  const entries = [
    { url: '/previous', state: { router: 'previous' } },
    { url: '/table', state: { router: 'table' } },
  ];
  let index = 1;
  const location = { href: '/table' };
  const history = {
    get state() {
      return entries[index].state;
    },

    pushState(state: object, _: string, url: string) {
      entries.splice(index + 1);
      entries.push({ state: state as { router: string }, url });
      index++;
    },

    go(delta: number) {
      index = Math.max(0, Math.min(entries.length - 1, index + delta));
      location.href = entries[index].url;
      const event = new Event('popstate');
      Object.defineProperty(event, 'state', { value: history.state });
      target.dispatchEvent(event);
    },

    back() {
      history.go(-1);
    },
  };
  return {
    browser: {
      history,
      location,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    } as unknown as Parameters<typeof guardTableBack>[0],
    history,
    location,
    target,
  };
}

it('restores the table before confirmation and preserves host-router state', () => {
  const b = browserHistory();
  let approve: (() => void) | undefined;
  const dispose = guardTableBack(b.browser, (done) => {
    expect(b.location.href).toBe('/table');
    approve = done;
  });
  expect(b.history.state.router).toBe('table');
  b.history.back();
  expect(b.location.href).toBe('/table');
  expect(approve).toBeTypeOf('function');
  approve!();
  expect(b.location.href).toBe('/previous');
  dispose();
});

it('stays at the table if cancelled, then allows another Back request', async () => {
  const b = browserHistory();
  let requests = 0;
  const dispose = guardTableBack(b.browser, () => requests++);
  b.history.back();
  expect(b.location.href).toBe('/table');
  b.history.back();
  expect(requests).toBe(2);
  expect(b.location.href).toBe('/table');
  dispose();
  await Promise.resolve();
  b.history.back();
  expect(b.location.href).toBe('/previous');
});

it('does not let the host router see intercepted Back while confirmation is pending', () => {
  const b = browserHistory();
  let routerEvents = 0;
  const dispose = guardTableBack(b.browser, () => {});
  b.target.addEventListener('popstate', () => routerEvents++);
  b.history.back();
  expect(routerEvents).toBe(0);
  dispose();
});

it('reuses the history entry when React reattaches the guard immediately', async () => {
  const b = browserHistory();
  const first = guardTableBack(b.browser, () => {});
  first();
  const second = guardTableBack(b.browser, (done) => done());
  await Promise.resolve();
  b.history.back();
  expect(b.location.href).toBe('/previous');
  second();
});
