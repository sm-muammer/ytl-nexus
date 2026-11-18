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
  pos.xy += dir * push * 0.38;
  pos.z += push * 0.24;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceScale = 4.4 / max(0.8, -mvPosition.z);
  float sizeJitter = 0.68 + aSeed * 0.68;
  float scatterBoost = 1.0 + eased * 0.45;
  gl_PointSize = clamp(
    uBaseSize * sizeJitter * scatterBoost * uPixelRatio * distanceScale,
    1.5,
    64.0
  );

  // Shimmer ±15% over time with per-particle phase.
  vShimmer = 1.0 + 0.15 * sin(uTime * (1.6 + aSeed * 1.4) + aSeed * 62.83185);
  vColor = aColor;
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

  // Crisp bright pinpoint core + atmospheric halo, smooth outer fade.
  float core = exp(-d * d * 13.5);
  float halo = exp(-d * d * 3.4) * 0.18;
  float edge = smoothstep(1.0, 0.78, d);
  float sprite = (core + halo) * edge;

  // When scattered, particles spread thin so boost per-particle presence smoothly.
  float scatterLift = mix(1.0, 1.55, vMorph);
  float alpha = sprite * uOpacity * uIntensity * vShimmer * scatterLift;

  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;
