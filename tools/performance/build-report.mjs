import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const [buildDir, htmlFile, output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node tools/performance/build-report.mjs <build-dir> <page-html> <output-dir>');
const html = await readFile(htmlFile, 'utf8');
if (!html.includes('<html')) throw new Error('Expected page HTML; use curl -L to follow redirects');
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => decodeURI(match[1]).split('/_next/')[1]).filter(Boolean))];
const initialJs = await Promise.all(scripts.map(async file => {
  const bytes = await readFile(path.join(buildDir, file));
  return { file, legacyOnly: file.includes('polyfills-'), bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}));
async function inventory(folder, base = folder) {
  const rows = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) rows.push(...await inventory(file, base));
    else rows.push({ file: path.relative(base, file), bytes: (await stat(file)).size });
  }
  return rows;
}
if (!scripts.length) throw new Error('No Next scripts found in HTML');
const stats = JSON.parse(await readFile(path.join(buildDir, 'analyze/client-stats.json'), 'utf8'));
const modules = [];
function visit(module) {
  if (module.name) modules.push({ name: module.name, bytes: module.size });
  module.modules?.forEach(visit);
}
stats.modules.forEach(visit);
const report = {
  configuration: { bundler: 'webpack', basePath: '/farm', apiUrl: '/farm/api' },
  initialModernJsGzipBytes: initialJs.filter(row => !row.legacyOnly).reduce((sum, row) => sum + row.gzipBytes, 0),
  initialJs, initialJsBytes: initialJs.reduce((sum, row) => sum + row.bytes, 0),
  initialJsGzipBytes: initialJs.reduce((sum, row) => sum + row.gzipBytes, 0),
  largestModules: modules.sort((a,b) => b.bytes - a.bytes).slice(0, 30),
  // Inventory describes emitted files, not proof they were requested by a particular map.
  publicAssets: (await inventory(path.resolve(buildDir, '../public/chibi-assets'))).sort((a,b) => b.bytes - a.bytes),
  staticMedia: (await inventory(path.join(buildDir, 'static/media'))).sort((a,b) => b.bytes - a.bytes),
};
const mapManifest = await readFile('apps/game/src/assets/generated-map-assets.ts', 'utf8');
const mapUrls = [...new Set([...mapManifest.matchAll(/\"(?:src|url)\":\"(\/chibi-assets\/[^\"]+)\"/g)].map(match => match[1].split('?')[0]))];
for (const name of ['lights', 'mask', 'surf', 'zones']) mapUrls.push(`/chibi-assets/map/world-map-${name}.png`);
report.worldMapAssets = await Promise.all(mapUrls.map(async url => ({ url, bytes: (await stat(path.join('apps/game/public', url))).size })));
const farmManifest = JSON.parse(await readFile('tools/farm-runtime-assets.json', 'utf8'));
report.farmSceneAssets = await Promise.all(farmManifest.filter(entry => entry.scene).map(async entry => ({ file: entry.file, bytes: (await stat(path.join('apps/game/src/assets/farm', entry.file))).size })));
// Static dependency inventory: unique raster files referenced by each map's layers.
// These bytes exclude generated canvases, character sprites, audio and JS; not a network trace.
const { MAPS } = await import('../../packages/game-content/dist/world.js');
const generated = await readFile('apps/game/src/assets/generated-assets.ts', 'utf8');
const imports = new Map([...generated.matchAll(/import (\w+) from "(.+?)";/g)].map(match => [match[1], match[2]]));
const ids = new Map([...generated.matchAll(/"([^"]+)": imageAsset\((\w+)\)/g)].map(match => [match[1], imports.get(match[2])]));
report.mapLayerAssets = await Promise.all(MAPS.map(async map => {
  const requested = [...new Set((map.layers ?? []).map(layer => layer.asset).filter(Boolean))];
  const files = [...new Set(requested.map(id => ids.get(id) ?? ids.get(id.replace('entertainment:', 'scenery:'))).filter(Boolean))];
  const assets = await Promise.all(files.map(async file => ({ file, bytes: (await stat(path.resolve('apps/game/src/assets', file))).size })));
  return { map: `${map.regionId}/${map.id}`, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), assets, unresolved: requested.filter(id => !ids.has(id) && !ids.has(id.replace('entertainment:', 'scenery:'))) };
}));
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ initialJsBytes: report.initialJsBytes, initialJsGzipBytes: report.initialJsGzipBytes, initialModernJsGzipBytes: report.initialModernJsGzipBytes, output }));
