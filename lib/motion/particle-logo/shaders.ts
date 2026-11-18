// Custom GLSL shaders for the 3D Yes particle logomark.
// Supports per-particle morph delay (seed * 0.3), ease-in-out curve,
// object-space pointer repulsion, shimmer (±15%), and soft core+halo sprites.

export const PARTICLE_VERTEX_SHADER = /* glsl */ `
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

  // Slow cosmic drift once scattered behind lower sections (zero when uTime == 0).
  float driftMask = eased * step(0.0001, uTime);
  pos.x += sin(uTime * 0.32 + aSeed * 37.6991) * 0.14 * driftMask;
  pos.y += cos(uTime * 0.24 + aSeed * 25.1327) * 0.10 * driftMask;
  pos.z += sin(uTime * 0.28 + aSeed * 18.8495) * 0.08 * driftMask;

  // Object-space pointer repulsion onto z = 0 plane.
  vec2 delta = pos.xy - uPointer.xy;
  float dist = length(delta);
  float falloff = 1.0 - smoothstep(0.0, uRadius, dist);
  float push = falloff * uPointerStrength * (1.0 - eased * 0.75);
  vec2 dir = dist > 0.0001
    ? delta / dist
    : vec2(cos(aSeed * 6.28318), sin(aSeed * 6.28318));
  pos.xy += dir * push * 0.18;
  pos.z += push * 0.12;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceScale = 4.4 / max(0.8, -mvPosition.z);
  float sizeJitter = 0.68 + aSeed * 0.68;
  float scatterBoost = 1.0 + eased * 0.15;
  gl_PointSize = clamp(
    uBaseSize * sizeJitter * scatterBoost * uPixelRatio * distanceScale,
    1.5,
    36.0
  );

  // Shimmer ±15% over time with per-particle phase.
  vShimmer = 1.0 + 0.15 * sin(uTime * (1.6 + aSeed * 1.4) + aSeed * 62.83185);
  // Shade interior/extrusion volume particles darker (0.6x) than front/back faces (±0.12)
  // so 3D depth reads sharply when the mark turns; relax back to 1.0 as it scatters.
  float isFace = step(0.115, abs(position.z));
  float depthShade = mix(mix(0.6, 1.0, isFace), 1.0, eased);
  vColor = aColor * depthShade;
  vMorph = eased;
}
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
uniform float uOpacity;
uniform float uIntensity;

varying vec3 vColor;
varying float vShimmer;
varying float vMorph;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;

  // Dense soft luminous core + atmospheric halo, smooth outer fade.
  float core = exp(-d * d * 8.8);
  float halo = exp(-d * d * 2.8) * 0.24;
  float edge = smoothstep(1.0, 0.78, d);
  float sprite = (core + halo) * edge;

  // When scattered, particles spread thin so boost per-particle presence smoothly.
  float scatterLift = mix(1.0, 1.55, vMorph);
  float alpha = sprite * uOpacity * uIntensity * vShimmer * scatterLift;

  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;

export const DUST_VERTEX_SHADER = /* glsl */ `
attribute vec3 aColor;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 pos = position;
  float isMoving = step(0.0001, uTime);
  pos.x += sin(uTime * 0.18 + aSeed * 43.9822) * 0.24 * isMoving;
  pos.y += cos(uTime * 0.14 + aSeed * 29.8451) * 0.18 * isMoving;
  pos.z += sin(uTime * 0.16 + aSeed * 17.5929) * 0.14 * isMoving;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceScale = 5.5 / max(1.0, -mvPosition.z);
  gl_PointSize = clamp(
    (2.4 + aSeed * 3.2) * uPixelRatio * distanceScale,
    1.2,
    14.0
  );

  vColor = aColor;
  vAlpha = 0.18 + 0.12 * sin(uTime * (0.6 + aSeed * 0.7) + aSeed * 31.4159);
}
`;

export const DUST_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;

  float falloff = exp(-d * d * 5.0) * smoothstep(1.0, 0.75, d);
  float alpha = falloff * vAlpha;
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;
