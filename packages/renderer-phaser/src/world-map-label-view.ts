import type Phaser from 'phaser';

const COLORS: Record<string, number> = {
  farm: 0x65945f,
  forest: 0x447b63,
  school: 0x597ea0,
  center: 0x698bb1,
  fun: 0xc88468,
  homes: 0xb28966,
  port: 0x528f9c,
  airport: 0x6f87ad,
};

/** Original vector pictograms, drawn on one 24px grid with a shared stroke. */
function drawIcon(g: Phaser.GameObjects.Graphics, id: string, x: number) {
  g.lineStyle(1.8, 0xfff8e5, 1);
  g.fillStyle(0xfff8e5, 1);

  const path = (points: number[][], close = false) => {
    g.beginPath();
    g.moveTo(x + points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) g.lineTo(x + px, py);
    if (close) g.closePath();
    g.strokePath();
  };

  switch (id) {
    case 'farm':
      g.fillEllipse(x - 4, -3, 9, 5);
      g.fillEllipse(x + 4, -7, 9, 5);
      path([
        [0, 8],
        [0, -5],
      ]);
      path([
        [-5, 8],
        [5, 8],
      ]);
      break;
    case 'forest':
      path(
        [
          [0, -10],
          [-6, -2],
          [-3, -2],
          [-9, 6],
          [9, 6],
          [3, -2],
          [6, -2],
        ],
        true,
      );
      path([
        [0, 6],
        [0, 10],
      ]);
      break;
    case 'school':
      path(
        [
          [0, -8],
          [-10, -3],
          [0, 2],
          [10, -3],
        ],
        true,
      );
      path([
        [-6, 0],
        [-6, 5],
        [0, 8],
        [6, 5],
        [6, 0],
      ]);
      path([
        [10, -3],
        [10, 5],
      ]);
      g.fillCircle(x + 10, 6, 1.3);
      break;
    case 'center':
      g.strokeRoundedRect(x - 9, -4, 5, 12, 1);
      g.strokeRoundedRect(x - 2, -10, 6, 18, 1);
      g.strokeRoundedRect(x + 6, 0, 4, 8, 1);
      for (const y of [-6, -1, 4])
        path([
          [0, y],
          [2, y],
        ]);
      break;
    case 'fun':
      g.strokeCircle(x, -2, 8);
      g.fillCircle(x, -2, 1.8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        path([
          [0, -2],
          [Math.cos(a) * 8, -2 + Math.sin(a) * 8],
        ]);
      }
      path([
        [-5, 10],
        [0, -2],
        [5, 10],
      ]);
      break;
    case 'homes':
      path([
        [-10, -1],
        [0, -9],
        [10, -1],
      ]);
      path([
        [-7, -3],
        [-7, 8],
        [-2, 8],
        [-2, 2],
        [2, 2],
        [2, 8],
        [7, 8],
        [7, -3],
      ]);
      break;
    case 'port':
      g.strokeCircle(x, -8, 2.4);
      path([
        [0, -5],
        [0, 9],
      ]);
      path([
        [-5, -1],
        [5, -1],
      ]);
      path([
        [-9, 2],
        [-7, 6],
        [0, 10],
        [7, 6],
        [9, 2],
      ]);
      path([
        [-9, 2],
        [-9, 6],
      ]);
      path([
        [9, 2],
        [9, 6],
      ]);
      break;
    default:
      path(
        [
          [0, -10],
          [2, -3],
          [10, 2],
          [10, 4],
          [2, 2],
          [2, 7],
          [5, 10],
          [0, 8],
          [-5, 10],
          [-2, 7],
          [-2, 2],
          [-10, 4],
          [-10, 2],
          [-2, -3],
        ],
        true,
      );
  }
}

export function createWorldMapLabel(
  scene: Phaser.Scene,
  zone: { id: string; label: string; labelAt: readonly [number, number] },
  onHover: () => void,
  onSelect: () => void,
) {
  const text = scene.add
    .text(0, 0, zone.label, {
      fontFamily: '"Trebuchet MS", system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#3c5149',
      resolution: 3,
    })
    .setOrigin(0, 0.5);
  const w = Math.ceil(text.width) + 62;
  text.setX(-w / 2 + 45).setY(-1);
  const card = scene.add.graphics();
  // Warm paper, a restrained edge and a small location pointer.
  card.fillStyle(0x244944, 0.22).fillRoundedRect(-w / 2, -16, w, 38, 19);
  card.fillStyle(0xd2b784).fillTriangle(-5, 17, 5, 17, 0, 24);
  card.fillStyle(0xfff3d7).fillRoundedRect(-w / 2, -20, w, 38, 19);
  card.lineStyle(1.4, 0xd2b784).strokeRoundedRect(-w / 2, -20, w, 38, 19);
  card.lineStyle(1, 0xffffff, 0.8).strokeRoundedRect(-w / 2 + 2, -18, w - 4, 34, 17);
  const x = -w / 2 + 22;
  card.fillStyle(COLORS[zone.id] ?? 0x6f87ad).fillCircle(x, -1, 15);
  card.lineStyle(1, 0xffffff, 0.35).strokeCircle(x, -1, 13);
  drawIcon(card, zone.id, x);
  return scene.add
    .container(...zone.labelAt, [card, text])
    .setDepth(50)
    .setSize(w, 44)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', onHover)
    .on('pointerup', onSelect);
}
