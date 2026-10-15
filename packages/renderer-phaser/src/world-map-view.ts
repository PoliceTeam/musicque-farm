import Phaser from 'phaser';
import { createWorldMapLabel } from './world-map-label-view.js';
import { WORLD_MAP_FRAGMENT } from './world-map-shader.js';

type Point = readonly [number, number];
type Box = readonly [number, number, number, number];
type Loop = { center: Point; rx: number; ry: number; count: number; speed: number };
export type WorldMapZoneView = { id: string; label: string; icon: string; area: readonly Point[]; labelAt: Point };
export type WorldMapDecorView = {
  boats: { sprite: string; route: readonly Point[]; speed: number }[];
  birds: { from: Point; to: Point; seconds: number }[];
  fountains: Point[];
  smoke: Point[];
  waterfallMist: Point[];
  surfSplash: Point[];
  fireflies: Box[];
  ferrisLights: { center: Point; radius: number; count: number };
  ferrisSeconds: number;
  lighthouses: Point[];
  windmillRpm: number;
  flag: Box;
  plane: { heading: Point; cycle: number };
  towerBeacon: Point;
  runway: { from: Point; to: Point };
  walkers: Loop[];
  pedestrians: { zone: string; route: readonly Point[]; count: number; speed: number; scale: number }[];
  seagulls: Loop[];
  football: { center: Point; rx: number; ry: number; perTeam: number };
  cowRoam: number;
  chickens: { area: Box; count: number };
  fishSpots: Point[];
  balloons: Point[];
  leaves: Box[];
  butterflies: Box[];
};
/** Sprite tách sẵn: vị trí góc trên trái trên ảnh nền, cỡ, tâm quay (nếu có). */
export type WorldMapSprite = { url: string; x: number; y: number; w: number; h: number; hub?: Point };
export type WorldLighting = { day: number; evening: number; night: number; dawn: number };

export type WorldMapLife = {
  id: string;
  at: Point;
  motion: 'idle' | 'graze' | 'fly' | 'walk' | 'pasture';
  route?: readonly Point[];
  speed?: number;
  frames?: string;
};

export type WorldMapViewOptions = {
  parent: HTMLElement;
  size: { width: number; height: number };
  images: { base: string; sky: string; clouds: string; surf: string; mask: string; lights: string; zones: string };
  /** windmill, cow, ferris-wheel, ferris-legs, plane, thuyền, label-<id khu>. */
  sprites: Record<string, WorldMapSprite>;
  spriteAtlas?: { url: string; data: object };
  life: WorldMapLife[];
  canWalk: (point: Point) => boolean;
  /** Thứ tự khu phải trùng thứ tự đã dùng để vẽ ảnh vùng khu (mã khu = vị trí + 1). */
  zones: readonly WorldMapZoneView[];
  decor: WorldMapDecorView;
  walkRoute: (
    route: readonly Point[],
    seconds: number,
    speed: number,
  ) => { at: Point; moving: boolean; facingLeft: boolean };
  lighting: () => WorldLighting;
  zoneAt: (point: Point) => WorldMapZoneView | undefined;
  onHover?: (zone: WorldMapZoneView | undefined) => void;
  onSelect?: (zone: WorldMapZoneView) => void;
};

export type WorldMapView = {
  destroy(): void;
};

type Fader = { setAlpha(a: number): unknown };
const WALK_FRAMES = [0, 1, 0, 2];
const PASS_ORDER = [0, 5, 1, 3, 2, 4];
const LIGHT_COLORS = [0xff6fb5, 0xffd34d, 0x6fe3ff];
const FOUNTAIN_SIDES = [-1, 1];
const PEOPLE = ['#e84a5f', '#2f7de1', '#f5b83d', '#3fb56b', '#a35fd6', '#ffffff', '#ff8a3d'];

const smooth = (t: number) => t * t * (3 - 2 * t);

