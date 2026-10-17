const guards = new WeakMap<object, symbol>();

/** Browser Back is not a link click: restore the table before asking to leave. */
export function guardTableBack(
  browser: Pick<Window, 'history' | 'location' | 'addEventListener' | 'removeEventListener'>,
  requestLeave: (navigateBack: () => void) => void,
) {
  const key = '__arcadeTableBack';
  const guardedUrl = browser.location.href;
  const marker = browser.history.state?.[key] ?? crypto.randomUUID();
  const lease = Symbol();
  guards.set(browser, lease);
  let armed = true;
  let restoring = false;

  const onPop = (event: PopStateEvent) => {
    if (!armed) return;
    // Run before the host router so it never unmounts a table awaiting confirmation.
    event.stopImmediatePropagation();
    if (event.state?.[key] === marker) {
      if (!restoring) return;
      restoring = false;
      requestLeave(() => {
        armed = false;
        browser.history.go(-2);
      });
    } else {
      restoring = true;
      browser.history.go(1);
    }
  };

  browser.addEventListener('popstate', onPop as EventListener, { capture: true });
  // Preserve framework-owned history fields on the duplicate entry.
  if (browser.history.state?.[key] !== marker)
    browser.history.pushState({ ...browser.history.state, [key]: marker }, '', browser.location.href);
  return () => {
    browser.removeEventListener('popstate', onPop as EventListener, { capture: true });
    // React may immediately reattach effects; avoid removing the new guard's entry.
    queueMicrotask(() => {
      if (guards.get(browser) !== lease) return;
      guards.delete(browser);
      if (armed && browser.location.href === guardedUrl && browser.history.state?.[key] === marker) {
        armed = false;
        browser.history.back();
      }
    });
  };
}
