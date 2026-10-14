// Vector art for crops, drawn into the scenery pieces' boxes (assets/sprites/scenery/*/sprites.txt).
import { ellipse, linear, radial, shape, stroke, type VectorArt } from '@/game/rendering/vector-art';

const melon: VectorArt = (g) => {
  const leaf = (cx: number, cy: number, rot: number, s: number) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.scale(s, s);
    shape(
      g,
      'M0 0 C-2 -1.2 -2.4 -4 0 -5.6 C2.4 -4 2 -1.2 0 0 Z',
      linear(g, 0, -5.6, 0, 0, [
        [0, '#8fd06a'],
        [1, '#4c9a36'],
      ]),
      '#2d5a1c',
      0.4,
    );
    stroke(g, 'M0 -0.4 V-4.8', '#2d5a1c', 0.3, 0.6);
    g.restore();
  };

  for (const [x, rot] of [
    [5, -1.1],
    [8, -0.5],
    [14, 0.5],
    [17, 1.1],
    [11, 0],
  ] as [number, number][])
    leaf(x, 10, rot, 1.15);
  shape(
    g,
    ellipse(11, 8.8, 6.2, 4.7),
    radial(g, 9, 6.6, 8, [
      [0, '#86d064'],
      [0.45, '#3f8f32'],
      [1, '#215a1b'],
    ]),
    '#183812',
    0.5,
  );
  g.save();
  g.clip(ellipse(11, 8.8, 6.2, 4.7));
  stroke(
    g,
    'M7.4 4.4 Q6 8.8 7.4 13.2 M10.2 4.1 Q9.4 8.8 10.2 13.5 M13.2 4.2 Q14 8.8 13.2 13.4 M15.8 5 Q17.2 8.8 15.8 12.6',
    '#1d4d17',
    0.55,
    0.85,
  );
  g.restore();
  shape(g, ellipse(8.6, 6.2, 1.6, 0.8), 'rgba(255,255,255,0.35)');
  leaf(6.4, 14.6, -1.9, 0.9);
  leaf(15.6, 14.6, 1.9, 0.9);
};

export const cropArt: Record<string, VectorArt> = { melon };
