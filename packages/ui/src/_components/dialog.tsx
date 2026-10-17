'use client';
import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from './button.js';

export function Dialog({
  title,
  children,
  onClose,
  id,
  tabs,
  footer,
  closeLabel,
  className,
  hideTitle = false,
  showCloseFooter = true,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  id?: string;
  tabs?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
  hideTitle?: boolean;
  showCloseFooter?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const content = (
    <>
      <header className={`ui-dialog-header${hideTitle ? ' ui-dialog-header-titleless' : ''}`}>
        {!hideTitle && <h2>{title}</h2>}
        {onClose && (
          <Button
            className="ui-icon-button"
            aria-label={`${closeLabel ?? 'Đóng'} ${title.toLowerCase()}`}
            data-ui-sound="close"
            onClick={onClose}
          >
            ×
          </Button>
        )}
      </header>
      <div className="ui-dialog-body">{children}</div>
      {(footer || (showCloseFooter && closeLabel && onClose)) && (
        <footer className="ui-dialog-footer">{footer ?? <Button onClick={onClose}>{closeLabel}</Button>}</footer>
      )}
    </>
  );
  return (
    <dialog
      id={id}
      ref={ref}
      className={[tabs ? 'ui-modal ui-tab-dialog' : 'ui-modal', className].filter(Boolean).join(' ')}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
    >
      {tabs}
      {tabs ? <div className="ui-dialog-surface">{content}</div> : content}
    </dialog>
  );
}
