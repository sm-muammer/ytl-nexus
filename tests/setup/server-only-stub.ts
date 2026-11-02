// Vitest runs outside the Next.js server bundle, where the real "server-only"
// package throws on import. Importing it is the guard under test in the build;
// in unit tests it must be a no-op.
export {};
