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

  // Sculptural 3D slab extrusion depth when formed, relaxing to scatter field on scroll.
  pos.z *= mix(2.1, 1.0, eased);

  // Subtle living harmonic surface wave across the formed 3D mark.
  float isMoving = step(0.0001, uTime);
  float wave = sin(position.x * 3.2 + uTime * 2.0) * cos(position.y * 3.2 - uTime * 1.6);
  pos.z += wave * 0.016 * (1.0 - eased) * isMoving;

  // Slow cosmic drift once scattered behind lower sections (zero when uTime == 0).
  float driftMask = eased * isMoving;
  pos.x += sin(uTime * 0.32 + aSeed * 37.6991) * 0.16 * driftMask;
  pos.y += cos(uTime * 0.24 + aSeed * 25.1327) * 0.12 * driftMask;
  pos.z += sin(uTime * 0.28 + aSeed * 18.8495) * 0.10 * driftMask;

  // Object-space pointer 3D vortex swirl + radial ripple + Z-lift onto z = 0 plane.
  vec2 delta = pos.xy - uPointer.xy;
  float dist = length(delta);
  float falloff = 1.0 - smoothstep(0.0, uRadius, dist);
  float push = falloff * uPointerStrength * (1.0 - eased * 0.75);
  vec2 dir = dist > 0.0001
    ? delta / dist
    : vec2(cos(aSeed * 6.28318), sin(aSeed * 6.28318));
  vec2 swirl = vec2(-dir.y, dir.x);
  pos.xy += dir * push * 0.022 + swirl * push * 0.028 * sin(dist * 10.0 - uTime * 5.0);
  pos.z += push * 0.12;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceScale = 4.4 / max(0.8, -mvPosition.z);
  float sizeJitter = 0.86 + aSeed * 0.28;
  float scatterBoost = 1.0 + eased * 0.25;
  gl_PointSize = clamp(
    uBaseSize * sizeJitter * scatterBoost * uPixelRatio * distanceScale,
    1.2,
    9.5
  );

  // Coherent diagonal sheen + gentle per-particle shimmer without static noise.
  float sheen = 0.08 * sin(position.x * 2.2 - position.y * 1.8 + uTime * 1.4);
  vShimmer =
    1.0 +
    0.07 * sin(uTime * (1.4 + aSeed * 1.2) + aSeed * 62.83185) +
    sheen * (1.0 - eased) * isMoving;

  // View-space normal lighting: dims back faces so they never ghost through cutouts,
  // while keeping front faces luminous and highlighting beveled side walls.
  vec3 viewNormal = normalize(normalMatrix * aNormal);
  float frontMask = smoothstep(-0.45, 0.25, viewNormal.z);
  float faceVisibility = mix(0.24, 1.0, frontMask);
  float rimLight = pow(1.0 - min(1.0, abs(viewNormal.z)), 1.6) * 0.38;
  float keyLight = max(0.0, dot(viewNormal, normalize(vec3(-0.35, 0.45, 0.82)))) * 0.28;
  float shade3D = mix(faceVisibility * (0.88 + keyLight) + rimLight, 1.0, eased);

  vColor = aColor * shade3D;
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

  // Silky micro-LED Gaussian sprite so adjacent particles fuse cleanly.
  float core = exp(-d * d * 9.5);
  float halo = exp(-d * d * 3.2) * 0.34;
  float edge = smoothstep(1.0, 0.72, d);
  float sprite = (core + halo) * edge;

  // When scattered, particles spread thin so boost per-particle presence smoothly.
  float scatterLift = mix(1.0, 1.65, vMorph);
  float alpha = sprite * uOpacity * uIntensity * vShimmer * scatterLift;
  vec3 baseCol =
    mix(vColor, vColor * 1.35 + vec3(0.10, 0.20, 0.30), vEnergy * 0.45) +
    vec3(core * 0.12) * length(vColor);
  vec3 col = baseCol * alpha;
  // Smooth tone-map prevents channel clipping while keeping additive glow luminous.
  col = col / (1.0 + col * 0.42);

  gl_FragColor = vec4(col, alpha);
}
`;

export const DUST_VERTEX_SHADER = /* glsl */ `
attribute vec3 aColor;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uPointer;
uniform float uScrollMorph;

varying vec3 vColor;
varying float vAlpha;

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
  gl_PointSize = clamp(
    (2.0 + aSeed * 3.4) * uPixelRatio * distanceScale,
    1.2,
    12.0
  );

  vColor = aColor;
  vAlpha = 0.24 + 0.16 * sin(uTime * (0.7 + aSeed * 0.8) + aSeed * 31.4159);
}
`;

export const DUST_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;

  float falloff = exp(-d * d * 7.5) * smoothstep(1.0, 0.72, d);
  float alpha = falloff * vAlpha;
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;
