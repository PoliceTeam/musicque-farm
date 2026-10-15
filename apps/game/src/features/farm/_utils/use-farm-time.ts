import { useEffect, useMemo, useState } from 'react';
import { farmTimeAt } from '@/features/farm/_utils/farm-clock-logic';

/** Only open panels need React clock updates; the scene has its own frame clock. */
export function useFarmTime(serverTime: number | undefined, active: boolean, scale: number) {
  const anchor = useMemo(() => ({ server: serverTime ?? 0, real: Date.now() }), [serverTime]);
  const [, render] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => render((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return farmTimeAt(anchor, Date.now(), scale);
}
