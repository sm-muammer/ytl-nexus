// Fake secrets for tests, built at run time so a secret scanner has no literal
// to flag. The values are neither random nor used anywhere.
export function fakeSecret(label: string, length = 48): string {
  return `${label}-`.padEnd(length, "x");
}
