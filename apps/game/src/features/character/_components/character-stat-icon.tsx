import type { CharacterStats } from '@chibi-town/contracts/character-stats';

export function CharacterStatIcon({ kind }: { kind: keyof CharacterStats }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'experience' && (
        <path
          d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3Z"
          fill="currentColor"
          fillOpacity=".16"
        />
      )}
      {kind === 'fashion' && (
        <>
          <path d="m8 4 4 3 4-3 5 4-3 4-2-1v9H8v-9l-2 1-3-4 5-4Z" fill="currentColor" fillOpacity=".14" />
          <path d="M9 4c0 4 6 4 6 0" />
        </>
      )}
      {kind === 'friendliness' && (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M2 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5v1" />
        </>
      )}
      {kind === 'happiness' && (
        <>
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".1" />
          <path d="M8 9h.01M16 9h.01M7.5 14a5 5 0 0 0 9 0" />
        </>
      )}
      {kind === 'mischief' && (
        <>
          <path d="m4 8-1-5 6 3m11 2 1-5-6 3" />
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" fill="currentColor" fillOpacity=".1" />
          <path d="m7 10 3 1m7-1-3 1m-6 4c2 3 6 3 8 0" />
        </>
      )}
      {kind === 'health' && (
        <>
          <path d="M12 21S3 15 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13Z" fill="currentColor" fillOpacity=".1" />
          <path d="M6 12h3l2-4 2 8 2-4h3" />
        </>
      )}
    </svg>
  );
}
