'use client';
import { type ReactNode, type RefObject, useEffect, useRef } from 'react';

export function ProfileMenu({
  menuRef,
  portrait,
  name,
  subtitle,
  children,
  label = 'Menu người chơi',
}: {
  menuRef?: RefObject<HTMLDetailsElement | null>;
  portrait: ReactNode;
  name: string;
  subtitle: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  const localRef = useRef<HTMLDetailsElement>(null);
  const ref = menuRef ?? localRef;
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false;
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    };

    const nav = ref.current?.querySelector('nav');

    const chooseAction = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('a, button') &&
        !target.closest('.ui-audio-settings-panel') &&
        ref.current
      )
        ref.current.open = false;
    };

    nav?.addEventListener('click', chooseAction);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      nav?.removeEventListener('click', chooseAction);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [ref]);
  return (
    <details ref={ref} className="ui-profile-menu">
      <summary aria-label={label}>
        {portrait}
        <span className="ui-profile-info">
          <strong>{name}</strong>
          <span>{subtitle}</span>
        </span>
        <span className="ui-profile-chevron" aria-hidden="true">
          ▾
        </span>
      </summary>
      <nav aria-label={label}>{children}</nav>
    </details>
  );
}
