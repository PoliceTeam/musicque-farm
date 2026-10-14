/** Opaque RGB data textures: mask R=water, G=sky, B=waterfalls; zones R=id×20, G=soft land.
 * The panorama stays fixed. Lighting and subtle glints never distort shorelines or connected buildings.
 */
export const WORLD_MAP_FRAGMENT = `
#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 outTexCoord;
uniform sampler2D uMap;
uniform sampler2D uSky;
uniform sampler2D uClouds;
uniform sampler2D uSurf;
uniform sampler2D uMask;
uniform sampler2D uLights;
uniform float uTime;
uniform vec4 uMix;
uniform vec2 uPar;
uniform vec2 uSize;
uniform float uFlipY;
uniform sampler2D uZones;
uniform float uHover;
uniform float uHoverT;
uniform vec4 uFlag;
uniform vec4 uBeaconA;
uniform vec4 uBeaconB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// Soft rotating lens beam; perspective compresses its vertical spread.
float beaconBeam(vec2 world, vec4 beacon) {
  vec2 p = (world - beacon.xy) * vec2(1.0, 2.8);
  float angle = uTime * 0.19 + beacon.w;
  vec2 direction = vec2(cos(angle), sin(angle));
  float along = dot(p, direction);
  float across = dot(p, vec2(-direction.y, direction.x));
  float width = 3.5 + max(along, 0.0) * 0.12;
  float beam = exp(-pow(across / width, 2.0));
  return beam * smoothstep(0.0, 12.0, along) * (1.0 - smoothstep(150.0, 320.0, along));
}
vec3 beaconLight(vec2 world, vec4 beacon, float water, float night) {
  float cone = beaconBeam(world, beacon);
  float lens = exp(-pow(length((world - beacon.xy) / vec2(5.0, 3.2)), 2.0));
  float star = exp(-pow(length((world - beacon.xy) / vec2(10.0, 0.9)), 2.0));
  // Broken reflection starts below the tower, clipped to actual water pixels.
  float shimmer = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(world.y * 1.6 + uTime * 2.3 + sin(world.x * 0.45)), 3.0);
  float reflection = exp(-pow((world.x - beacon.x) / 14.0, 2.0)) * exp(-max(0.0, world.y - beacon.z) / 60.0);
  reflection *= step(beacon.z, world.y) * water * shimmer * (0.5 + 0.5 * sin(uTime * 0.19 + beacon.w));
  return vec3(1.0, 0.84, 0.53) * night * (cone * 0.25 + lens * 0.95 + star * 0.22 + reflection * 0.22);
}

void main() {
  vec2 uv = vec2(outTexCoord.x, mix(outTexCoord.y, 1.0 - outTexCoord.y, uFlipY));
  vec2 px = uv * uSize;
  vec4 m = texture2D(uMask, uv);
  vec3 col = texture2D(uMap, uv).rgb;
  vec2 world = vec2(px.x, uSize.y - px.y);
  // Small canopy-only wind: mask B=128 is vegetation, B=255 is flowing water.
  if (m.b > 0.25 && m.b < 0.65) {
    float breeze = sin(uTime * 0.9 + world.x * 0.021) * sin(world.y * 0.09);
    vec2 swayUV = uv + vec2(breeze * 1.8 / uSize.x, 0.0);
    float neighbor = texture2D(uMask, swayUV).b;
    if (neighbor > 0.25 && neighbor < 0.65) col = texture2D(uMap, swayUV).rgb;
    col *= 1.0 + breeze * 0.035;
  }
  // Flutter only the cloth inside its footprint; the pole and roof stay fixed.
  if (world.x > uFlag.x && world.x < uFlag.z && world.y > uFlag.y && world.y < uFlag.w) {
    float reach = (world.x - uFlag.x) / (uFlag.z - uFlag.x);
    float edge = smoothstep(uFlag.y, uFlag.y + 1.5, world.y) * (1.0 - smoothstep(uFlag.w - 1.5, uFlag.w, world.y));
    float fold = sin(reach * 9.0 - uTime * 3.4);
    vec2 flagUV = uv + vec2(0.0, fold * reach * edge * 0.8 / uSize.y);
    col = texture2D(uMap, flagUV).rgb * (1.0 + fold * reach * 0.075);
  }
  float day = uMix.x;
  float eve = uMix.y;
  float night = uMix.z;
  float dawn = uMix.w;

  // Keep shorelines and buildings fixed; only add quiet water glints.
  if (m.r > 0.5) {
    float wave = sin(px.x * 0.18 + px.y * 0.35 + uTime * 0.65);
    float patches = smoothstep(0.78, 0.96, noise(px * vec2(0.045, 0.15) + vec2(uTime * 0.06, 0.0)));
    col += smoothstep(0.9, 1.0, wave) * patches * 0.13 * (day + eve * 0.5 + dawn * 0.6);
  }

  // Thác: vệt sáng chảy xuống.
  if (m.b > 0.85) {
    float streak = noise(vec2(px.x * 0.7, px.y * 0.07 + uTime * 3.0));
    col = mix(col, vec3(0.93, 0.98, 1.0), smoothstep(0.5, 0.85, streak) * 0.65);
  }

  if (m.g > 0.001) {
    vec3 originalSkyEdge = col * day + (col * vec3(1.18, 0.8, 0.6) + vec3(0.08, 0.02, 0.02)) * eve + col * vec3(0.38, 0.46, 0.69) * night + (col * vec3(0.91, 0.84, 0.98) + vec3(0.06, 0.02, 0.01)) * dawn;
    // Trời: giữ trời gốc ban ngày; chiều là hoàng hôn, đêm là trời sao.
    float h = clamp((1.0 - uv.y) / 0.30, 0.0, 1.2);  // 0 đỉnh trời, 1 sát núi
    // hoàng hôn: tím trên cao → hồng → cam → vàng sát chân trời; mặt trời lặn xuống sau núi
    vec3 evening = mix(vec3(0.36, 0.26, 0.58), vec3(0.98, 0.46, 0.55), smoothstep(0.05, 0.5, h));
    evening = mix(evening, vec3(1.0, 0.58, 0.24), smoothstep(0.45, 0.8, h));
    evening = mix(evening, vec3(1.0, 0.86, 0.45), smoothstep(0.78, 1.05, h));
    vec3 nightSky = mix(vec3(0.02, 0.035, 0.11), vec3(0.09, 0.13, 0.3), smoothstep(0.0, 1.2, h));
    vec3 sunrise = mix(vec3(0.28, 0.31, 0.59), vec3(1.0, 0.74, 0.59), smoothstep(0.08, 0.90, h));
    col = texture2D(uSky, uv).rgb * day + evening * eve + nightSky * night + sunrise * dawn;
    float warm = eve + dawn;
    vec2 sun = vec2(mix(0.72, 0.18, dawn) * uSize.x, 0.78 * uSize.y);
    float sd = length((px - sun) * vec2(1.0, 1.1));
    col = mix(col, vec3(1.0, 0.93, 0.7), warm * (1.0 - smoothstep(21.0, 24.0, sd)));
    col += vec3(1.0, 0.55, 0.25) * warm * 0.8 * exp(-length((px - sun) / vec2(260.0, 70.0)));
    // A real transparent cloud texture replaces subtraction from a cropped panorama.
    vec2 cloudUV = vec2(fract((px.x - uTime * 1.2 + 180.0) / 2050.0), 1.0 - (uSize.y - px.y + 50.0) / 460.0);
    vec4 cloudTex = texture2D(uClouds, cloudUV);
    float edge = smoothstep(0.0, 0.055, cloudUV.x) * (1.0 - smoothstep(0.945, 1.0, cloudUV.x));
    edge *= step(0.0, cloudUV.y) * step(cloudUV.y, 1.0);
    float c = cloudTex.a * edge;
    vec3 cloudTint = vec3(1.0) * day + vec3(1.0, 0.70, 0.62) * eve + vec3(0.23, 0.28, 0.43) * night + vec3(0.98, 0.81, 0.89) * dawn;
    // Phaser uploads transparent textures premultiplied.
    col = col * (1.0 - c) + cloudTex.rgb * cloudTint * edge;
    // Sao lấp lánh.
    vec2 cell = floor(px * 0.5);
    float star = step(0.9965, hash(cell)) * (0.55 + 0.45 * sin(uTime * 1.2 + hash(cell + 7.0) * 40.0));
    col += star * night * (1.0 - c);
    col = mix(originalSkyEdge, col, m.g);
  } else {
    // Chỉnh tông: chiều ấm, đêm lạnh và tối.
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 ev = mix(vec3(l), col, 0.8) * vec3(1.18, 0.8, 0.6) + vec3(0.08, 0.02, 0.02);
    ev += vec3(0.45, 0.2, 0.05) * exp(-length((px - vec2(0.72 * uSize.x, 0.78 * uSize.y)) / vec2(420.0, 160.0)));
    // nắng chiều: ấm hơn phía xa (gần chân trời), mặt nước ánh cam
    ev += vec3(0.18, 0.07, 0.0) * (1.0 - smoothstep(0.15, 0.6, 1.0 - uv.y)) + m.r * vec3(0.12, 0.04, -0.04);
    vec3 ni = mix(vec3(l), col, 0.65) * vec3(0.38, 0.46, 0.69);
    vec3 morning = col * vec3(0.91, 0.84, 0.98) + vec3(0.06, 0.02, 0.01);
    col = col * day + ev * eve + ni * night + morning * dawn;
    // Đèn: bật dần từ chiều, sáng hẳn ban đêm, nhấp nháy nhẹ.
    vec3 lamp = texture2D(uLights, uv).rgb;
    float flicker = 0.85 + 0.15 * noise(px * 0.3 + uTime * 0.8);
    col += lamp * flicker * (night * 1.05 + eve * 0.3 + dawn * 0.22);
  }

  // Advancing wave fronts follow distance to the hand-anchored shoreline and rock bases.
  vec3 surf = texture2D(uSurf, uv).rgb;
  if (surf.b > 0.01 && m.g < 0.5) {
    float distance = surf.r * 48.0;
    float turbulence = noise(px * vec2(0.10, 0.20) + vec2(uTime * 0.12, 0.0));
    float crest = sin(distance * 0.34 + uTime * 1.65 + turbulence * 1.3);
    float front = smoothstep(0.72, 0.98, crest);
    float approach = exp(-distance / 24.0);
    float foamBits = smoothstep(0.25, 0.80, noise(px * 0.42 + vec2(uTime * 0.3, -uTime * 0.6)));
    float foam = front * approach * (0.20 + foamBits * 0.48);
    // A burst near the rocks breaks into foam, then dissipates rather than forming a rigid ring.
    float impact = surf.g * pow(max(0.0, sin(uTime * 1.65 + noise(px * 0.025) * 2.0)), 4.0);
    foam += impact * foamBits * 0.35;
    foam *= surf.b * (day + eve * 0.8 + dawn * 0.8 + night * 0.30);
    col = mix(col, vec3(0.90, 0.98, 1.0), clamp(foam, 0.0, 0.72));
  }

  // Khu đang trỏ: sáng mềm theo hình đất của khu (không viền cứng), thở nhẹ; các khu khác lùi tối chút.
  if (uHover > 0.5) {
    vec4 z = texture2D(uZones, uv);
    float pulse = 0.88 + 0.12 * sin(uTime * 1.6);
    float inZone = step(abs(z.r * 255.0 / 20.0 - uHover), 0.4);
    float glowZone = inZone;
    vec3 warm = mix(vec3(1.0, 0.92, 0.7), vec3(1.0, 0.85, 0.55), night);
    float lift = inZone * z.g * uHoverT * pulse;
    col = col * (1.0 + 0.16 * lift) + warm * 0.07 * lift;
    col += warm * 0.35 * glowZone * z.b * uHoverT * pulse;
    col *= 1.0 - 0.1 * uHoverT * (1.0 - inZone) * (1.0 - glowZone * z.b) * (1.0 - m.g);
  }
  float beaconNight = night + eve * 0.4 + dawn * 0.15;
  col += beaconLight(world, uBeaconA, m.r, beaconNight);
  col += beaconLight(world, uBeaconB, m.r, beaconNight);
  gl_FragColor = vec4(col, 1.0);
}
`;
