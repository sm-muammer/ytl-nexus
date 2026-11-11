import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  USERNAME_PATTERN,
  addKeyInput,
  createAccountInput,
  quotaMbSchema,
  usernameSchema,
} from "@/lib/transfer/validation";
import { MAX_KEYS, parsePublicKey } from "@/lib/transfer/keys";
import { ownAccount } from "@/lib/transfer/ownership";
import { buildGuides, SFTP_PORT } from "@/lib/transfer/guides";
import { formatBytes, usagePercent } from "@/lib/transfer/format";
import type { TransferAccount } from "@/lib/transfer/types";

// Nexus Transfer, pure parts: input rules, SSH public keys, ownership (Property
// 4), connection guides and size formatting. No network, no SFTPGo.

/** A real OpenSSH public key line for a freshly generated Ed25519 key. */
function ed25519Line(comment = "laptop"): { line: string; blob: Buffer } {
  const { publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const raw = der.subarray(der.length - 32);
  const name = Buffer.from("ssh-ed25519");
  const blob = Buffer.concat([
    Buffer.from([0, 0, 0, name.length]),
    name,
    Buffer.from([0, 0, 0, 32]),
    raw,
  ]);
  return { line: `ssh-ed25519 ${blob.toString("base64")} ${comment}`, blob };
}

function rsaLine(bits: number): string {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: bits });
  const jwk = publicKey.export({ format: "jwk" });
  const mpint = (b64url: string) => {
    let bytes = Buffer.from(b64url, "base64url");
    if (bytes[0]! & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(bytes.length);
    return Buffer.concat([len, bytes]);
  };
  const name = Buffer.from("ssh-rsa");
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32BE(name.length);
  const blob = Buffer.concat([nameLen, name, mpint(jwk.e!), mpint(jwk.n!)]);
  return `ssh-rsa ${blob.toString("base64")} rsa-test`;
}

describe("usernames", () => {
  it("accept plain lowercase names", () => {
    for (const name of ["amira", "amira-h", "team_ops2", "abc"]) {
      expect(usernameSchema.safeParse(name).success, name).toBe(true);
    }
  });

  it("refuse anything that could name a path, a command or a privileged account", () => {
    const bad = [
      "",
      "ab",
      "Amira",
      "9lives",
      "../etc",
      "a/b",
      "a b",
      "a;rm",
      "a\nb",
      "a\u0000b",
      ".hidden",
      "x".repeat(33),
      "root",
      "admin",
      "sftpgo",
      "nexus-admin",
      "nexus-api",
    ];
    for (const name of bad) {
      expect(usernameSchema.safeParse(name).success, JSON.stringify(name)).toBe(
        false,
      );
    }
    expect(USERNAME_PATTERN.test("a..b")).toBe(false);
  });
});

