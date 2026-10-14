import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { UiImage } from './image-provider.js';

export type SelectChoice<T extends string | number> = { value: T; label: string; image?: string };

/** Select-only combobox: pictures in both the selected value and the keyboard-accessible menu. */
export function Select<T extends string | number>({
  label,
  value,
  items,
  onChange,
  disabled = false,
  classPrefix,
}: {
  label: string;
  value: T;
  items: SelectChoice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  classPrefix?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = items.find((item) => item.value === value) ?? items[0];

  function show() {
    if (disabled || !items.length) return;
    setActive(
      Math.max(
        0,
        items.findIndex((item) => item.value === value),
      ),
    );
    setOpen(true);
  }

  function choose(index: number) {
    if (disabled || !items[index]) return;
    onChange(items[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  // A native popover stays above the modal's scroll/clipping surfaces while remaining
  // inside its DOM/focus scope. Position from the trigger, not the scrolling container.
  useLayoutEffect(() => {
    if (!open) return;
    const list = menu.current!;
    list.showPopover();

    function position() {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < Math.min(300, list.scrollHeight || items.length * 44 + 8) && above > below;
      list.style.width = `${Math.min(rect.width, window.innerWidth - 24)}px`;
      list.style.maxHeight = `${Math.max(0, Math.min(300, upward ? above : below))}px`;
      list.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - list.offsetWidth - 12))}px`;
      list.style.top = `${upward ? rect.top - list.offsetHeight - 4 : rect.bottom + 4}px`;
    }

    function scroll(event: Event) {
      if (event.target !== list) position();
    }

    position();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', scroll, true);
    return () => {
      list.hidePopover();
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', scroll, true);
    };
  }, [open, items.length]);
  useLayoutEffect(() => {
    if (!open) return;
    const list = menu.current!;
    const option = list.children[active] as HTMLElement | undefined;
    if (!option) return;
    // Only scroll the list: scrollIntoView can also move the modal behind it.
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [open, active]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const extra = (suffix: string) => (classPrefix ? ` ${classPrefix}-${suffix}` : '');

  return (
    <div className={`ui-select ui-form-field${extra('select')}`} ref={root}>
      <label className="ui-form-label" id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        className={`ui-select-trigger${extra('trigger')}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'Tab') setOpen(false);
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (!open) show();
            else
              setActive(
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length,
              );
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(active);
            else show();
          }
        }}
      >
        {selected?.image && <UiImage src={selected.image} alt="" width={42} height={42} />}
        <span>{selected?.label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className={`ui-select-options${extra('options')}`}
          ref={menu}
          popover="manual"
        >
          {items.map((item, index) => (
            <div
              key={item.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={item.value === value}
              className={index === active ? 'is-active' : undefined}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') choose(index);
              }}
              tabIndex={-1}
            >
              {item.image && <UiImage src={item.image} alt="" width={42} height={42} />}
              <span>{item.label}</span>
              <span aria-hidden="true">{item.value === value ? '✓' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
