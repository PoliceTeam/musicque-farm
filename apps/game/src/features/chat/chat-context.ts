import type { ChatArea } from '@chibi-town/contracts/public-chat';
import { createContext } from 'react';

export const ChatContext = createContext<{ area?: ChatArea; setHost(host: HTMLDivElement | null): void }>({
  setHost() {},
});
