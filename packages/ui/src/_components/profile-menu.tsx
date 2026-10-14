'use client';
import { type ReactNode, useEffect, useRef } from 'react';

export function ProfileMenu({
  portrait,
  name,
  subtitle,
  children,
  label = 'Menu người chơi',
}: {
  portrait: ReactNode;
  name: string;
  subtitle: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
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
  }, []);
  return (
    <details ref={ref} className="farm-menu ui-profile-menu">
      <summary aria-label="Mở menu người chơi">
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
