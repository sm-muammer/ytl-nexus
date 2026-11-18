// Custom GLSL shaders for the 3D Yes particle logomark.
// Supports per-particle morph delay (seed * 0.3), ease-in-out curve,
// view-space normal lighting & back-face attenuation, 3D vortex pointer
// physics, shimmer (±15%), and crisp micro-LED core+halo sprites.

export const PARTICLE_VERTEX_SHADER = /* glsl */ `
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec3 aScatter;
attribute float aSeed;

uniform float uTime;
uniform float uMorph;
uniform float uPixelRatio;
uniform float uBaseSize;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uRadius;

varying vec3 vColor;
varying float vShimmer;
varying float vMorph;
varying float vEnergy;

float easeInOutCubic(float t) {
  return t < 0.5
    ? 4.0 * t * t * t
    : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
}

void main() {
  // Per-particle delay up to 0.3 of the morph span so particles peel and converge organically.
  float localT = clamp((uMorph - aSeed * 0.3) / 0.7, 0.0, 1.0);
  float eased = easeInOutCubic(localT);

  vec3 pos = mix(position, aScatter, eased);

  // Thin 3D depth slice when formed so the rear face never offsets into a dark shadow.
  pos.z *= mix(0.65, 1.0, eased);

  // Subtle living harmonic surface wave across the formed 3D mark.
  float isMoving = step(0.0001, uTime);
  float wave = sin(position.x * 3.2 + uTime * 2.0) * cos(position.y * 3.2 - uTime * 1.6);
  pos.z += wave * 0.016 * (1.0 - eased) * isMoving;

  // Slow cosmic drift once scattered behind lower sections (zero when uTime == 0).
  float driftMask = eased * isMoving;
  pos.x += sin(uTime * 0.32 + aSeed * 37.6991) * 0.16 * driftMask;
  pos.y += cos(uTime * 0.24 + aSeed * 25.1327) * 0.12 * driftMask;
  pos.z += sin(uTime * 0.28 + aSeed * 18.8495) * 0.10 * driftMask;

  // Responsive object-space pointer scatter burst, radial push, swirl, and Z dispersal.
  vec2 delta = pos.xy - uPointer.xy;
  float dist = length(delta);
  float hitRadius = uRadius * 1.75;
  float falloff = pow(1.0 - smoothstep(0.0, hitRadius, dist), 1.25);
  float push = falloff * uPointerStrength * (1.0 - eased * 0.75);
  vec2 dir = dist > 0.0001
    ? delta / dist
    : vec2(cos(aSeed * 6.28318), sin(aSeed * 6.28318));
  vec2 swirl = vec2(-dir.y, dir.x);
  vec3 scatterBurst = vec3(
    cos(aSeed * 62.8318 + uTime * 2.4),
    sin(aSeed * 62.8318 + uTime * 2.4),
    sin(aSeed * 19.7392 + uTime * 3.1)
  ) * (0.18 + 0.28 * aSeed);
  pos.xy +=
    dir * push * (0.34 + 0.24 * aSeed) +
    swirl * push * (0.14 * (aSeed - 0.3)) +
    scatterBurst.xy * push;
  pos.z += push * (0.28 * (aSeed - 0.4)) + scatterBurst.z * push;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceScale = 4.4 / max(0.8, -mvPosition.z);
  float sizeJitter = 0.88 + aSeed * 0.24;
  float scatterBoost = 1.0 + eased * 0.25;
  gl_PointSize = clamp(
    uBaseSize * sizeJitter * scatterBoost * uPixelRatio * distanceScale,
    1.2,
    5.2
  );

  // Coherent diagonal sheen + gentle per-particle shimmer without static noise.
  float sheen = 0.08 * sin(position.x * 2.2 - position.y * 1.8 + uTime * 1.4);
  vShimmer =
    1.0 +
    0.07 * sin(uTime * (1.4 + aSeed * 1.2) + aSeed * 62.83185) +
    sheen * (1.0 - eased) * isMoving;

  // Perceptually lift blue/indigo so the right half reads vividly without dark back-face shadows.
  vec3 liftedColor = pow(clamp(aColor, 0.0, 1.0), vec3(0.76)) + vec3(0.05, 0.06, 0.14);

  vec3 viewNormal = normalize(normalMatrix * aNormal);
  float rimLight = pow(1.0 - min(1.0, abs(viewNormal.z)), 1.6) * 0.22;
  float keyLight = max(0.0, dot(viewNormal, normalize(vec3(-0.35, 0.45, 0.82)))) * 0.16;
  float shade3D = mix(0.96 + keyLight + rimLight, 1.0, eased);

  vColor = clamp(liftedColor * shade3D, 0.0, 1.25);
  vMorph = eased;
  vEnergy = clamp(push * 0.85, 0.0, 1.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
uniform float uOpacity;
uniform float uIntensity;

varying vec3 vColor;
varying float vShimmer;
varying float vMorph;
varying float vEnergy;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;

  // Crisp high-definition micro-dot core so desktop particles never blur together.
  float core = smoothstep(0.88, 0.22, d);
  float peak = exp(-d * d * 12.0) * 0.22;
  float sprite = clamp(core + peak, 0.0, 1.0);

  // When scattered, particles spread thin so boost per-particle presence smoothly.
  float scatterLift = mix(1.0, 1.35, vMorph);
  float alpha = clamp(sprite * uOpacity * uIntensity * vShimmer * scatterLift, 0.0, 0.98);
  vec3 col =
    mix(vColor, vColor * 1.22 + vec3(0.12, 0.18, 0.28), vEnergy * 0.45) +
    vec3(peak * 0.35);
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`;

