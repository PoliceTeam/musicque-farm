import type { ReactNode } from 'react';

export function CurrencyCounter({ label, icon, value }: { label: string; icon: ReactNode; value?: number }) {
  return (
    <span
      className="ui-currency"
      role="img"
      aria-label={`${label}: ${value === undefined ? 'Đang tải' : value.toLocaleString('vi-VN')}`}
    >
      <span className="ui-currency-icon" aria-hidden="true">
        {icon}
      </span>
      <strong className="ui-currency-value">{value?.toLocaleString('vi-VN') ?? '…'}</strong>
    </span>
  );
}
