import { createContext } from 'react';
import type { AuthPlayer } from '@/application/auth-client';
export const AuthContext = createContext<{ player?: AuthPlayer; openAuth: () => void }>({ openAuth() {} });

/** Mark before opening; inaccessible storage still allows play and the dialog. */
export function shouldShowGuestPrompt(storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  try {
    if (storage.getItem('chibi-guest-prompt')) return false;
    storage.setItem('chibi-guest-prompt', '1');
  } catch {
    /* Storage can be disabled in private browsers. */
  }
  return true;
}
