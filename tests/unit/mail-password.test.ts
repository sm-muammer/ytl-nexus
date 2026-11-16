// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  hashMailPassword,
  newSalt,
  sha512Crypt,
  verifySha512Crypt,
} from "@/lib/mail/sha512-crypt";

// MAIL-02: SHA512-CRYPT must match glibc's crypt(3) byte for byte, because
// Dovecot verifies the stored hash with it. The vectors come from the
// specification (Drepper, "Unix crypt using SHA-256 and SHA-512").

describe("sha512Crypt: the specification's test vectors", () => {
  it.each([
    [
      "Hello world!",
      "$6$saltstring",
      "$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1",
    ],
    [
      "Hello world!",
      "$6$rounds=10000$saltstringsaltstring",
      "$6$rounds=10000$saltstringsaltst$OW1/O6BYHV6BcXZu8QVeXbDWra3Oeqh0sbHbbMCVNSnCM/UrjmM0Dp8vOuZeHBy/YTBmSK6H9qs/y3RnOaw5v.",
    ],
    [
      "This is just a test",
      "$6$rounds=5000$toolongsaltstring",
      "$6$rounds=5000$toolongsaltstrin$lQ8jolhgVRVhY4b5pZKaysCLi0QBxGoNeKQzQ3glMhwllF7oGDZxUhx1yxdYcz/e1JSbq3y6JMxxl8audkUEm0",
    ],
    [
      "a very much longer text to encrypt.  This one even stretches over morethan one line.",
      "$6$rounds=1400$anotherlongsaltstring",
      "$6$rounds=1400$anotherlongsalts$POfYwTEok97VWcjxIiSOjiykti.o/pQs.wPvMxQ6Fm7I6IoYN3CmLs66x9t0oSwbtEW7o7UmJEiDwGqd8p4ur1",
    ],
    [
      "we have a short salt string but not a short password",
      "$6$rounds=77777$short",
      "$6$rounds=77777$short$WuQyW2YR.hBNpjjRhpYD/ifIw05xdfeEyQoMxIXbkvr0gge1a1x3yRULJ5CCaUeOxFmtlcGZelFl5CxtgfiAc0",
    ],
  ])("hashes %j with %s", (password, setting, expected) => {
    expect(sha512Crypt(password, setting)).toBe(expected);
  });
});

describe("hashMailPassword and verifySha512Crypt", () => {
  it("stores the scheme prefix, a 16 character salt and the default rounds", () => {
    const stored = hashMailPassword("correct horse battery staple");
    expect(stored).toMatch(
      /^\{SHA512-CRYPT\}\$6\$[./0-9A-Za-z]{16}\$[./0-9A-Za-z]{86}$/,
    );
    expect(stored).not.toContain("rounds=");
  });

  it("uses a different salt every time", () => {
    const a = hashMailPassword("same password");
    const b = hashMailPassword("same password");
    expect(a).not.toBe(b);
    expect(newSalt()).toHaveLength(16);
  });

  it("verifies the right password and refuses the wrong one", () => {
    const stored = hashMailPassword("s3cret-Pass");
    expect(verifySha512Crypt("s3cret-Pass", stored)).toBe(true);
    expect(verifySha512Crypt("s3cret-pass", stored)).toBe(false);
    expect(verifySha512Crypt("", stored)).toBe(false);
  });

  it("accepts a bare $6$ hash and refuses other schemes and junk", () => {
    const bare = sha512Crypt("pw", "$6$saltstring");
    expect(verifySha512Crypt("pw", bare)).toBe(true);
    expect(verifySha512Crypt("pw", "{SSHA512}abcdef")).toBe(false);
    expect(verifySha512Crypt("pw", "plain")).toBe(false);
    expect(() => sha512Crypt("pw", "$5$nope")).toThrow();
  });

  it("handles non-ASCII passwords as UTF-8", () => {
    const stored = hashMailPassword("pässwörd-密码");
    expect(verifySha512Crypt("pässwörd-密码", stored)).toBe(true);
    expect(verifySha512Crypt("passwörd-密码", stored)).toBe(false);
  });
});
