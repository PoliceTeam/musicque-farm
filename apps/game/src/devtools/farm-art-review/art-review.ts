import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import inventoryVi from '@/application/i18n/locales/vi/inventory';
import { farmUrls as urls } from '@/assets/generated-assets';
import {
  ANIMAL_ART_SCALES,
  ANIMAL_ART_STAGES,
  ANIMAL_MOTION_STEP_MS,
  ANIMAL_MOTION_STEPS,
  animalArtFrameName,
} from '@/features/farm/_utils/animal-art';
import { CROP_GROWTH_FRAMES, cropAssetName, cropIconUrl } from '@/features/farm/_utils/crop-growth-frames';
import { createFarmAnimalFrames } from '@/features/farm/rendering/farm-animal-view';
import { createFarmCropFrames, createFarmPlantFrame } from '@/features/farm/rendering/farm-crop-view';

export async function mountArtReview(root: HTMLElement, isDisposed: () => boolean) {
  const images = new Map<string, HTMLCanvasElement>();
  await Promise.all(
    Object.entries(urls).map(async ([path, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const c = document.createElement('canvas');
      c.width = image.width;
      c.height = image.height;
      c.getContext('2d')!.drawImage(image, 0, 0);
      images.set(path, c);
    }),
  );
  if (isDisposed()) return;
  const frames = createFarmCropFrames((name) => images.get(name)!);
  const labels = {
    dry: 'Đất khô',
    tilled: 'Đã xới',
    watered: 'Đã tưới',
    seeded: 'Gieo hạt',
  };
  for (const [name, source] of Object.entries(frames)) {
    const card = document.createElement('article');
    const label = document.createElement('strong');
    label.textContent = labels[name as keyof typeof labels];
    card.append(label);
    for (const scale of [1, 3]) {
      const c = document.createElement('canvas');
      c.width = 40;
      c.height = 40;
      c.style.width = `${40 * scale}px`;
      c.style.height = `${40 * scale}px`;
      c.getContext('2d')!.drawImage(source, 0, 0);
      card.append(c);
    }
    root.append(card);
  }

  for (const id of Object.keys(FARM_CROPS) as CropId[]) {
    const card = document.createElement('article');
    const label = document.createElement('strong');
    card.className = 'crop-review';
    label.textContent = inventoryVi.products[id];
    card.append(label);
    const stages = Array.from(
      { length: CROP_GROWTH_FRAMES[id].ripe + 1 },
      (_, frame) => images.get(cropAssetName(id, frame))!,
    );
    const scale = Math.min(0.4, 36 / Math.max(...stages.map((stage) => stage.width)));
    for (const source of stages) {
      const plant = createFarmPlantFrame(source, scale, frames.watered);
      const c = document.createElement('canvas');
      c.width = 40;
      c.height = plant.height;
      c.style.width = '80px';
      c.style.height = `${plant.height * 2}px`;
      c.getContext('2d')!.drawImage(plant.source, 0, 0, 40, plant.height);
      card.append(c);
    }
    const icon = document.createElement('img');
    icon.src = cropIconUrl(id);
    icon.alt = 'Nông sản thu hoạch';
    icon.style.width = '40px';
    icon.style.height = '40px';
    icon.style.objectFit = 'contain';
    card.append(icon);
    root.append(card);
  }

  const animationPreviews: { canvas: HTMLCanvasElement; frames: HTMLCanvasElement[]; facing: number }[] = [];
  const animalNames = { cow: 'Bò', pig: 'Lợn', sheep: 'Cừu', hen: 'Gà', duck: 'Vịt', buffalo: 'Trâu', dog: 'Chó' };
  for (const [species, stages] of Object.entries(createFarmAnimalFrames((name) => images.get(name)!))) {
    stages.forEach((frames, stage) => {
      const card = document.createElement('article'),
        label = document.createElement('strong');
      label.textContent = `${animalNames[species as keyof typeof animalNames]} · ${ANIMAL_ART_STAGES[stage]}`;
      card.append(label);
      for (const facing of [0, ANIMAL_MOTION_STEPS]) {
        const c = document.createElement('canvas');
        c.width = 52;
        c.height = 48;
        c.style.width = '104px';
        c.style.height = '96px';
        c.getContext('2d')!.drawImage(frames[facing], 0, 0);
        card.append(c);
        animationPreviews.push({ canvas: c, frames, facing });
      }
      root.append(card);
    });
  }

  for (let stage = 0; stage < 4; stage++) {
    const card = document.createElement('article'),
      label = document.createElement('strong');
    label.textContent = `Cá / Rùa · ${ANIMAL_ART_STAGES[stage]}`;
    card.append(label);
    for (const species of ['fish', 'turtle'] as const) {
      const c = document.createElement('canvas');
      c.width = 34;
      c.height = 34;
      c.style.width = '68px';
      c.style.height = '68px';
      const fish = images.get(animalArtFrameName(species, stage, 'idle', 0))!,
        w = 26 * ANIMAL_ART_SCALES[stage],
        h = (w * fish.height) / fish.width;
      c.getContext('2d')!.drawImage(fish, 17 - w / 2, 17 - h / 2, w, h);
      card.append(c);
    }
    root.append(card);
  }

  function animate(time: number) {
    if (isDisposed()) return;
    const tick = Math.floor(time / ANIMAL_MOTION_STEP_MS) % ANIMAL_MOTION_STEPS;
    for (const preview of animationPreviews) {
      const g = preview.canvas.getContext('2d')!;
      g.clearRect(0, 0, 52, 48);
      g.drawImage(preview.frames[preview.facing + tick], 0, 0);
    }
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
