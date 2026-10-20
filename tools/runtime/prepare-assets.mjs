import { readdir, readFile, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildMapAssets } from './build-map-assets.mjs';
const app = fileURLToPath(new URL('../../apps/game',import.meta.url));
const source = path.join(app, 'src/assets');
const target = path.join(app, 'public/chibi-assets');
await buildMapAssets(app);
async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async item => item.isDirectory() ? files(path.join(directory,item.name)) : [path.join(directory,item.name)]))).flat();
}
const farmManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/farm-runtime-assets.json'),'utf8'));
const entries = await files(source);
await rm(path.join(target, 'pet-racing'), {recursive:true, force:true});
const sprites = {}, sources = {}, publicAssets = {};
for (const file of entries) {
  const relative = path.relative(source,file).split(path.sep).join('/');
  if (relative.endsWith('.txt') && relative.startsWith('sprites/')) sources[`./${relative}`] = await readFile(file,'utf8');
  if (!/\.(png|webp|jpe?g|mp3)$/.test(relative) || (relative.startsWith('farm/') || relative.startsWith('entertainment/') || relative.startsWith('arcade/') || relative.startsWith('shopping/') || relative.startsWith('salon/') || relative.startsWith('pet-shop/') || relative.startsWith('held-shop/') || relative.startsWith('premium-shop/') || relative.startsWith('jewelry-shop/') || relative.startsWith('fashion-shop/') || relative.startsWith('common/shop-npcs/') || relative.startsWith('common/scenery/'))) continue;
  const destination = path.join(target,relative);
  await mkdir(path.dirname(destination), { recursive:true }); await copyFile(file,destination);
  const version = createHash('sha256').update(await readFile(file)).digest('hex').slice(0,12);
  const url = `/chibi-assets/${relative}?v=${version}`;
  publicAssets[relative] = url;
  if (relative.startsWith('map/sprites/') && relative.endsWith('.png')) sprites[`/src/assets/${relative}`] = url;

}
// Farm images are bundled by Next's static image loader, not served from public.
await rm(path.join(target, 'farm'), { recursive:true, force:true });
const imports = [], farmEntries = [], sceneEntries = [], imageEntries = [];
for (const [index, entry] of farmManifest.entries()) {
  await readFile(path.join(source, 'farm', entry.file));
  const name = `farmImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./farm/' + entry.file)};`);
  const expression = `${JSON.stringify(entry.key)}: imageSrc(${name})`;
  farmEntries.push(expression);
  imageEntries.push(`${JSON.stringify('farm:' + entry.key)}: imageAsset(${name})`);
  if (entry.scene) sceneEntries.push(expression);
}
const sceneryManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/scenery/assets.json'), 'utf8'));
const sceneryEntries = [];
for (const [index, entry] of sceneryManifest.entries()) {
  const name = `sceneryImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./common/scenery/' + entry.file)};`);
  imageEntries.push(`${JSON.stringify('scenery:' + entry.key)}: imageAsset(${name})`);
  sceneryEntries.push(`${JSON.stringify('scenery:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'common/scenery'), {recursive:true, force:true});
const entertainmentManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/entertainment/assets.json'), 'utf8'));
const entertainmentEntries = [];
for (const [index, entry] of entertainmentManifest.entries()) {
  const name = `entertainmentImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./entertainment/' + entry.file)};`);
  imageEntries.push(`${JSON.stringify('entertainment:' + entry.key)}: imageAsset(${name})`);
  entertainmentEntries.push(`${JSON.stringify('entertainment:' + entry.key)}: imageSrc(${name})`);
}
const shoppingManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/shopping/assets.json'), 'utf8'));
const shoppingEntries = [];
for (const [index, entry] of shoppingManifest.entries()) {
  const name = `shoppingImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./shopping/' + entry.file)};`);
  imageEntries.push(`${JSON.stringify('shopping:' + entry.key)}: imageAsset(${name})`);
  shoppingEntries.push(`${JSON.stringify('shopping:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'shopping'), {recursive:true, force:true});
const salonManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/salon/assets.json'), 'utf8'));
const salonEntries = [];
for (const [index, entry] of salonManifest.entries()) {
  const name = `salonImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./salon/' + entry.file)};`);
  imageEntries.push(`${JSON.stringify('salon:' + entry.key)}: imageAsset(${name})`);
  salonEntries.push(`${JSON.stringify('salon:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'salon'), {recursive:true, force:true});
const petShopManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/pet-shop/assets.json'), 'utf8'));
const petShopEntries = [];
for (const [index, entry] of petShopManifest.entries()) {
  const name = `petShopImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./pet-shop/' + entry.key + '.webp')};`);
  imageEntries.push(`${JSON.stringify('pet-shop:' + entry.key)}: imageAsset(${name})`);
  petShopEntries.push(`${JSON.stringify('pet-shop:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'pet-shop'), {recursive:true, force:true});
const heldShopManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/held-shop/assets.json'), 'utf8'));
const heldShopEntries = [];
for (const [index, entry] of heldShopManifest.entries()) {
  const name = `heldShopImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./held-shop/' + entry.key + '.webp')};`);
  imageEntries.push(`${JSON.stringify('held-shop:' + entry.key)}: imageAsset(${name})`);
  heldShopEntries.push(`${JSON.stringify('held-shop:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'held-shop'), {recursive:true, force:true});
const premiumShopManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/premium-shop/assets.json'), 'utf8'));
const premiumShopEntries = [];
for (const [index, entry] of premiumShopManifest.entries()) {
  const name = `premiumShopImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./premium-shop/' + entry.key + '.webp')};`);
  imageEntries.push(`${JSON.stringify('premium-shop:' + entry.key)}: imageAsset(${name})`);
  premiumShopEntries.push(`${JSON.stringify('premium-shop:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'premium-shop'), {recursive:true, force:true});
const jewelryShopManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/jewelry-shop/assets.json'), 'utf8'));
const jewelryShopEntries = [];
for (const [index, entry] of jewelryShopManifest.entries()) {
  const name = `jewelryShopImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./jewelry-shop/' + entry.key + '.webp')};`);
  imageEntries.push(`${JSON.stringify('jewelry-shop:' + entry.key)}: imageAsset(${name})`);
  jewelryShopEntries.push(`${JSON.stringify('jewelry-shop:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'jewelry-shop'), {recursive:true, force:true});
const fashionShopManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/fashion-shop/assets.json'), 'utf8'));
const fashionShopEntries = [];
for (const [index, entry] of fashionShopManifest.entries()) {
  const name = `fashionShopImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./fashion-shop/' + entry.key + '.webp')};`);
  imageEntries.push(`${JSON.stringify('fashion-shop:' + entry.key)}: imageAsset(${name})`);
  fashionShopEntries.push(`${JSON.stringify('fashion-shop:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'fashion-shop'), {recursive:true, force:true});
const npcManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/shop-npcs/assets.json'), 'utf8'));
const npcEntries = [];
for (const [index, entry] of npcManifest.entries()) {
  const name = `npcImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./common/shop-npcs/' + entry.key + '.webp')};`);
  imageEntries.push(`${JSON.stringify('npc:' + entry.key)}: imageAsset(${name})`);
  npcEntries.push(`${JSON.stringify('npc:' + entry.key)}: imageSrc(${name})`);
}
await rm(path.join(target, 'common/shop-npcs'), {recursive:true, force:true});
const arcadeManifest = JSON.parse(await readFile(path.resolve(app, '../../tools/arcade/assets.json'), 'utf8'));
const arcadeEntries = [];
for (const [index, entry] of arcadeManifest.entries()) {
  const name = `arcadeImage${index}`;
  imports.push(`import ${name} from ${JSON.stringify('./arcade/' + entry.file)};`);
  arcadeEntries.push(`${JSON.stringify(entry.key)}: imageSrc(${name})`);
  imageEntries.push(`${JSON.stringify('arcade:' + entry.key)}: imageAsset(${name})`);
}
await rm(path.join(target, 'arcade'), { recursive:true, force:true });
await rm(path.join(target, 'entertainment'), { recursive:true, force:true });
await writeFile(path.join(source,'generated-assets.ts'), `// Generated by tools/runtime/prepare-assets.mjs.
${imports.join('\n')}
// Next emits content-hashed URLs; Vite tests expose the equivalent source URL.
function imageSrc(image: string | { src: string }): string {
  return typeof image === 'string' ? image : image.src;
}
function imageAsset(image: string | { src:string; width:number; height:number }) {
  return typeof image === 'string' ? {src:image,unoptimized:true} : {src:image.src,width:image.width,height:image.height,unoptimized:true};
}
export const registeredImageAssets = {${imageEntries.join(',')}};
export const spriteUrls: Record<string,string> = ${JSON.stringify(sprites)};
export const farmUrls: Record<string,string> = {${farmEntries.join(',')}};
export const farmSceneUrls: Record<string,string> = {${sceneEntries.join(',')}};
export const arcadeUrls: Record<string,string> = {${arcadeEntries.join(',')}};
export const sceneryUrls: Record<string,string> = {${sceneryEntries.join(',')}};
export const jewelryShopUrls: Record<string,string> = {${jewelryShopEntries.join(',')}};
export const fashionShopUrls: Record<string,string> = {${fashionShopEntries.join(',')}};
export const npcUrls: Record<string,string> = {${npcEntries.join(',')}};
export const premiumShopUrls: Record<string,string> = {${premiumShopEntries.join(',')}};
export const heldShopUrls: Record<string,string> = {${heldShopEntries.join(',')}};
export const petShopUrls: Record<string,string> = {${petShopEntries.join(',')}};
export const salonUrls: Record<string,string> = {${salonEntries.join(',')}};
export const shoppingUrls: Record<string,string> = {${shoppingEntries.join(',')}};
export const entertainmentUrls: Record<string,string> = {${entertainmentEntries.join(',')}};
export const publicAssetUrls: Record<string,string> = ${JSON.stringify(publicAssets)};
`);
await writeFile(path.join(source,'generated-sprite-sources.ts'), `// Generated by tools/runtime/prepare-assets.mjs. Loaded only by character screens.\nexport const spriteSources: Record<string,string> = ${JSON.stringify(sources)};\n`);
const css = { luckyDrawCss: 'src/features/lucky-draw/lucky-draw.css', farmEntranceCss: 'src/features/farm-entrance/farm-entrance.css', characterPreviewCss: 'src/features/character/character-preview.css', shopCss: 'src/features/shop/shop.css', socialCss: 'src/features/social/social.css', characterPanelCss:'src/features/character/character-panel.css', inventoryCss:'src/features/inventory/inventory.css', authCss:'src/features/auth/auth.css',arcadeCss:'../../packages/arcade-games-react/src/theme.css',locationCss:'src/features/location/location.css',petRacingCss:'src/features/pet-racing/pet-racing.css',farmCss:'src/features/farm/farm.css',mapCss:'src/features/world-map/map.css',labCss:'src/features/character/lab.css',baseCss:'src/features/character/character-base.css',themeCss:'../../packages/ui/src/theme.css',showcaseCss:'src/devtools/ui/showcase.css' };
await writeFile(path.join(source,'generated-styles.ts'), (await Promise.all(Object.entries(css).map(async ([name,file]) => `export const ${name} = ${JSON.stringify(await readFile(path.resolve(app,file),'utf8'))};`))).join('\n')+'\n');
