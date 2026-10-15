import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

function sources(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? sources(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

it('keeps production feature/game modules independent of devtools', () => {
  for (const directory of ['features', 'game'])
    for (const file of sources(new URL(`../src/${directory}/`, import.meta.url))) {
      expect(readFileSync(file, 'utf8'), fileURLToPath(file)).not.toMatch(
        /(?:from\s*|import\s*\()\s*['"]@\/devtools\//,
      );
    }
});

it('keeps private farm, warehouse and world map selectors out of the shared UI theme', () => {
  const theme = readFileSync(new URL('../../../packages/ui/src/theme.css', import.meta.url), 'utf8');
  expect(theme).not.toMatch(
    /(?:\.farm-|\.ui-land-count|#warehouse|\.warehouse-|\.kitchen-|#selection-meters|\.map-panel|\.map-tools|\.map-hint|\.world-|\.time-settings|\.close-selection|\.coming-soon)/,
  );
});
