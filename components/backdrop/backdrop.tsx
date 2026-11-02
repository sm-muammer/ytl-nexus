import { AmbientField } from "@/components/motion/ambient-field";
import { sceneFor } from "@/lib/navigation/scenes";

/**
 * The page backdrop: coloured light (tint), line work (pattern) and, on
 * public pages, a particle scene, all fixed behind the content. Each route has
 * its own combination in lib/navigation/scenes.ts, styled by the `.nx-tint-*`
 * and `.nx-pat-*` classes in app/globals.css. Decorative and hidden from
 * assistive technology.
 */
export function Backdrop({ path }: { path: string }) {
  const scene = sceneFor(path);
  return (
    <div
      aria-hidden="true"
      data-backdrop={path}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className={`nx-tint nx-tint-${scene.tint} absolute inset-0`} />
      {scene.pattern ? (
        <div className={`nx-pat nx-pat-${scene.pattern} absolute inset-0`} />
      ) : null}
      {scene.canvas ? (
        <AmbientField kind={scene.canvas} className="absolute inset-0" />
      ) : null}
      <div className="nx-vignette absolute inset-0" />
    </div>
  );
}
