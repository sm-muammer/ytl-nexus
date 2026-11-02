// Filename rules for committed assets (Requirement 2.15). Pure functions so the
// unit tests, the CLI check and the conversion pipeline share one definition.

const KEBAB_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/;
const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Words that mark a throwaway or unreviewed file. A match on any hyphen
// separated part of a name is an error.
export const BANNED_NAME_PARTS = [
  "final",
  "copy",
  "untitled",
  "screenshot",
  "temp",
  "tmp",
  "backup",
  "old",
] as const;

export type BadAssetName = { path: string; reason: string };

export function isKebabCaseAssetName(filename: string): boolean {
  return KEBAB_FILE.test(filename);
}

function baseWithoutExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? filename : filename.slice(0, dot);
}

export function findBadAssetNames(paths: readonly string[]): BadAssetName[] {
  const bad: BadAssetName[] = [];
  for (const assetPath of paths) {
    const segments = assetPath.split("/").filter(Boolean);
    const filename = segments.at(-1) ?? "";
    // Dotfiles such as .DS_Store or .gitkeep are never assets.
    if (filename.startsWith(".")) continue;

    const directories = segments.slice(0, -1);
    const badDirectory = directories.find((d) => !KEBAB_SEGMENT.test(d));
    if (badDirectory !== undefined) {
      bad.push({
        path: assetPath,
        reason: `directory "${badDirectory}" is not kebab-case`,
      });
      continue;
    }
    if (!isKebabCaseAssetName(filename)) {
      bad.push({
        path: assetPath,
        reason:
          "filename is not kebab-case (lowercase letters, digits, hyphens)",
      });
      continue;
    }
    const banned = baseWithoutExtension(filename)
      .split("-")
      .find((part) => (BANNED_NAME_PARTS as readonly string[]).includes(part));
    if (banned !== undefined) {
      bad.push({ path: assetPath, reason: `contains banned word "${banned}"` });
    }
  }
  return bad;
}
