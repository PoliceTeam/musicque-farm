import { farmUrls } from '@/assets/generated-assets';

/** Logical keys remain stable when runtime folders or image formats change. */
export function farmAssetUrl(key: string): string {
  const url = farmUrls[key];
  if (!url) throw new Error(`Missing farm artwork: ${key}`);
  return url;
}