describe("quota", () => {
  it("is a whole number of megabytes between 10 MB and 20 GB", () => {
    expect(quotaMbSchema.parse("500")).toBe(500);
    expect(quotaMbSchema.parse(10)).toBe(10);
    expect(quotaMbSchema.parse(20480)).toBe(20480);
    for (const bad of [0, 9, 20481, -5, 1.5, "abc", "", null, NaN]) {
      expect(quotaMbSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });
});

describe("SSH public keys", () => {
  it("parse an Ed25519 key and compute the OpenSSH SHA256 fingerprint", () => {
    const { line, blob } = ed25519Line("amira@laptop");
    const parsed = parsePublicKey(line);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("ssh-ed25519");
    expect(parsed?.comment).toBe("amira@laptop");
    const expected = createHash("sha256")
      .update(blob)
      .digest("base64")
      .replace(/=+$/, "");
    expect(parsed?.fingerprint).toBe(`SHA256:${expected}`);
    expect(parsed?.normalized).toBe(line);
  });

  it("accept an RSA key of 2048 bits and refuse a shorter one", () => {
    expect(parsePublicKey(rsaLine(2048))?.type).toBe("ssh-rsa");
    expect(parsePublicKey(rsaLine(1024))).toBeNull();
  });

  it("refuse private keys, options, several lines, wrong types and corrupt data", () => {
    const { line } = ed25519Line();
    const b64 = line.split(" ")[1]!;
    const bad = [
      "",
      "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----",
      `command="rm -rf /" ${line}`,
      `${line}\n${line}`,
      `ssh-rsa ${b64}`, // type does not match the data inside
      "ssh-ed25519 !!!notbase64!!!",
      "ssh-dss AAAAB3NzaC1kc3MAAACB",
      "ssh-ed25519",
      `ssh-ed25519 ${b64.slice(0, 20)}`,
      `${line} ${"x".repeat(9000)}`,
    ];
    for (const text of bad) {
      expect(
        parsePublicKey(text),
        JSON.stringify(text.slice(0, 40)),
      ).toBeNull();
    }
  });

  it("strip control characters from the comment and cap its length", () => {
    const { line } = ed25519Line("a");
    const [type, data] = line.split(" ");
    const parsed = parsePublicKey(`${type} ${data} ${"c".repeat(300)}`);
    expect(parsed?.comment.length).toBeLessThanOrEqual(100);
  });

  it("allow at most 10 keys per account", () => {
    expect(MAX_KEYS).toBe(10);
  });

  it("validate the add-key input", () => {
    const { line } = ed25519Line();
    expect(
      addKeyInput.safeParse({ username: "amira", publicKey: line }).success,
    ).toBe(true);
    expect(
      addKeyInput.safeParse({ username: "amira", publicKey: "nope" }).success,
    ).toBe(false);
  });
});

describe("create-account input", () => {
  it("needs a Nexus user id, a username and a quota", () => {
    const ok = createAccountInput.safeParse({
      userId: "u1abc",
      username: "amira",
      quotaMb: "1024",
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.quotaMb).toBe(1024);
    for (const bad of [
      { userId: "", username: "amira", quotaMb: 100 },
      { userId: "u/1", username: "amira", quotaMb: 100 },
      { userId: "u1", username: "../x", quotaMb: 100 },
      { userId: "u1", username: "amira", quotaMb: 0 },
    ]) {
      expect(createAccountInput.safeParse(bad).success).toBe(false);
    }
  });
});

const account = (over: Partial<TransferAccount>): TransferAccount => ({
  username: "amira",
  enabled: true,
  nexusUserId: "user-1",
  quotaBytes: 1000,
  usedBytes: 100,
  usedFiles: 2,
  keys: [],
  lastLoginAt: null,
  createdAt: null,
  ...over,
});

describe("ownership (Property 4: resource ownership prevents IDOR)", () => {
  const accounts = [
    account({ username: "amira", nexusUserId: "user-1" }),
    account({ username: "bilal", nexusUserId: "user-2" }),
    account({ username: "stray", nexusUserId: null }),
  ];

  it("returns only the account linked to the signed-in user", () => {
    expect(ownAccount(accounts, "user-1")?.username).toBe("amira");
    expect(ownAccount(accounts, "user-2")?.username).toBe("bilal");
  });

  it("returns nothing for a user with no account, an unlinked account or a lookalike id", () => {
    expect(ownAccount(accounts, "user-3")).toBeNull();
    expect(ownAccount(accounts, "")).toBeNull();
    expect(ownAccount(accounts, "user-")).toBeNull();
    expect(ownAccount(accounts, "USER-1")).toBeNull();
    expect(ownAccount(accounts, "null")).toBeNull();
  });

  it("never lets one id match two accounts: ambiguity gives no account", () => {
    const dup = [
      account({ username: "one", nexusUserId: "user-1" }),
      account({ username: "two", nexusUserId: "user-1" }),
    ];
    expect(ownAccount(dup, "user-1")).toBeNull();
  });
});

describe("connection guides", () => {
  const guides = buildGuides({
    host: "ytl-nexus.ytlcomms.my",
    username: "amira",
  });

  it("cover WinSCP, FileZilla, Cyberduck and the terminal", () => {
    expect(guides.map((g) => g.id)).toEqual([
      "winscp",
      "filezilla",
      "cyberduck",
      "terminal",
    ]);
  });

  it("use port 2022 and the SFTP protocol everywhere", () => {
    expect(SFTP_PORT).toBe(2022);
    for (const g of guides) {
      const text = g.steps.join(" ");
      expect(text, g.id).toContain("2022");
      expect(text, g.id).toContain("ytl-nexus.ytlcomms.my");
      expect(text, g.id).toContain("amira");
      expect(text.toLowerCase(), g.id).not.toContain("ftp over tls");
    }
  });

  it("give the exact terminal command", () => {
    const terminal = guides.find((g) => g.id === "terminal");
    expect(terminal?.command).toBe("sftp -P 2022 amira@ytl-nexus.ytlcomms.my");
    expect(terminal?.keyCommand).toBe(
      "sftp -P 2022 -i ~/.ssh/id_ed25519 amira@ytl-nexus.ytlcomms.my",
    );
  });

  it("do not put a hostile username or host into a command unquoted", () => {
    const bad = buildGuides({ host: "h", username: "a b;rm" });
    expect(bad.find((g) => g.id === "terminal")?.command).toBe(
      "sftp -P 2022 'a b;rm@h'",
    );
  });
});

describe("sizes", () => {
  it("format bytes with binary units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

  it("compute usage as a percent between 0 and 100, and unlimited as null", () => {
    expect(usagePercent(50, 200)).toBe(25);
    expect(usagePercent(500, 200)).toBe(100);
    expect(usagePercent(-1, 200)).toBe(0);
    expect(usagePercent(10, 0)).toBeNull();
  });
});
