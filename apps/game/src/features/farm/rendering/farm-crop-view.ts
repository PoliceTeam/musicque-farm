/** One 40×40 soil footprint for every plot state; plants are drawn on top by the farm view. */
export function createFarmCropFrames(asset: (name: string) => HTMLCanvasElement) {
  function canvas(w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function soilFrame(soil: string, moist = false) {
    const c = canvas(40, 40),
      cg = c.getContext('2d')!;
    cg.drawImage(asset(soil), 0, 0, 40, 40);
    if (moist) {
      cg.fillStyle = '#173a2433';
      cg.beginPath();
      cg.roundRect(3, 3, 34, 34, 4);
      cg.fill();
    }
    return c;
  }

  const dry = soilFrame('soil-tilled'),
    dg = dry.getContext('2d')!;
  dg.fillStyle = '#cda36b';
  dg.beginPath();
  dg.roundRect(4, 4, 32, 32, 3);
  dg.fill();
  // Dry fissures stay inside the shared earth footprint, away from the rim.
  dg.strokeStyle = '#795b37';
  dg.lineWidth = 0.8;
  for (const points of [
    [
      [7, 11],
      [11, 14],
      [10, 19],
      [14, 21],
    ],
    [
      [11, 14],
      [16, 12],
      [18, 8],
    ],
    [
      [24, 7],
      [23, 12],
      [27, 16],
      [32, 15],
    ],
    [
      [27, 16],
      [25, 20],
    ],
    [
      [8, 28],
      [13, 26],
      [17, 29],
      [17, 33],
    ],
    [
      [17, 29],
      [21, 27],
    ],
    [
      [27, 26],
      [30, 29],
      [33, 28],
    ],
  ]) {
    dg.beginPath();
    points.forEach(([x, y], i) => {
      if (i) dg.lineTo(x, y);
      else dg.moveTo(x, y);
    });
    dg.stroke();
  }
  // Dry earth has loose grains between small fissures instead of closed stone-like plates.
  for (let i = 0; i < 36; i++) {
    dg.fillStyle = i % 3 ? '#e0bc8555' : '#9a754433';
    dg.fillRect(5 + ((i * 17) % 30), 5 + ((i * 11) % 30), 1, 1);
  }
  // Keep the exact tilled-earth silhouette. The extracted seeded tile has extra top padding.
  const seeded = soilFrame('soil-tilled'),
    sg = seeded.getContext('2d')!;
  for (const y of [13, 21, 29]) {
    sg.fillStyle = '#5d3c20';
    sg.beginPath();
    sg.ellipse(20, y + 0.5, 1.8, 2.3, 0.55, 0, Math.PI * 2);
    sg.fill();
    sg.fillStyle = '#edc66b';
    sg.beginPath();
    sg.ellipse(20, y, 1, 1.6, 0.55, 0, Math.PI * 2);
    sg.fill();
    sg.fillStyle = '#fff0b4';
    sg.fillRect(19.5, y - 1, 1, 1);
  }
  return {
    dry,
    tilled: soilFrame('soil-tilled'),
    watered: soilFrame('soil-tilled', true),
    seeded,
  };
}

/** Fixed ground anchor across growth stages; taller plants extend upwards from the same soil. */
export function createFarmPlantFrame(source: HTMLCanvasElement, scale: number, soil: HTMLCanvasElement) {
  const w = source.width * scale;
  const h = source.height * scale;
  const top = 31 - h;
  const rise = Math.ceil(Math.max(0, -top));
  const height = 40 + rise;
  const resolution = 3;
  const tile = document.createElement('canvas');
  tile.width = 40 * resolution;
  tile.height = height * resolution;
  const g = tile.getContext('2d')!;
  g.scale(resolution, resolution);
  g.drawImage(soil, 0, rise, 40, 40);
  g.drawImage(source, 20 - w / 2, rise + top, w, h);
  return { source: tile, rise, height };
}
