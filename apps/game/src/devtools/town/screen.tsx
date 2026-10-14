import type { createGameAudio } from '@chibi-town/game-audio';
import { useEffect, useRef } from 'react';
import { mount, styles } from '@/devtools/town/main';

export { styles };

/** Developer renderer sandbox; production screens use the feature components. */
export function Screen({ audio }: { audio: ReturnType<typeof createGameAudio> }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => mount(host.current!, audio), [audio]);
  return <div ref={host} />;
}