export function createWorldMapView(options: WorldMapViewOptions): WorldMapView {
  const { width: W, height: H } = options.size;
  const d = options.decor;
  const sp = options.sprites;

  const mix = [0, 0, 0, 0],
    parallax = [0, 0],
    size = [W, H];
  const lighthouseA = d.lighthouses[0],
    lighthouseB = d.lighthouses[1];
  const beaconA = lighthouseA ? [lighthouseA[0], lighthouseA[1], 767, 0] : [-10000, -10000, 767, 0];
  const beaconB = lighthouseB ? [lighthouseB[0], lighthouseB[1], 445, 2.1] : [-10000, -10000, 445, 2.1];
  const textures = new Map<string, [string, string?]>();

  function texture(name: string): [string, string?] {
    let value = textures.get(name);
    if (!value) {
      value = options.spriteAtlas ? ['map-sprites', name] : [`sp-${name}`];
      textures.set(name, value);
    }
    return value;
  }

  const lastFrames = new WeakMap<Phaser.GameObjects.Image, string>();

  function setFrame(sprite: Phaser.GameObjects.Image, name: string) {
    if (lastFrames.get(sprite) !== name) {
      sprite.setTexture(...texture(name));
      lastFrames.set(sprite, name);
    }
    return sprite;
  }

  class MapScene extends Phaser.Scene {
    private hover?: WorldMapZoneView;
    private hoverCode = 0;
    private hoverT = 0;
    private labels = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Container>();
    /** Độ phóng thêm khi trỏ (tween), nhân với hệ số giữ nhãn cùng cỡ trên màn hình. */
    private labelPop = new Map<string, { k: number }>();
    private boats: {
      sprite: Phaser.GameObjects.Image;
      wake: Phaser.GameObjects.Particles.ParticleEmitter;
      ring: Phaser.GameObjects.Ellipse;
      route: readonly Point[];
      speed: number;
      t: number;
      faceRight: boolean;
    }[] = [];
    private flocks: { group: Phaser.GameObjects.Container; from: Point; to: Point; seconds: number; t: number }[] = [];
    private circlers: { sprite: Phaser.GameObjects.Image; path: Loop; phase: number; walker: boolean }[] = [];
    private players: { sprite: Phaser.GameObjects.Image; home: Point; team: number }[] = [];
    private ball!: Phaser.GameObjects.Arc;
    private chickens: {
      sprite: Phaser.GameObjects.Image;
      x: number;
      y: number;
      tx: number;
      ty: number;
      wait: number;
    }[] = [];
    private living: (WorldMapLife & { sprite: Phaser.GameObjects.Image; phase: number })[] = [];

    private cow?: Phaser.GameObjects.Image;
    private fish!: { sprite: Phaser.GameObjects.Image; splash: Phaser.GameObjects.Particles.ParticleEmitter };
    private fishNext = 2;
    private fishT = -1;
    private fishAt: Point = [0, 0];
    private nightOnly: { obj: Fader; max: number }[] = [];
    private dayOnly: { obj: Fader; max: number }[] = [];
    private lightsG!: Phaser.GameObjects.Graphics;
    private waterG!: Phaser.GameObjects.Graphics;
    private pedestrians: {
      sprite: Phaser.GameObjects.Image;
      path: WorldMapDecorView['pedestrians'][number];
      phase: number;
      variant: string;
    }[] = [];
    private mill?: Phaser.GameObjects.Image;
    private wheel?: Phaser.GameObjects.Image;
    private cabins: Phaser.GameObjects.Image[] = [];
    private fountainRipples: { ring: Phaser.GameObjects.Ellipse; at: Point; phase: number }[] = [];
    private plane?: { body: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image };
    private dragFrom?: { id: number; x: number; y: number; centerX: number; centerY: number; moved: boolean };
    private coverZoom = 1;

    constructor() {
      super('world-map');
    }

    preload() {
      this.load.image('map-base', options.images.base);
      this.load.image('map-sky', options.images.sky);
      this.load.image('map-clouds', options.images.clouds);
      this.load.image('map-surf', options.images.surf);
      this.load.image('map-mask', options.images.mask);
      this.load.image('map-lights', options.images.lights);
      this.load.image('map-zones', options.images.zones);
      if (options.spriteAtlas) this.load.atlas('map-sprites', options.spriteAtlas.url, options.spriteAtlas.data);
      else for (const [name, s] of Object.entries(sp)) this.load.image(`sp-${name}`, s.url);
    }

    create() {
      if (this.game.renderer.type === Phaser.WEBGL) {
        this.add
          .shader(
            {
              name: 'world-map-bg',
              fragmentSource: WORLD_MAP_FRAGMENT,

              setupUniforms: (setUniform: (name: string, value: unknown) => void) => {
                const light = options.lighting();
                const cam = this.cameras.main;
                setUniform('uMap', 0);
                setUniform('uMask', 1);
                setUniform('uLights', 2);
                setUniform('uZones', 3);
                setUniform('uSky', 4);
                setUniform('uClouds', 5);
                setUniform('uSurf', 6);
                setUniform('uTime', this.time.now / 1000);
                mix[0] = light.day;
                mix[1] = light.evening;
                mix[2] = light.night;
                mix[3] = light.dawn;
                setUniform('uMix', mix);
                parallax[0] = cam.midPoint.x - W / 2;
                parallax[1] = cam.midPoint.y - H / 2;
                setUniform('uPar', parallax);
                setUniform('uSize', size);
                setUniform('uFlipY', 0);
                setUniform('uHover', this.hoverCode);
                setUniform('uHoverT', this.hoverT);
                setUniform('uFlag', d.flag);
                setUniform('uBeaconA', beaconA);
                setUniform('uBeaconB', beaconB);
              },
            },
            0,
            0,
            W,
            H,
            ['map-base', 'map-mask', 'map-lights', 'map-zones', 'map-sky', 'map-clouds', 'map-surf'],
          )
          .setOrigin(0, 0);
      } else this.add.image(0, 0, 'map-base').setOrigin(0, 0);
      for (const [i, entry] of options.life.entries()) {
        const sprite = sp[entry.id];
        if (!sprite) continue;
        const image = this.add
          .image(entry.at[0], entry.at[1], ...texture(entry.id))
          .setOrigin(0.5, 1)
          .setDepth(24);
        this.living.push({ ...entry, sprite: image, phase: i * 1.7 });
      }
      // Keep the moon as an independent sky object, with a soft halo.
      const moon = this.add
        .container(W * 0.22, H * 0.065, [
          this.add.circle(0, 0, 24, 0xd7e5ff, 0.04),
          this.add.circle(0, 0, 17, 0xd7e5ff, 0.07),
          this.add.circle(0, 0, 11, 0xfff1ca, 0.95),
          this.add.circle(-3, 2, 2.5, 0xddcfa9, 0.25),
          this.add.circle(4, -3, 1.8, 0xddcfa9, 0.2),
        ])
        .setDepth(10)
        .setAlpha(0);
      this.nightOnly.push({ obj: moon, max: 1 });
      this.makeTextures();
      this.addLandmarks();
      this.addWater();
      this.addLife();
      this.waterG = this.add.graphics().setDepth(23);
      this.lightsG = this.add.graphics().setDepth(34).setBlendMode(Phaser.BlendModes.ADD);
      for (const zone of options.zones) {
        this.labels.set(zone.id, this.makeLabel(zone));
        this.labelPop.set(zone.id, { k: 1 });
      }
      this.setupCamera();
      this.setupInput();
    }

    private canvas(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
      const tex = this.textures.createCanvas(key, w, h)!;
      draw(tex.getContext());
      tex.refresh();
    }

    private makeTextures() {
      this.canvas('dot', 8, 8, (ctx) => {
        const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 8, 8);
      });
      for (const [key, color, width] of [
        ['bird', '#2b2f3a', 1.4],
        ['gull', '#ffffff', 1.5],
      ] as const)
        this.canvas(key, 9, 5, (ctx) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(0.5, 1);
          ctx.quadraticCurveTo(2.5, 0, 4.5, 3.5);
          ctx.quadraticCurveTo(6.5, 0, 8.5, 1);
          ctx.stroke();
        });
      // Người tí hon: vẽ ở 3× rồi thu nhỏ để mềm như tranh (đầu, tóc, áo, chân).
      for (const [i, color] of PEOPLE.entries())
        this.canvas(`walker-${i}`, 15, 27, (ctx) => {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(7.5, 25.5, 6, 1.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4a3a34';
          ctx.fillRect(4, 18, 3, 7);
          ctx.fillRect(8, 18, 3, 7);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(2, 10, 11, 10, 3);
          ctx.fill();
          ctx.fillStyle = '#ffd9c2';
          ctx.beginPath();
          ctx.arc(7.5, 6.5, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = ['#4a2e22', '#2b2420', '#a8642c'][i % 3];
          ctx.beginPath();
          ctx.arc(7.5, 5, 5, Math.PI, 0);
          ctx.fill();
        });
      this.canvas('chicken', 12, 12, (ctx) => {
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath();
        ctx.ellipse(6, 7, 4.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9, 4, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8402f';
        ctx.fillRect(8.5, 1, 2, 1.5);
        ctx.fillStyle = '#f2a32b';
        ctx.fillRect(11, 4, 1, 1);
        ctx.fillRect(5, 10, 1, 2);
        ctx.fillRect(7, 10, 1, 2);
      });
      this.canvas('fish', 16, 8, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 8);
        g.addColorStop(0, '#ffb04a');
        g.addColorStop(1, '#ff7a2f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(7, 4, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1.5, 4);
        ctx.lineTo(-1, 0.5);
        ctx.lineTo(-1, 7.5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10, 2.5, 1.5, 1.5);
      });
      this.canvas('balloon', 7, 13, (ctx) => {
        ctx.strokeStyle = 'rgba(80,60,50,0.8)';
        ctx.beginPath();
        ctx.moveTo(3.5, 8);
        ctx.lineTo(3.5, 13);
        ctx.stroke();
        const g = ctx.createRadialGradient(2.5, 2.5, 0.5, 3.5, 4, 4);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#bdbdbd');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(3.5, 4, 3.3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      this.canvas('leaf', 4, 3, (ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(2, 1.5, 2, 1.1, 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    private addLandmarks() {
      const cow = sp.cow;
      if (cow) this.cow = this.add.image(cow.x + cow.w / 2, cow.y + cow.h / 2, ...texture('cow')).setDepth(24);

      const mill = sp['mill-rotor-v1'];
      if (mill?.hub) this.mill = this.add.image(...mill.hub, ...texture('mill-rotor-v1')).setDepth(25);
      const wheel = sp['ferris-rim-v1'];
      if (wheel?.hub) {
        // Rotate a circle inside a fixed perspective transform; the ellipse itself never turns.
        this.wheel = this.add.image(0, 0, ...texture('ferris-rim-v1'));
        this.add
          .container(...wheel.hub, [this.wheel])
          .setScale(0.82, 1)
          .setDepth(25);
        if (sp['ferris-cabin-v1'])
          for (let k = 0; k < 12; k++)
            this.cabins.push(
              this.add
                .image(0, 0, ...texture('ferris-cabin-v1'))
                .setOrigin(0.5, 0.05)
                .setDepth(26),
            );
      }
      const plane = sp['airport-plane-v1'];
      if (plane) {
        const shadow = this.add
          .image(0, 0, ...texture('airport-plane-v1'))
          .setTint(0x152e49)
          .setDepth(26);
        const body = this.add.image(0, 0, ...texture('airport-plane-v1')).setDepth(29);
        this.plane = { body, shadow };
      }
      for (const [i, at] of d.fountains.entries())
        for (let k = 0; k < 2; k++)
          this.fountainRipples.push({
            ring: this.add
              .ellipse(...at, 20, 6)
              .setStrokeStyle(0.7, 0xdaf5ff)
              .setDepth(23),
            at,
            phase: k * 0.5 + i * 0.17,
          });
    }

    private addWater() {
      for (const [i, boat] of d.boats.entries()) {
        const s = sp[boat.sprite];
        if (!s) continue;
        const [x, y] = boat.route[0];
        const wake = this.add
          .particles(0, 0, 'dot', {
            lifespan: 2600,
            speedX: { min: -2, max: 2 },
            speedY: { min: -0.5, max: 0.5 },
            scale: { start: 0.4, end: 1.3 },
            alpha: { start: 0.45, end: 0 },
            tint: 0xffffff,
            frequency: 180,
          })
          .setDepth(18);
        const ring = this.add
          .ellipse(x, y, s.w * 0.9, 5)
          .setStrokeStyle(1, 0xffffff, 0.35)
          .setDepth(18);
        // điểm neo ở đáy thân thuyền để thuyền ngồi trên mặt nước
        const sprite = this.add
          .image(x, y, ...texture(`${boat.sprite}`))
          .setOrigin(0.5, 0.92)
          .setDepth(20);
        wake.startFollow(sprite, 0, -1);
        // sprite gốc: thuyền buồm/du thuyền quay mũi sang phải
        this.boats.push({
          sprite,
          wake,
          ring,
          route: boat.route,
          speed: boat.speed,
          t: (i * 0.29) % 1,
          faceRight: true,
        });
      }
      for (const path of d.seagulls)
        for (let k = 0; k < path.count; k++)
          this.circlers.push({
            sprite: this.add.image(0, 0, 'gull').setDepth(31).setScale(0.9),
            path,
            phase: (k / path.count) * Math.PI * 2 + k,
            walker: false,
          });
      const splash = this.add
        .particles(0, 0, 'dot', {
          speed: { min: 8, max: 22 },
          angle: { min: 200, max: 340 },
          gravityY: 40,
          lifespan: 700,
          scale: { start: 0.45, end: 0.1 },
          alpha: { start: 0.9, end: 0 },
          tint: 0xffffff,
          emitting: false,
        })
        .setDepth(21);
      this.fish = { sprite: this.add.image(0, 0, 'fish').setDepth(21).setVisible(false).setScale(0.7), splash };
    }

    private addLife() {
      const emit = (x: number, y: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 21) =>
        this.add.particles(x, y, 'dot', cfg).setDepth(depth);

      for (const [x, y] of d.fountains)
        emit(x, y, {
          speedY: { min: -30, max: -22 },
          speedX: { min: -6, max: 6 },
          gravityY: 45,
          lifespan: 1300,
          scale: { start: 0.45, end: 0.15 },
          alpha: { start: 0.85, end: 0 },
          tint: 0xd8f2ff,
          frequency: 70,
        });
      for (const [x, y] of d.smoke)
        emit(x, y, {
          speedY: { min: -6, max: -4 },
          speedX: { min: 1, max: 3 },
          lifespan: 5000,
          scale: { start: 0.6, end: 2.4 },
          alpha: { start: 0.3, end: 0 },
          tint: 0xe9eef2,
          frequency: 700,
        });
      for (const [x, y] of d.waterfallMist)
        emit(x, y, {
          speedY: { min: -5, max: -1 },
          speedX: { min: -5, max: 5 },
          lifespan: 2200,
          scale: { start: 0.8, end: 2.4 },
          alpha: { start: 0.3, end: 0 },
          tint: 0xffffff,
          frequency: 140,
        });
      for (const [i, [x, y]] of d.surfSplash.entries())
        emit(x, y, {
          x: { min: -7, max: 7 },
          speedY: { min: -24, max: -15 },
          speedX: { min: -10, max: 10 },
          gravityY: 58,
          lifespan: { min: 450, max: 700 },
          scale: { start: 0.18, end: 0.06 },
          alpha: { start: 0.65, end: 0 },
          tint: 0xe4f7ff,
          frequency: 3400 + i * 270,
          quantity: 5,
        });
      for (const [x0, y0, x1, y1] of d.fireflies)
        this.nightOnly.push({
          obj: emit(
            0,
            0,
            {
              x: { min: x0, max: x1 },
              y: { min: y0, max: y1 },
              speedX: { min: -3, max: 3 },
              speedY: { min: -3, max: 3 },
              lifespan: 4000,
              scale: { start: 0.35, end: 0.2 },
              alpha: { start: 0.9, end: 0 },
              tint: 0xe8ff8a,
              blendMode: Phaser.BlendModes.ADD,
              frequency: 90,
            },
            22,
          ),
          max: 1,
        });
      for (const [x0, y0, x1, y1] of d.leaves) {
        const e = this.add
          .particles(0, 0, 'leaf', {
            x: { min: x0, max: x1 },
            y: { min: y0, max: y1 },
            speedX: { min: 2, max: 6 },
            speedY: { min: 3, max: 6 },
            rotate: { min: 0, max: 360 },
            lifespan: 5000,
            alpha: { start: 0.95, end: 0 },
            tint: [0x9bd35a, 0xe9c74a, 0x6fb83f],
            frequency: 420,
          })
          .setDepth(22);
        this.dayOnly.push({ obj: e, max: 1 });
      }
      for (const [x0, y0, x1, y1] of d.butterflies)
        this.dayOnly.push({
          obj: emit(
            0,
            0,
            {
              x: { min: x0, max: x1 },
              y: { min: y0, max: y1 },
              speedX: { min: -5, max: 5 },
              speedY: { min: -4, max: 2 },
              lifespan: 3500,
              scale: { start: 0.4, end: 0.3 },
              alpha: { start: 1, end: 0 },
              tint: [0xffffff, 0xffe066, 0xffb3d9],
              frequency: 300,
            },
            22,
          ),
          max: 1,
        });
      for (const [x, y] of d.balloons)
        this.add
          .particles(x, y, 'balloon', {
            speedY: { min: -8, max: -5 },
            speedX: { min: -2, max: 2 },
            lifespan: 14000,
            alpha: { start: 1, end: 0 },
            scale: { start: 0.9, end: 0.6 },
            tint: [0xff5a6e, 0xffd23f, 0x4fa3ff, 0x7be07b, 0xc77dff],
            frequency: 2600,
          })
          .setDepth(32);
      for (const path of d.walkers)
        for (let k = 0; k < path.count; k++)
          this.circlers.push({
            sprite: this.add
              .image(0, 0, `walker-${k % PEOPLE.length}`)
              .setOrigin(0.5, 0.95)
              .setScale(0.36)
              .setDepth(24),
            path,
            phase: (k / path.count) * Math.PI * 2 + (k % 3) * 0.4,
            walker: true,
          });
      const variants = ['red', 'blue', 'gold', 'green'];
      for (const [i, path] of d.pedestrians.entries())
        for (let k = 0; k < path.count; k++) {
          const variant = variants[(i + k) % variants.length];
          const sprite = this.add
            .image(...path.route[0], ...texture(`npc-${variant}-1`))
            .setOrigin(0.5, 1)
            .setScale(path.scale);
          this.pedestrians.push({ sprite, path, phase: k * 13.7 + i * 5.3, variant });
        }
      // sân bóng: hai đội 3 người đuổi theo bóng
      const f = d.football;
      this.ball = this.add.circle(f.center[0], f.center[1], 1.5, 0xffffff).setStrokeStyle(0.6, 0x333333).setDepth(25);
      for (let team = 0; team < 2; team++)
        for (let k = 0; k < f.perTeam; k++) {
          const home: Point = [
            f.center[0] + (team ? 1 : -1) * f.rx * (0.25 + 0.25 * k),
            f.center[1] + (k - 1) * f.ry * 0.55,
          ];
          this.players.push({
            sprite: this.add
              .image(home[0], home[1], ...texture(`npc-${team ? 'blue' : 'red'}-1`))
              .setOrigin(0.5, 0.95)
              .setScale(0.58)
              .setDepth(24),
            home,
            team,
          });
        }
      // gà mổ thóc quanh sân nông trại
      const [cx0, cy0, cx1, cy1] = d.chickens.area;
      for (let k = 0; k < d.chickens.count; k++) {
        const x = Phaser.Math.Between(cx0, cx1);
        const y = Phaser.Math.Between(cy0, cy1);
        this.chickens.push({
          sprite: this.add
            .image(x, y, ...texture('hen-white-0'))
            .setOrigin(0.5, 1)
            .setScale(0.85)
            .setDepth(24),
          x,
          y,
          tx: x,
          ty: y,
          wait: Math.random() * 3,
        });
      }
      for (const flock of d.birds) {
        const group = this.add.container(flock.from[0], flock.from[1]).setDepth(30);
        for (const [dx, dy] of [
          [0, 0],
          [-11, -5],
          [-11, 6],
          [-22, -9],
          [-22, 11],
        ])
          group.add(this.add.image(dx * (flock.to[0] < flock.from[0] ? -1 : 1), dy, 'bird'));
        this.flocks.push({ group, from: flock.from, to: flock.to, seconds: flock.seconds, t: Math.random() });
        this.dayOnly.push({ obj: group, max: 0.9 });
      }
    }

    private makeLabel(zone: WorldMapZoneView) {
      return createWorldMapLabel(
        this,
        zone,
        () => this.setHover(zone),
        () => {
          if (!this.dragFrom?.moved) options.onSelect?.(zone);
        },
      );
    }

    private setupCamera() {
      const fit = () => {
        this.coverZoom = Math.max(this.scale.width / W, this.scale.height / H);
        this.cameras.main.setZoom(this.coverZoom).centerOn(W / 2, H / 2);
      };

      fit();
      this.scale.on('resize', fit);
    }

    private setupInput() {
      this.input.setDefaultCursor('grab');
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.dragFrom) return;
        const center = this.cameras.main.midPoint;
        this.dragFrom = { id: p.id, x: p.x, y: p.y, centerX: center.x, centerY: center.y, moved: false };
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        const drag = this.dragFrom;
        if (drag && p.id === drag.id && p.isDown) {
          const dx = p.x - drag.x;
          const dy = p.y - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
          if (drag.moved) {
            const camera = this.cameras.main;
            const halfWidth = Math.min(W / 2, camera.width / this.coverZoom / 2);
            const halfHeight = Math.min(H / 2, camera.height / this.coverZoom / 2);
            camera.centerOn(
              Phaser.Math.Clamp(drag.centerX - dx / this.coverZoom, halfWidth, W - halfWidth),
              Phaser.Math.Clamp(drag.centerY - dy / this.coverZoom, halfHeight, H - halfHeight),
            );
            this.setHover(undefined);
            this.input.setDefaultCursor('grabbing');
            return;
          }
        }
        this.setHover(options.zoneAt([p.worldX, p.worldY]));
      });
      this.input.on('pointerup', (p: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
        const drag = this.dragFrom;
        if (drag && p.id !== drag.id) return;
        this.dragFrom = undefined;
        this.input.setDefaultCursor(this.hover ? 'pointer' : 'grab');
        if (drag?.moved || objects.length) return;
        const zone = options.zoneAt([p.worldX, p.worldY]);
        if (zone) options.onSelect?.(zone);
      });
      this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
        if (this.dragFrom?.id !== p.id) return;
        this.dragFrom = undefined;
        this.setHover(undefined);
        this.input.setDefaultCursor('grab');
      });
      this.input.on('gameout', () => this.setHover(undefined));
    }

    private setHover(zone: WorldMapZoneView | undefined) {
      if (zone === this.hover) return;
      const old = this.hover && this.labels.get(this.hover.id);
      if (old) {
        const pop = this.labelPop.get(this.hover!.id)!;
        this.tweens.killTweensOf([old, pop]);
        this.tweens.add({ targets: pop, k: 1, duration: 220, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: old, angle: 0, duration: 220, ease: 'Sine.easeOut' });
      }
      this.hover = zone;
      this.input.setDefaultCursor(zone ? 'pointer' : 'grab');
      if (zone) {
        this.hoverCode = options.zones.indexOf(zone) + 1;
        const label = this.labels.get(zone.id)!;
        const pop = this.labelPop.get(zone.id)!;
        this.tweens.killTweensOf([label, pop]);
        this.tweens.add({ targets: pop, k: 1.05, duration: 220, ease: 'Back.easeOut' });
      }
      options.onHover?.(zone);
    }

    update(time: number, delta: number) {
      const dt = Math.min(0.1, delta / 1000);
      const sec = time / 1000;
      // nhãn giữ cỡ cố định trên màn hình (bằng cỡ ở mức lấp kín), không phình to khi phóng
      const labelScale = Phaser.Math.Clamp(this.scale.width / 1440, 0.85, 1.08) / this.cameras.main.zoom;
      for (const [id, label] of this.labels) label.setScale(labelScale * this.labelPop.get(id)!.k);
      const light = options.lighting();
      const dark = light.night + light.evening * 0.35;
      this.hoverT = Phaser.Math.Clamp(this.hoverT + (this.hover ? dt * 3 : -dt * 2.5), 0, 1);
      if (!this.hover && this.hoverT === 0) this.hoverCode = 0;
      const tint = Phaser.Display.Color.GetColor(
        255 * (1 - dark * 0.55) + light.evening * 20,
        255 * (1 - dark * 0.5) - light.evening * 20,
        255 * (1 - dark * 0.3) - light.evening * 50,
      );

      for (const actor of this.living) {
        const t = sec + actor.phase;
        actor.sprite.setTint(tint);
        if (actor.route && actor.frames) {
          const motion = options.walkRoute(actor.route, t, actor.speed ?? 3);
          if (options.canWalk(motion.at)) {
            const sequence = WALK_FRAMES;
            const frame = motion.moving ? sequence[Math.floor(t * 5) % 4] : actor.motion === 'pasture' ? 3 : 0;
            setFrame(actor.sprite, `${actor.frames}-${frame}`)
              .setPosition(...motion.at)
              .setFlipX(motion.facingLeft);
            actor.sprite
              .setDepth(24 + motion.at[1] * 0.001)
              .setAngle(0)
              .setScale(1);
          }
        } else if (actor.motion === 'fly') {
          const flight = t * 0.07;
          const direction = Math.cos(flight);
          actor.sprite.setPosition(actor.at[0] + Math.sin(flight) * 135, actor.at[1] + Math.sin(flight * 2) * 22);
          actor.sprite
            .setFlipX(direction < 0)
            .setScale(1, 0.86 + Math.sin(t * 3.5) * 0.14)
            .setAngle(Math.sin(flight * 2) * 5);
        } else if (actor.motion === 'graze') {
          actor.sprite.setAngle(Math.sin(t * 0.6) * 2).setScale(1, 1 + Math.sin(t * 1.3) * 0.018);
        } else {
          actor.sprite
            .setScale(1 + Math.sin(t * 1.5) * 0.012, 1 + Math.sin(t * 1.5) * 0.02)
            .setAngle(Math.sin(t * 0.45) * 1.2);
        }
      }
      for (const actor of this.pedestrians) {
        const motion = options.walkRoute(actor.path.route, sec + actor.phase, actor.path.speed);
        if (!options.canWalk(motion.at)) continue;
        const frame = motion.moving ? Math.floor((sec + actor.phase) * 5.5) % 4 : 1;
        setFrame(actor.sprite, `npc-${actor.variant}-${frame}`).setFlipX(motion.facingLeft);
        actor.sprite
          .setPosition(...motion.at)
          .setDepth(24 + motion.at[1] * 0.001)
          .setTint(tint);
      }
      for (const boat of this.boats) {
        const a = boat.route[0],
          b = boat.route[boat.route.length - 1];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        boat.t = (boat.t + (boat.speed * dt) / (2 * length)) % 1;
        const u = smooth(boat.t < 0.5 ? boat.t * 2 : 2 - boat.t * 2);
        const x = a[0] + (b[0] - a[0]) * u;
        const y = a[1] + (b[1] - a[1]) * u;
        const forward = boat.t < 0.5 === b[0] > a[0];
        boat.sprite
          .setPosition(x, y + Math.sin(sec * 1.1 + length) * 0.4)
          .setFlipX(boat.faceRight !== forward)
          .setAngle(Math.sin(sec * 0.8 + length) * 1.5)
          .setTint(tint);
        boat.ring.setPosition(x, y).setScale(1 + Math.sin(sec * 1.4 + length) * 0.06);
        boat.wake.followOffset.set(forward ? -boat.sprite.width * 0.35 : boat.sprite.width * 0.35, -1);
      }
      for (const flock of this.flocks) {
        flock.t = (flock.t + dt / flock.seconds) % 1;
        flock.group.setPosition(
          flock.from[0] + (flock.to[0] - flock.from[0]) * flock.t,
          flock.from[1] + (flock.to[1] - flock.from[1]) * flock.t + Math.sin(sec * 0.6) * 6,
        );
        for (const child of flock.group.list) {
          const bird = child as Phaser.GameObjects.Image;
          bird.setScale(1, 0.6 + 0.4 * Math.abs(Math.sin(sec * 4 + bird.x)));
        }
      }
      for (const c of this.circlers) {
        const a = c.phase + sec * c.path.speed;
        const x = c.path.center[0] + Math.cos(a) * c.path.rx;
        const y = c.path.center[1] + Math.sin(a) * c.path.ry;
        if (c.walker) {
          c.sprite.setPosition(x, y - Math.abs(Math.sin(sec * 5 + c.phase)) * 0.5);
          c.sprite.setFlipX(-Math.sin(a) * c.path.speed < 0).setTint(tint);
          c.sprite.setAlpha(c.phase % 2 < 1 ? 1 : 1 - light.night);
        } else {
          c.sprite.setPosition(x, y + Math.sin(sec * 2 + c.phase) * 3);
          c.sprite.setScale(0.9, 0.5 + 0.4 * Math.abs(Math.sin(sec * 5 + c.phase)));
          c.sprite.setAlpha(1 - light.night * 0.8);
        }
      }
      this.updateFootball(sec, dt, tint, light);
      this.updateFarm(sec, dt, tint);
      this.updateFish(dt, tint);
      for (const item of this.nightOnly) item.obj.setAlpha(item.max * Math.min(1, light.night * 1.2));
      for (const item of this.dayOnly) item.obj.setAlpha(item.max * (1 - light.night));
      this.drawFountains(sec, light);
      this.mill?.setAngle((sec * d.windmillRpm * 6) % 360).setTint(tint);
      this.wheel?.setAngle(((sec / d.ferrisSeconds) * 360) % 360).setTint(tint);
      const wheelHub = sp['ferris-rim-v1']?.hub;
      if (wheelHub)
        for (const [k, cabin] of this.cabins.entries()) {
          const a = (sec / d.ferrisSeconds + k / this.cabins.length) * Math.PI * 2;
          cabin.setPosition(wheelHub[0] + Math.cos(a) * 39 * 0.82, wheelHub[1] + Math.sin(a) * 39);
          cabin.setAngle(Math.sin(sec * 0.8 + k) * 2).setTint(tint);
        }
      for (const ripple of this.fountainRipples) {
        const t = (sec / 2.8 + ripple.phase) % 1;
        ripple.ring
          .setPosition(...ripple.at)
          .setScale(0.2 + t * 1.3)
          .setAlpha(Math.sin(t * Math.PI) * 0.45);
      }
      this.updatePlane(sec, light);
      this.drawLights(sec, light);
    }

    private updateFootball(sec: number, dt: number, tint: number, light: WorldLighting) {
      const f = d.football;
      const order = PASS_ORDER;
      const pass = sec / 3.6;
      const a = this.players[order[Math.floor(pass) % order.length]]?.home ?? f.center;
      const b = this.players[order[(Math.floor(pass) + 1) % order.length]]?.home ?? f.center;
      const u = pass % 1;
      const bx = a[0] + (b[0] - a[0]) * u;
      const by = a[1] + (b[1] - a[1]) * u;
      this.ball.setPosition(bx, by - Math.abs(Math.sin(sec * 2.2)) * 1.5).setAlpha(1 - light.night);
      for (const [i, p] of this.players.entries()) {
        // mỗi cầu thủ giữ vị trí nhưng bị kéo về phía bóng; người gần nhất chạy hẳn tới bóng
        const pull = i % 3 === 0 ? 0.85 : 0.35;
        const tx = p.home[0] + (bx - p.home[0]) * pull + Math.sin(sec * 0.9 + i) * 3;
        const ty = p.home[1] + (by - p.home[1]) * pull;
        const k = 1 - Math.exp(-dt * 1.2);
        const nx = p.sprite.x + (tx - p.sprite.x) * k;
        p.sprite.setFlipX(nx < p.sprite.x);
        const moving = Math.hypot(tx - p.sprite.x, ty - p.sprite.y) > 1;
        setFrame(p.sprite, `npc-${p.team ? 'blue' : 'red'}-${moving ? Math.floor(sec * 7 + i) % 4 : 1}`);
        p.sprite
          .setPosition(nx, p.sprite.y + (ty - p.sprite.y) * k)
          .setTint(tint)
          .setAlpha(1 - light.night);
      }
    }

    private updateFarm(sec: number, dt: number, tint: number) {
      const cow = sp.cow;
      if (this.cow && cow) {
        // bò đi chậm qua lại, dừng gặm cỏ ở hai đầu
        const t = (sec / 30) % 1;
        const u = t < 0.4 ? smooth(t / 0.4) : t < 0.5 ? 1 : t < 0.9 ? 1 - smooth((t - 0.5) / 0.4) : 0;
        const walking = (t > 0.02 && t < 0.38) || (t > 0.52 && t < 0.88);
        this.cow
          .setPosition(cow.x + cow.w / 2 - u * d.cowRoam, cow.y + cow.h / 2 + (walking ? Math.sin(sec * 6) * 0.4 : 0))
          .setFlipX(t >= 0.5)
          .setAngle(walking ? 0 : Math.sin(sec * 1.5) * 2)
          .setTint(tint);
      }

      const [x0, y0, x1, y1] = d.chickens.area;
      for (const c of this.chickens) {
        c.wait -= dt;
        if (c.wait <= 0) {
          c.tx = Phaser.Math.Clamp(c.x + Phaser.Math.Between(-14, 14), x0, x1);
          c.ty = Phaser.Math.Clamp(c.y + Phaser.Math.Between(-6, 6), y0, y1);
          c.wait = 2 + Math.random() * 4;
        }
        const dx = c.tx - c.x;
        const dy = c.ty - c.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, dt * 6);
        if (dist > 0.3) {
          c.x += (dx / dist) * step;
          c.y += (dy / dist) * step;
          setFrame(c.sprite, `hen-white-${1 + (Math.floor(sec * 6 + c.tx) % 2)}`)
            .setFlipX(dx < 0)
            .setAngle(0);
        } else setFrame(c.sprite, `hen-white-${Math.sin(sec * 3 + c.tx) > 0.15 ? 3 : 0}`).setAngle(0);
        c.sprite.setPosition(c.x, c.y).setTint(tint);
      }
    }

    private updateFish(dt: number, tint: number) {
      const { sprite, splash } = this.fish;
      if (this.fishT < 0) {
        this.fishNext -= dt;
        if (this.fishNext > 0) return;
        const spot = d.fishSpots[Phaser.Math.Between(0, d.fishSpots.length - 1)];
        if (!spot) return;
        this.fishAt = spot;
        this.fishT = 0;
        splash.explode(6, this.fishAt[0] - 8, this.fishAt[1]);
      }
      this.fishT += dt / 1.3;
      const t = this.fishT;
      const [x, y] = this.fishAt;
      sprite
        .setVisible(true)
        .setPosition(x - 8 + 16 * t, y - Math.sin(t * Math.PI) * 18)
        .setAngle(-50 + 100 * t)
        .setTint(tint);
      if (t >= 1) {
        sprite.setVisible(false);
        splash.explode(8, x + 8, y);
        this.fishT = -1;
        this.fishNext = 4 + Math.random() * 6;
      }
    }

    /** Máy bay: đỗ → lăn → cất cánh → bay mất → hạ cánh từ phía tây bắc → lăn về chỗ đỗ. */
    private updatePlane(sec: number, light: WorldLighting) {
      const plane = this.plane;
      const s0 = sp['airport-plane-v1'];
      if (!plane || !s0) return;
      const [hx, hy] = d.plane.heading;
      const parkX = s0.x + s0.w / 2,
        parkY = s0.y + s0.h / 2;
      const T = d.plane.cycle;
      const t = sec % T;
      // Park, accelerate along the runway, climb, then return on a descending approach.
      let s = 0;
      let alt = 0;
      let visible = true;
      let approachFade = 1;
      const phase = (t / T) * 80;
      if (phase < 8) s = 0;
      else if (phase < 28) {
        const k = (phase - 8) / 20;
        s = 440 * k * k;
        alt = Math.max(0, (k - 0.45) / 0.55) ** 1.5 * 210;
      } else if (phase < 48) visible = false;
      else if (phase < 64) {
        const k = (phase - 48) / 16;
        s = -310 * (1 - smooth(k));
        alt = 150 * (1 - k) ** 1.6;
        approachFade = smooth(Math.min(1, k * 5));
      }
      plane.body.setVisible(visible);
      plane.shadow.setVisible(visible);
      if (!visible) return;
      const x = parkX + hx * s;
      const y = parkY + hy * s;
      const scale = 1 + alt / 400;
      const fade = approachFade * (alt > 120 ? Math.max(0, 1 - (alt - 120) / 80) : 1);
      plane.body
        .setPosition(x, y - alt)
        .setScale(scale)
        .setAngle(-7 - Math.min(5, alt / 30))
        .setAlpha(fade);
      plane.shadow
        .setPosition(x + alt * 0.15, y + 2)
        .setScale(1 - alt / 500, (1 - alt / 500) * 0.4)
        .setAngle(-7)
        .setAlpha(0.22 * fade * Math.max(0, 1 - alt / 170));
      const dim = Math.max(light.night, light.evening * 0.6);
      plane.body.setTint(
        Phaser.Display.Color.GetColor(255 * (1 - dim * 0.5), 255 * (1 - dim * 0.45), 255 * (1 - dim * 0.25)),
      );
    }

    private drawFountains(sec: number, light: WorldLighting) {
      const g = this.waterG;
      g.clear();
      for (let i = 0; i < d.fountains.length; i++) {
        const [x, y] = d.fountains[i];
        const pulse = 0.88 + Math.sin(sec * 0.8 + i) * 0.12;
        g.lineStyle(0.8, 0xcfefff, (1 - light.night * 0.7) * 0.65);
        for (const side of FOUNTAIN_SIDES)
          for (let k = 0; k < 3; k++) {
            const span = (8 + k * 4) * side;
            g.beginPath();
            g.moveTo(x, y - 3);
            for (let step = 1; step <= 16; step++) {
              const t = step / 16;
              g.lineTo(x + span * t, y - 3 - Math.sin(t * Math.PI) * (10 + k * 2) * pulse + t * 4);
            }
            g.strokePath();
          }
      }
    }

    private drawLights(sec: number, light: WorldLighting) {
      const g = this.lightsG;
      g.clear();
      const dim = Math.max(light.night, light.evening * 0.6);
      const glow = Math.min(1, light.night + light.evening * 0.5);
      const fw = d.ferrisLights;
      if (glow > 0.02)
        for (let k = 0; k < fw.count; k++) {
          const a = (k / fw.count + sec / d.ferrisSeconds) * Math.PI * 2;
          g.fillStyle(LIGHT_COLORS[k % 3], glow * (0.6 + 0.4 * Math.sin(sec * 1.5 + k)));
          g.fillCircle(fw.center[0] + Math.cos(a) * fw.radius * 0.82, fw.center[1] + Math.sin(a) * fw.radius, 2);
        }
      const [bx, by] = d.towerBeacon;
      const pulse = (Math.sin(sec * 2) + 1) / 2;
      g.fillStyle(0xff3b30, 0.35 + 0.65 * pulse);
      g.fillCircle(bx, by, 2.2);
      g.fillStyle(0xff3b30, 0.12 * pulse * (0.4 + dim));
      g.fillCircle(bx, by, 8);
      if (dim > 0.1) {
        const [ax, ay] = d.runway.from;
        const [cx, cy] = d.runway.to;
        for (let k = 0; k < 3; k++) {
          const u = (sec / 3 + k * 0.08) % 1;
          g.fillStyle(0xfff4c2, dim * (1 - k * 0.3));
          g.fillCircle(ax + (cx - ax) * u, ay + (cy - ay) * u, 2.4 - k * 0.5);
        }
      }
      const p = this.plane?.body;
      if (p?.visible && p.alpha > 0.05) {
        const blink = Math.sin(sec * 6) > 0.7 ? 1 : 0.2;
        g.fillStyle(0xff4040, (0.3 + dim * 0.7) * p.alpha);
        g.fillCircle(p.x - 8 * p.scale, p.y + 13 * p.scale, 1.8);
        g.fillStyle(0x40ff70, (0.3 + dim * 0.7) * p.alpha);
        g.fillCircle(p.x + 10 * p.scale, p.y - 11 * p.scale, 1.8);
        g.fillStyle(0xffffff, blink * (0.3 + dim * 0.7) * p.alpha);
        g.fillCircle(p.x - 35 * p.scale, p.y - 16 * p.scale, 1.6);
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    scale: { mode: Phaser.Scale.RESIZE },
    transparent: true,
    antialias: true,
    scene: [new MapScene()],
    audio: { noAudio: true },
    banner: false,
  });

  return {
    destroy() {
      game.destroy(true);
    },
  };
}
