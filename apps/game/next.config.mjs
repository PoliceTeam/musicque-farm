import { fileURLToPath } from 'node:url';

/** `NEXT_OUTPUT=standalone` (Docker image) bundles a self-contained server traced from the monorepo root. */
const standalone = process.env.NEXT_OUTPUT === 'standalone';
const nextConfig = {
  ...(standalone
    ? { output: 'standalone', outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)) }
    : {}),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  reactStrictMode: false,
  devIndicators: false,
  transpilePackages: ['@chibi-town/ui'],

  async headers() {
    return [
      {
        source: '/chibi-assets/:path*',
        has: [{ type: 'query', key: 'v', value: '[a-f0-9]{12}' }],
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/map', destination: '/', permanent: false },
      { source: '/map.html', destination: '/', permanent: false },
      ...['farm', 'character', 'ui', 'farm-art-review'].map((route) => ({
        source: `/${route}.html`,
        destination: `/${route}`,
        permanent: false,
      })),
    ];
  },
};
export default nextConfig;
