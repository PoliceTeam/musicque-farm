export { type ConfirmRequest, createUiFeedback, type NoticeTone } from './feedback.js';
export {
  AudioSettingsPanel,
  Button,
  CurrencyCounter,
  Dialog,
  FormField,
  GameHeader,
  InventoryGrid,
  InventorySlot,
  Meter,
  ProfileMenu,
  Tabs,
} from './react.js';
/** DOM UI conventions shared by all game screens. Gameplay remains in the app. */
export type UiSound = 'click' | 'select' | 'close';

export function installGameUi(root: HTMLElement, options: { play?: (sound: UiSound) => void } = {}) {
  document.body.classList.add('game-ui');

  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>('button, summary, a, select');
    if (!control || !root.contains(control) || control.matches(':disabled, [aria-disabled="true"]')) return;
    if (control.closest('[data-sound]') || control.dataset.uiSound === 'none') return;
    const sound = control.dataset.uiSound;
    options.play?.(
      sound === 'close'
        ? 'close'
        : sound === 'select' || control.matches('[data-stock], [role="tab"]')
          ? 'select'
          : 'click',
    );
  };

  const onCancel = () => options.play?.('close');

  const onChange = (event: Event) => {
    if (event.target instanceof HTMLSelectElement) options.play?.('select');
  };

  root.addEventListener('click', onClick);
  root.addEventListener('cancel', onCancel, true);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('cancel', onCancel, true);
    root.removeEventListener('change', onChange);
  };
}

/** Keep gameplay input out of modal UI. Native dialog owns focus trapping and Escape. */
export function hasOpenGameDialog() {
  return typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null;
}

export type InventorySlotData = {
  label: string;
  icon?: string;
  imageUrl?: string;
  count: number;
  key?: string;
  selected?: boolean;
};

function escapeMarkup(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

/** Empty stock never gets a selected frame, label or quantity badge. */
export function inventorySlotsMarkup(items: InventorySlotData[], slots = 12) {
  const visible = items.filter((item) => Number.isSafeInteger(item.count) && item.count > 0);
  return Array.from({ length: Math.max(slots, visible.length) }, (_, i) => {
    const item = visible[i];
    const tag = item?.key ? 'button' : 'div';
    const active = item && (item.selected ?? i === 0);
    return `<${tag} class="stock-slot${active ? ' active' : ''}"${item?.key ? ` type="button" data-stock-item="${escapeMarkup(item.key)}" aria-pressed="${Boolean(active)}"` : ''}${item ? ` aria-label="${escapeMarkup(item.label)} · ${item.count}"` : ''}>${item ? `${item.imageUrl ? `<img src="${escapeMarkup(item.imageUrl)}" alt="" draggable="false">` : `<span aria-hidden="true">${escapeMarkup(item.icon ?? '')}</span>`}<b>${item.count}</b>` : ''}</${tag}>`;
  }).join('');
}

export function statusMeterMarkup(label: string, percent: number, valueText?: string) {
  const value = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return `<div class="ui-meter"><div class="ui-meter-label"><span>${escapeMarkup(label)}</span><strong>${escapeMarkup(valueText ?? `${Math.round(value)}%`)}</strong></div><progress max="100" value="${value}" aria-label="${escapeMarkup(label)}"></progress></div>`;
}

/** Form keys adjust UI controls, never move the avatar behind them. */
export function blocksGameInput() {
  if (typeof document === 'undefined') return false;
  const focused = document.activeElement;
  return (
    hasOpenGameDialog() ||
    (focused instanceof HTMLElement && focused.matches('input, select, textarea, [contenteditable="true"]'))
  );
}

/** Preserve button content and prevent duplicate submissions during async work. */
export async function withBusyButton<T>(button: HTMLButtonElement, task: () => Promise<T>, label = 'Đang xử lý…') {
  if (button.disabled) return undefined;
  const content = Array.from(button.childNodes);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = label;
  try {
    return await task();
  } finally {
    button.replaceChildren(...content);
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

export type { AudioChannel } from './_components/audio-settings-panel.js';
export type { ButtonProps } from './_components/button.js';
export type { InventoryItem } from './_components/inventory-slot.js';
