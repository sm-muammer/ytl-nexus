"use client";

import dynamic from "next/dynamic";

const DynamicParticleLogo = dynamic(
  () => import("./particle-logo").then((mod) => mod.ParticleLogo),
  {
    ssr: false,
    loading: () => null,
  },
);

/**
 * Client-side lazy loader for the Three.js WebGL Yes logomark (D-242).
 * Loaded with ssr: false only on "/" so Three.js stays out of every other
 * route bundle.
 */
export function ParticleLogoLoader() {
  return <DynamicParticleLogo />;
}
