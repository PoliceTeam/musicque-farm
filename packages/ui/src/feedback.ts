export type NoticeTone = 'success' | 'error' | 'info';
export type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  facts?: { label: string; value: string }[];
};

/** One modal and one bounded notice stack per screen, with explicit teardown. */
export function createUiFeedback(root: HTMLElement) {
  const notices = document.createElement('aside');
  notices.className = 'ui-notices';
  notices.setAttribute('aria-label', 'Thông báo');
  const dialog = document.createElement('dialog');
  dialog.className = 'ui-confirm ui-modal';
  dialog.setAttribute('aria-labelledby', 'ui-confirm-title');
  dialog.innerHTML =
    '<header class="ui-dialog-header"><h2 id="ui-confirm-title"></h2><button type="button" data-ui-sound="close" aria-label="Đóng xác nhận">×</button></header><div class="ui-dialog-body"><p class="ui-confirm-description"></p><dl class="ui-facts"></dl></div><footer class="ui-actions ui-dialog-footer"><button type="button" data-cancel data-ui-sound="close">Hủy</button><button type="button" class="primary" data-ui-sound="none" data-confirm>Xác nhận</button></footer>';
  root.append(notices, dialog);
  let pending: ((value: boolean) => void) | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const finish = (accepted: boolean) => {
    const resolve = pending;
    pending = undefined;
    if (dialog.open) dialog.close();
    resolve?.(accepted);
  };

  dialog.querySelector('header button')!.addEventListener('click', () => finish(false));
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => finish(false));
  dialog.querySelector('[data-confirm]')!.addEventListener('click', () => finish(true));
  dialog.addEventListener('cancel', () => finish(false));
  dialog.addEventListener('close', () => finish(false));
  return {
    notify(message: string, tone: NoticeTone = 'info') {
      const notice = document.createElement('p');
      notice.className = `ui-notice ui-notice-${tone}`;
      notice.setAttribute('role', tone === 'error' ? 'alert' : 'status');
      notice.textContent = message;
      const openDialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
      (openDialogs.at(-1) ?? root).append(notices);
      notices.append(notice);
      while (notices.childElementCount > 3) notices.firstElementChild?.remove();
      const timer = setTimeout(
        () => {
          notice.remove();
          timers.delete(timer);
        },
        tone === 'error' ? 6500 : 4000,
      );
      timers.add(timer);
    },

    confirm(request: ConfirmRequest): Promise<boolean> {
      if (pending) return Promise.resolve(false);
      dialog.querySelector('h2')!.textContent = request.title;
      dialog.querySelector('.ui-confirm-description')!.textContent = request.description;
      const facts = dialog.querySelector('dl')!;
      facts.replaceChildren();
      for (const fact of request.facts ?? []) {
        const label = document.createElement('dt');
        const value = document.createElement('dd');
        label.textContent = fact.label;
        value.textContent = fact.value;
        facts.append(label, value);
      }
      dialog.querySelector('[data-confirm]')!.textContent = request.confirmLabel ?? 'Xác nhận';
      return new Promise((resolve) => {
        pending = resolve;
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.focus();
      });
    },

    destroy() {
      finish(false);
      for (const timer of timers) clearTimeout(timer);
      notices.remove();
      dialog.remove();
    },
  };
}
