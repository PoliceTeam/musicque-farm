import assert from 'node:assert/strict';
import { builtinModules } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const directories = (await readdir(new URL('packages/', root), { withFileTypes: true })).filter((entry) =>
  entry.isDirectory(),
);
const packages = new Map(
  await Promise.all(
    directories.map(async ({ name }) => {
      const directory = new URL(`packages/${name}/`, root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      return [manifest.name, { directory, manifest }];
    }),
  ),
);
const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

function importSpecifiers(source) {
  const imports = [];

  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier)
      imports.push(node.moduleSpecifier.text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal))
      imports.push(node.argument.literal.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }

  visit(source);
  return imports;
}

test('packages import declared dependencies through public exports and never import application code', async () => {
  for (const [name, { directory, manifest }] of packages) {
    const declared = { ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies };
    for (const file of await readdir(new URL('src/', directory), { recursive: true })) {
      if (!/\.tsx?$/.test(file)) continue;
      const url = new URL(`src/${file}`, directory);
      const source = ts.createSourceFile(file, await readFile(url, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const specifier of importSpecifiers(source)) {
        const label = `${name}/${file}: ${specifier}`;
        if (specifier.startsWith('.')) {
          assert.ok(
            new URL(specifier, url).href.startsWith(new URL('src/', directory).href),
            `${label} escapes its package`,
          );
          continue;
        }
        assert.ok(!specifier.startsWith('@/') && !specifier.includes('apps/'), `${label} imports app code`);
        if (builtins.has(specifier)) continue;
        const dependency = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        assert.ok(dependency === name || Object.hasOwn(declared, dependency), `${label} is undeclared`);
        const target = packages.get(dependency);
        if (!target) continue;
        const entry = specifier === dependency ? '.' : `.${specifier.slice(dependency.length)}`;
        assert.ok(
          Object.keys(target.manifest.exports).some(
            (key) =>
              key === entry ||
              (key.includes('*') && entry.startsWith(key.split('*')[0]) && entry.endsWith(key.split('*')[1])),
          ),
          `${label} bypasses public exports`,
        );
      }
    }
  }
});

test('workspace runtime dependencies form an acyclic graph', () => {
  const done = new Set();

  function visit(name, path = []) {
    assert.ok(!path.includes(name), `Dependency cycle: ${[...path, name].join(' → ')}`);
    if (done.has(name)) return;
    const { manifest } = packages.get(name);
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }))
      if (packages.has(dependency)) visit(dependency, [...path, name]);
    done.add(name);
  }

  for (const name of packages.keys()) visit(name);
});

test('foundation and infrastructure packages keep their domain boundaries', () => {
  const allowed = {
    'character-core': [],
    'game-content': [],
    gameplay: ['game-content'],
    'render-contracts': ['character-core'],
    'renderer-canvas': ['character-core', 'render-contracts'],
    'renderer-phaser': ['character-core', 'render-contracts'],
    'arcade-games': ['character-core', 'game-content'],
    'game-service': ['arcade-games', 'character-core', 'contracts', 'game-content', 'gameplay'],
    contracts: ['arcade-games', 'character-core', 'game-content', 'gameplay'],
    ui: [],
    'game-audio': [],
    'realtime-core': [],
    'realtime-redis': ['realtime-core'],
    'realtime-fastify-ws': ['realtime-core'],
    jobs: [],
  };
  for (const [name, dependencies] of Object.entries(allowed)) {
    const { manifest } = packages.get(`@chibi-town/${name}`);
    const internal = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
      .filter((dependency) => dependency.startsWith('@chibi-town/'))
      .sort();
    assert.deepEqual(internal, dependencies.map((dependency) => `@chibi-town/${dependency}`).sort(), name);
  }
});

test('jobs contract files contain only types, so the root cannot load BullMQ transitively', async () => {
  const { directory } = packages.get('@chibi-town/jobs');
  for (const file of ['ports.ts', 'index.ts']) {
    const source = ts.createSourceFile(
      file,
      await readFile(new URL(`src/${file}`, directory), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const node of source.statements)
      assert.ok(
        ts.isTypeAliasDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          (ts.isExportDeclaration(node) && node.isTypeOnly),
        `${file}: unexpected runtime statement`,
      );
  }
});
