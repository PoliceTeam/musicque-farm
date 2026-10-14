/**
 * Bản đồ thế giới (màn chọn khu vực). Toạ độ theo pixel ảnh nền docs/art/world-map-v2.png (1672×941).
 * Khu vực, nhãn và các chuyển động môi trường khai báo bằng dữ liệu; renderer chỉ đọc và vẽ.
 */

import walkwayData from '@/features/world-map/_utils/world-map-walkways.json';
import zoneData from '@/features/world-map/_utils/world-zones.json';

export type Point = readonly [number, number];
export type Box = readonly [number, number, number, number];
/** Đường đi vòng elip: số người/chim, tốc độ góc (rad/giây, âm = ngược chiều). */
export type Loop = { center: Point; rx: number; ry: number; count: number; speed: number };

export type WorldZone = {
  id: string;
  label: string;
  icon: string;
  /** Vùng bấm (đa giác) trên ảnh nền. */
  area: readonly Point[];
  /** Điểm đặt nhãn. */
  labelAt: Point;
  /** Camera target inside the actual land, independent of label and boundary vertex density. */
  focusAt: Point;
  /** Trang mở khi vào khu; thiếu là chưa có màn chơi. */
  href?: string;
};

/**
 * Chuyển động môi trường. Mọi tốc độ cố ý chậm (bản đồ là màn nghỉ, không phải màn hành động).
 * Sprite cối xay, bò, vòng quay, máy bay, thuyền và nhãn khu do tools/world-map/build.py tách ra
 * (apps/game/src/assets/map/sprites + sprites.json chứa toạ độ gốc).
 */
export type WorldMapDecor = {
  /** Thuyền (tên sprite) chạy qua lại trên tuyến nước; tốc độ px/giây. */
  boats: { sprite: string; route: readonly Point[]; speed: number }[];
  /** Đàn chim bay ngang trời ban ngày. */
  birds: { from: Point; to: Point; seconds: number }[];
  fountains: Point[];
  smoke: Point[];
  waterfallMist: Point[];
  surfSplash: Point[];
  /** Đom đóm ban đêm trong rừng. */
  fireflies: Box[];
  /** Đèn trên vành vòng quay (bật khi tối). */
  ferrisLights: { center: Point; radius: number; count: number };
  /** Vòng quay hết một vòng sau bao nhiêu giây. */
  ferrisSeconds: number;
  lighthouses: Point[];
  /** Cối xay: vòng/phút. */
  windmillRpm: number;
  /** Khung lá cờ trên trường học (vẫy trong shader). */
  flag: Box;
  /** Máy bay: hướng đường băng (vector đơn vị, cùng hướng mũi máy bay trong sprite); chu kỳ giây. */
  plane: { heading: Point; cycle: number };
  towerBeacon: Point;
  runway: { from: Point; to: Point };
  /** Người đi dạo vòng elip; speed rad/giây (âm = ngược chiều). */
  walkers: Loop[];
  pedestrians: { zone: string; route: readonly Point[]; count: number; speed: number; scale: number }[];
  seagulls: Loop[];
  /** Sân bóng: elip của mặt sân, số cầu thủ mỗi đội. */
  football: { center: Point; rx: number; ry: number; perTeam: number };
  /** Bò đi qua lại quanh chỗ cũ (px), gà mổ thóc trong khung. */
  cowRoam: number;
  chickens: { area: Box; count: number };
  /** Điểm trên mặt nước có cá nhảy. */
  fishSpots: Point[];
  balloons: Point[];
  leaves: Box[];
  butterflies: Box[];
};

export const WORLD_MAP_SIZE = zoneData.size;
export const WORLD_WALKWAYS = walkwayData as unknown as { id: string; polygon: Point[] }[];

/** Khu vực: dùng chung với tools/world-map/build.py (vẽ ảnh vùng khu); mã khu = vị trí + 1. */
export const WORLD_ZONES: WorldZone[] = zoneData.zones as unknown as WorldZone[];

