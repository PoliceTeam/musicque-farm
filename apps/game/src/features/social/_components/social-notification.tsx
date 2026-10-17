import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { InboxIcon } from '@/features/social/_components/inbox-button';
import { noticeTab, type SocialNotice, type SocialTab } from '@/features/social/_utils/friend-notifications';

export function SocialNotification({
  notice,
  onOpen,
  onDismiss,
}: {
  notice: SocialNotice;
  onOpen(tab: SocialTab): void;
  onDismiss(): void;
}) {
  const { t } = useTranslation('social');
  const [target, setTarget] = useState<HTMLElement>();
  useEffect(() => {
    const update = () =>
      setTarget([...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? document.body);

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);
  let text: string;
  if (notice.kind === 'action')
    text =
      notice.action === 'request' && notice.state === 'incoming'
        ? t('states.incoming')
        : notice.action === 'request' && notice.state === 'friends'
          ? t('states.friends')
          : t(`success.${notice.action}`);
  else if (notice.kind === 'pending') text = t('pendingNotice', { count: notice.count });
  else
    text =
      notice.count === 1
        ? t(`notices.${notice.kind}`, { name: notice.name })
        : t(`notices.${notice.kind}Many`, { count: notice.count });
  if (!target) return null;
  return createPortal(
    <aside className="social-toast">
      <span className="social-toast-icon">
        <InboxIcon />
      </span>
      <div>
        <strong role="status" aria-live="polite">
          {text}
        </strong>
        <button
          type="button"
          onClick={() => {
            onOpen(noticeTab(notice));
            onDismiss();
          }}
        >
          {t('view')}
        </button>
      </div>
      <button
        type="button"
        className="social-toast-close"
        aria-label={t('close', { ns: 'common' })}
        onClick={onDismiss}
      >
        ×
      </button>
    </aside>,
    target,
  );
}
