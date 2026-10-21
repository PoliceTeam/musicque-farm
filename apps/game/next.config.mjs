import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `NEXT_OUTPUT=standalone` (Docker image) bundles a self-contained server traced from the monorepo root. */
const standalone = process.env.NEXT_OUTPUT === 'standalone';
const nextConfig = {
  ...(standalone
    ? { output: 'standalone', outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)) }
    : {}),
  ...(process.env.NEXT_ANALYSIS_DIR ? { distDir: process.env.NEXT_ANALYSIS_DIR } : {}),
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
// Only analysis builds load the plugin; normal production config remains unchanged.
let config = nextConfig;
if (process.env.ANALYZE === 'true') {
  const { default: bundleAnalyzer } = await import('@next/bundle-analyzer');
  config = bundleAnalyzer({ enabled: true, openAnalyzer: false })(nextConfig);
  const analyzerWebpack = config.webpack;
  config.webpack = (webpackConfig, options) => {
    if (!options.isServer)
      webpackConfig.plugins.push({
        apply(compiler) {
          compiler.hooks.done.tap('ClientBundleStats', (stats) => {
            const folder = path.join(compiler.outputPath, 'analyze');
            mkdirSync(folder, { recursive: true });
            writeFileSync(
              path.join(folder, 'client-stats.json'),
              JSON.stringify(
                stats.toJson({
                  all: false,
                  assets: true,
                  chunks: true,
                  chunkModules: true,
                  modules: true,
                  reasons: true,
                  entrypoints: true,
                }),
              ),
            );
          });
        },
      });
    return analyzerWebpack(webpackConfig, options);
  };
}
export default config;
