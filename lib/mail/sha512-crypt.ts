import { createHash, randomInt, timingSafeEqual } from "node:crypto";

// SHA512-CRYPT ("$6$"), Ulrich Drepper's specification "Unix crypt using
// SHA-256 and SHA-512" (https://www.akkadia.org/drepper/SHA-crypt.txt).
//
// MAIL-02: Dovecot would use ARGON2ID when `doveadm pw -l` lists it. On Nexus
// Core 01 (Rocky Linux 9, Dovecot 2.3.16) it does not, so the hashes are
// SHA512-CRYPT. Dovecot verifies them with the system crypt(3), so the format
// here must match glibc exactly; tests check the specification's vectors and
// `scripts/mail` / `verify-mail` check the output with `doveadm pw -t`.
//
// Pure Node, no dependency. Server-side only: nothing in the browser bundle
// imports this file.

const ITOA64 =
  "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_ROUNDS = 5000;
const MIN_ROUNDS = 1000;
const MAX_ROUNDS = 999_999_999;
const MAX_SALT = 16;

const sha512 = (...parts: Buffer[]): Buffer => {
  const hash = createHash("sha512");
  for (const part of parts) hash.update(part);
  return hash.digest();
};

/** The digest repeated or cut to exactly `length` bytes. */
function repeatTo(digest: Buffer, length: number): Buffer {
  const out = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) out[i] = digest[i % digest.length]!;
  return out;
}

function encode24(b2: number, b1: number, b0: number, count: number): string {
  let word = (b2 << 16) | (b1 << 8) | b0;
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += ITOA64[word & 0x3f];
    word >>>= 6;
  }
  return out;
}

// The byte order of the final encoding, from the specification (21 groups of 3).
const GROUPS: readonly (readonly [number, number, number])[] = [
  [0, 21, 42],
  [22, 43, 1],
  [44, 2, 23],
  [3, 24, 45],
  [25, 46, 4],
  [47, 5, 26],
  [6, 27, 48],
  [28, 49, 7],
  [50, 8, 29],
  [9, 30, 51],
  [31, 52, 10],
  [53, 11, 32],
  [12, 33, 54],
  [34, 55, 13],
  [56, 14, 35],
  [15, 36, 57],
  [37, 58, 16],
  [59, 17, 38],
  [18, 39, 60],
  [40, 61, 19],
  [62, 20, 41],
];

/** The core function: the digest part of a `$6$` hash (86 characters). */
function digest(password: Buffer, salt: Buffer, rounds: number): string {
  const b = sha512(password, salt, password);

  // Digest A.
  const aParts: Buffer[] = [password, salt];
  for (let n = password.length; n > 0; n -= 64) {
    aParts.push(b.subarray(0, Math.min(64, n)));
  }
  for (let n = password.length; n > 0; n >>= 1) {
    aParts.push(n & 1 ? b : password);
  }
  let a = sha512(...aParts);

  // Sequence P: the password repeated, from digest DP.
  const dp = sha512(...Array.from({ length: password.length }, () => password));
  const p = repeatTo(dp, password.length);

  // Sequence S: the salt repeated, from digest DS.
  const ds = sha512(...Array.from({ length: 16 + a[0]! }, () => salt));
  const s = repeatTo(ds, salt.length);

  for (let i = 0; i < rounds; i += 1) {
    const parts: Buffer[] = [i & 1 ? p : a];
    if (i % 3 !== 0) parts.push(s);
    if (i % 7 !== 0) parts.push(p);
    parts.push(i & 1 ? a : p);
    a = sha512(...parts);
  }

  let out = "";
  for (const [x, y, z] of GROUPS) out += encode24(a[x]!, a[y]!, a[z]!, 4);
  out += encode24(0, 0, a[63]!, 2);
  return out;
}

/** 16 random characters from the crypt alphabet. */
export function newSalt(): string {
  let salt = "";
  for (let i = 0; i < MAX_SALT; i += 1) salt += ITOA64[randomInt(64)];
  return salt;
}

type Parsed = { rounds: number; explicitRounds: boolean; salt: string };

/** Reads `$6$[rounds=N$]salt` (a full hash may follow). Null when it is not a `$6$` string. */
function parse(setting: string): Parsed | null {
  if (!setting.startsWith("$6$")) return null;
  let rest = setting.slice(3);
  let rounds = DEFAULT_ROUNDS;
  let explicitRounds = false;
  const match = /^rounds=(\d{1,9})\$/.exec(rest);
  if (match) {
    rounds = Math.min(
      MAX_ROUNDS,
      Math.max(MIN_ROUNDS, Number.parseInt(match[1]!, 10)),
    );
    explicitRounds = true;
    rest = rest.slice(match[0].length);
  }
  const end = rest.indexOf("$");
  const salt = (end === -1 ? rest : rest.slice(0, end)).slice(0, MAX_SALT);
  return { rounds, explicitRounds, salt };
}

/**
 * `$6$salt$hash` for a password. `setting` is a `$6$...` prefix (as in glibc's
 * crypt) and is used only by tests and `verifySha512Crypt`; callers that hash a
 * new password pass nothing and get a fresh random salt.
 */
export function sha512Crypt(password: string, setting?: string): string {
  const parsed = setting ? parse(setting) : null;
  if (setting && !parsed) throw new Error("Not a SHA512-CRYPT setting.");
  const { rounds, explicitRounds, salt } = parsed ?? {
    rounds: DEFAULT_ROUNDS,
    explicitRounds: false,
    salt: newSalt(),
  };
  const hash = digest(
    Buffer.from(password, "utf8"),
    Buffer.from(salt, "utf8"),
    rounds,
  );
  const prefix = explicitRounds ? `$6$rounds=${rounds}$` : "$6$";
  return `${prefix}${salt}$${hash}`;
}

/** The value stored in `virtual_users.password`: scheme prefix plus hash. */
export function hashMailPassword(password: string): string {
  return `{SHA512-CRYPT}${sha512Crypt(password)}`;
}

/** Constant-time check of a password against `$6$...` or `{SHA512-CRYPT}$6$...`. */
export function verifySha512Crypt(password: string, stored: string): boolean {
  const hash = stored.replace(/^\{SHA512-CRYPT\}/i, "");
  if (!parse(hash)) return false;
  const expected = Buffer.from(hash, "utf8");
  const actual = Buffer.from(sha512Crypt(password, hash), "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
