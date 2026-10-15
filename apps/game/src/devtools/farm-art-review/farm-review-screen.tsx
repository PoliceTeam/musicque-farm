import { type ComponentProps, useMemo } from 'react';
import { createReviewSdk } from '@/application/api-sdk';
import { reviewProgress } from '@/devtools/farm-art-review/review-progress';
import { FarmScreen } from '@/features/farm/farm-screen';

export { styles } from '@/features/farm/main';

export function Screen(props: ComponentProps<typeof FarmScreen>) {
  const mode = new URLSearchParams(location.search).get('review');
  const sdk = useMemo(() => (mode ? createReviewSdk(reviewProgress(mode)) : undefined), [mode]);
  return <FarmScreen {...props} sdk={sdk} review={!!mode} />;
}