export const DUST_VERTEX_SHADER = /* glsl */ `
attribute vec3 aColor;
attribute vec3 aColorDark;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uPointer;
uniform float uScrollMorph;
uniform float uDark;

varying vec3 vColor;
varying float vAlpha;
varying float vDark;

void main() {
  vec3 pos = position;
  float isMoving = step(0.0001, uTime);

  // Orbit particles gently around the Y axis and expand softly on scroll.
  float angle = uTime * (0.045 + aSeed * 0.055) * isMoving;
  float ca = cos(angle);
  float sa = sin(angle);
  pos.xz = mat2(ca, -sa, sa, ca) * pos.xz;
  pos *= 1.0 + uScrollMorph * 0.18;

  // Subtle floating drift + pointer parallax depth.
  pos.x += sin(uTime * 0.22 + aSeed * 43.9822) * 0.16 * isMoving + uPointer.x * (0.08 + aSeed * 0.12);
  pos.y += cos(uTime * 0.18 + aSeed * 29.8451) * 0.12 * isMoving + uPointer.y * (0.06 + aSeed * 0.10);
  pos.z += sin(uTime * 0.20 + aSeed * 17.5929) * 0.10 * isMoving;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceScale = 5.5 / max(1.0, -mvPosition.z);
  float basePoint = mix(2.0 + aSeed * 3.4, 2.75 + aSeed * 4.2, uDark);
  gl_PointSize = clamp(
    basePoint * uPixelRatio * distanceScale,
    1.2,
    14.0
  );

  vColor = mix(aColor, aColorDark, uDark);
  vDark = uDark;

  float alphaLight = 0.24 + 0.16 * sin(uTime * (0.7 + aSeed * 0.8) + aSeed * 31.4159);
  float alphaDark = 0.65 + 0.30 * sin(uTime * (0.85 + aSeed * 1.15) + aSeed * 31.4159);
  vAlpha = mix(alphaLight, alphaDark, uDark);
}
`;

export const DUST_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDark;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;

  // White mode format: exact original falloff and premultiplied alpha
  float falloffLight = exp(-d * d * 7.5) * smoothstep(1.0, 0.72, d);
  float alphaLight = falloffLight * vAlpha;
  vec4 colorLight = vec4(vColor * alphaLight, alphaLight);

  // Dark mode format: bright luminous glowing core with soft starry halo
  float core = smoothstep(0.85, 0.2, d);
  float halo = exp(-d * d * 3.8) * 0.6;
  float spriteDark = clamp(core * 0.7 + halo * 0.45, 0.0, 1.0);
  float alphaDark = spriteDark * vAlpha;
  vec3 rgbDark = vColor * (0.95 + core * 0.55);
  vec4 colorDark = vec4(rgbDark, alphaDark);

  gl_FragColor = mix(colorLight, colorDark, vDark);
}
`;
