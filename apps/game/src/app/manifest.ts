import type { MetadataRoute } from 'next';
import { publicPath } from '@/application/_utils/public-path';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chibi Town',
    short_name: 'Chibi Town',
    description: 'Thế giới nông trại Chibi Town',
    lang: 'vi',
    start_url: publicPath('/'),
    display: 'standalone',
    background_color: '#32b0fd',
    theme_color: '#32b0fd',
    icons: [
      {
        src: publicPath('/icons/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: publicPath('/icons/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    scope: publicPath('/'),
  };
}
