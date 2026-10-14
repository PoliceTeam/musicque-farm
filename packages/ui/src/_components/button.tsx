'use client';
import type { ButtonHTMLAttributes } from 'react';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  busyLabel?: string;
  variant?: 'default' | 'primary';
};

export function Button({
  children,
  busy = false,
  busyLabel = 'Đang xử lý…',
  variant = 'default',
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={
        ['ui-button', className, variant === 'default' ? undefined : variant].filter(Boolean).join(' ') || undefined
      }
      disabled={disabled || busy}
      aria-busy={busy || props['aria-busy']}
    >
      {busy ? busyLabel : children}
    </button>
  );
}
