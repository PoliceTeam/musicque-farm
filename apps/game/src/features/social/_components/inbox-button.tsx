import { useTranslation } from 'react-i18next';

export function InboxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" fillOpacity=".08" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function InboxButton({ count, onClick }: { count: number; onClick(): void }) {
  const { t } = useTranslation('social');
  return (
    <button
      type="button"
      className="ui-button social-inbox-button"
      onClick={onClick}
      title={t('messages')}
      aria-label={count ? t('inboxLabel', { count }) : t('messages')}
    >
      <InboxIcon />
      {count > 0 && (
        <span className="social-inbox-badge" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
