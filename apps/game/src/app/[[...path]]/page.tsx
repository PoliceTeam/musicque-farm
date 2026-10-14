import Image from 'next/image';
import { mapDeliveryAssets } from '@/assets/generated-map-assets';

/** Show the map before hydration and Phaser; other routes own their own backgrounds. */
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  if (path?.length) return null;
  const map = mapDeliveryAssets['world-map.jpg'];
  return (
    <Image
      src={map.src}
      width={map.width}
      height={map.height}
      alt=""
      aria-hidden="true"
      preload
      unoptimized
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
