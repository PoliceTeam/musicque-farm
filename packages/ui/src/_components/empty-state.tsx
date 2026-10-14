import type { ReactNode } from 'react';

/** Content-free panels explain their status and the next useful step. */
export function EmptyState({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="ui-empty-state" role="status">
      <div className="ui-empty-state-icon" aria-hidden="true">
        {icon ?? (
          <svg aria-hidden="true" width="36" height="36" viewBox="0 0 40 40" fill="none">
            <path d="M9 22h22v11H9z" fill="currentColor" opacity=".18" />
            <path
              d="M9 22h22v11H9zM20 22v-9m0 5c-7 0-10-4-10-9 7 0 10 4 10 9Zm0-3c0-6 4-9 10-9 0 6-4 9-10 9Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </section>
  );
}