export const WORLD_DECOR: WorldMapDecor = {
  surfSplash: [
    [1450, 895],
    [1498, 887],
    [714, 790],
    [1148, 829],
    [137, 719],
  ],
  boats: [
    {
      sprite: 'sailboat',
      route: [
        [1180, 883],
        [1340, 883],
      ],
      speed: 4,
    },
    {
      sprite: 'yacht',
      route: [
        [520, 857],
        [710, 857],
      ],
      speed: 4,
    },
  ],
  birds: [{ from: [-40, 96], to: [1712, 125], seconds: 170 }],
  fountains: [
    [798, 568],
    [1178, 506],
  ],
  smoke: [
    [402, 355],
    [562, 374],
    [1264, 425],
  ],
  waterfallMist: [
    [108, 434],
    [176, 554],
    [377, 572],
  ],
  fireflies: [[25, 325, 200, 595]],
  ferrisLights: { center: [445, 634], radius: 39, count: 16 },
  ferrisSeconds: 50,
  lighthouses: [
    [1139, 668],
    [1575, 373],
  ],
  windmillRpm: 3,
  flag: [806, 320, 819, 331],
  plane: { heading: [0.933, 0.36], cycle: 80 },
  towerBeacon: [1405, 545],
  runway: { from: [1264, 654], to: [1668, 798] },
  walkers: [],
  pedestrians: [
    {
      zone: 'farm',
      route: [
        [424, 478],
        [425, 453],
        [442, 434],
      ],
      count: 2,
      speed: 5,
      scale: 0.65,
    },
    {
      zone: 'forest',
      route: [
        [158, 563],
        [173, 581],
        [190, 600],
      ],
      count: 3,
      speed: 4,
      scale: 0.75,
    },
    {
      zone: 'school',
      route: [
        [746, 501],
        [772, 505],
        [797, 505],
        [827, 504],
        [850, 496],
      ],
      count: 4,
      speed: 6,
      scale: 0.7,
    },
    {
      zone: 'center',
      route: [
        [782, 637],
        [783, 617],
        [785, 601],
      ],
      count: 3,
      speed: 6,
      scale: 0.9,
    },
    {
      zone: 'center',
      route: [
        [813, 637],
        [813, 617],
        [809, 601],
      ],
      count: 3,
      speed: 5,
      scale: 0.9,
    },
    {
      zone: 'fun',
      route: [
        [329, 675],
        [359, 681],
        [395, 691],
        [431, 700],
        [472, 711],
      ],
      count: 4,
      speed: 5,
      scale: 0.95,
    },
    {
      zone: 'homes',
      route: [
        [1123, 540],
        [1132, 526],
        [1133, 509],
      ],
      count: 2,
      speed: 4,
      scale: 0.75,
    },
    {
      zone: 'homes',
      route: [
        [1202, 557],
        [1198, 538],
        [1196, 521],
      ],
      count: 3,
      speed: 5,
      scale: 0.75,
    },
    {
      zone: 'port',
      route: [
        [870, 700],
        [910, 714],
        [950, 728],
        [990, 742],
      ],
      count: 4,
      speed: 5,
      scale: 0.95,
    },
    {
      zone: 'airport',
      route: [
        [1419, 683],
        [1474, 701],
        [1535, 723],
        [1599, 744],
      ],
      count: 3,
      speed: 6,
      scale: 0.85,
    },
  ],
  seagulls: [{ center: [985, 833], rx: 65, ry: 18, count: 2, speed: 0.16 }],
  football: { center: [801, 463], rx: 45, ry: 10, perTeam: 3 },
  cowRoam: 0,
  chickens: { area: [428, 412, 460, 450], count: 5 },
  fishSpots: [
    [600, 873],
    [940, 879],
    [1450, 890],
  ],
  balloons: [[528, 659]],
  leaves: [
    [45, 340, 200, 575],
    [716, 400, 745, 440],
    [903, 410, 960, 456],
    [1262, 436, 1300, 460],
  ],
  butterflies: [[250, 402, 442, 466]],
};
