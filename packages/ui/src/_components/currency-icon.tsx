/** Stable game HUD artwork, independent of platform emoji fonts. */
export function CurrencyIcon({ kind }: { kind: 'coins' | 'gems' }) {
  return kind === 'coins' ? (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="17" r="13" fill="#9a5719" />
      <circle cx="16" cy="15" r="13" fill="#ffca46" stroke="#a86b20" strokeWidth="2" />
      <circle cx="16" cy="15" r="9" fill="#f5a923" stroke="#fff09b" strokeWidth="2" />
      <path d="M18 9h-4v12h4M12 12h8m-8 6h8" stroke="#fff5bd" strokeWidth="2" strokeLinecap="round" />
      <path d="m6 8 2-2m15-1 2 2" stroke="#fff4b0" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="m3 12 6-7h14l6 7-13 17L3 12Z" fill="#35bcec" stroke="#14709b" strokeWidth="2" strokeLinejoin="round" />
      <path d="m9 5 4 7H3l6-7Zm14 0-4 7h10l-6-7Z" fill="#9aeaff" />
      <path d="m13 12 3 17 3-17H13Z" fill="#c6f5ff" />
      <path d="m9 5 4 7h6l4-7H9Z" fill="#ebfcff" />
      <path d="M4 12h24" stroke="#14709b" strokeWidth="1.5" />
    </svg>
  );
}
