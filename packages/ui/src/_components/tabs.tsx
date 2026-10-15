'use client';
import { Button } from './button.js';

export function Tabs({
  items,
  value,
  onChange,
  appearance = 'buttons',
  label = 'Các mục',
}: {
  items: { id: string; label: string }[];
  appearance?: 'buttons' | 'folder';
  label?: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={`ui-tabs ${appearance === 'folder' ? 'ui-folder-tabs' : ''}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <Button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            const current = items.findIndex((candidate) => candidate.id === item.id);
            const next =
              event.key === 'ArrowRight'
                ? (current + 1) % items.length
                : event.key === 'ArrowLeft'
                  ? (current - 1 + items.length) % items.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : undefined;
            if (next === undefined) return;
            event.preventDefault();
            onChange(items[next].id);
            const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            buttons?.[next]?.focus();
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
