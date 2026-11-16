// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isImapGreeting, parseEhlo } from "@/lib/server/mail-probe";
import { judgeProbe } from "@/lib/server/mail";

describe("isImapGreeting", () => {
  it("accepts valid IMAP greeting banners", () => {
    expect(isImapGreeting("* OK [CAPABILITY IMAP4rev1] Dovecot ready.")).toBe(
      true,
    );
    expect(isImapGreeting("* OK Dovecot ready.\r\n")).toBe(true);
  });

  it("refuses error lines or non-OK banners", () => {
    expect(isImapGreeting("* BYE Server shutting down.")).toBe(false);
    expect(isImapGreeting("* PREAUTH Logged in.")).toBe(false);
    expect(isImapGreeting("-ERR Cannot connect")).toBe(false);
    expect(isImapGreeting("")).toBe(false);
  });
});

describe("parseEhlo", () => {
  it("identifies STARTTLS support and absence of plaintext AUTH", () => {
    const reply =
      "250-sn1lyvx1d0002.ytlcomms.my\r\n" +
      "250-PIPELINING\r\n" +
      "250-SIZE 10240000\r\n" +
      "250-STARTTLS\r\n" +
      "250-ENHANCEDSTATUSCODES\r\n" +
      "250 8BITMIME\r\n";
    const parsed = parseEhlo(reply);
    expect(parsed.complete).toBe(true);
    expect(parsed.startTls).toBe(true);
    expect(parsed.authBeforeTls).toBe(false);
  });

  it("detects insecure AUTH offered before STARTTLS", () => {
    const reply =
      "250-sn1lyvx1d0002.ytlcomms.my\r\n" +
      "250-STARTTLS\r\n" +
      "250-AUTH PLAIN LOGIN\r\n" +
      "250 8BITMIME\r\n";
    const parsed = parseEhlo(reply);
    expect(parsed.complete).toBe(true);
    expect(parsed.startTls).toBe(true);
    expect(parsed.authBeforeTls).toBe(true);
  });

  it("marks incomplete multi-line reply as not complete", () => {
    const reply = "250-sn1lyvx1d0002.ytlcomms.my\r\n250-STARTTLS\r\n";
    const parsed = parseEhlo(reply);
    expect(parsed.complete).toBe(false);
  });
});

describe("judgeProbe", () => {
  it("reports healthy when both IMAP and Submission answer", () => {
    const result = judgeProbe({ imap: true, submission: true });
    expect(result.state).toBe("ok");
    expect(result.label).toBe("Healthy");
  });

  it("reports unreachable when neither answers", () => {
    const result = judgeProbe({ imap: false, submission: false });
    expect(result.state).toBe("bad");
    expect(result.label).toBe("Unreachable");
  });

  it("reports degraded when only one answers", () => {
    const r1 = judgeProbe({ imap: true, submission: false });
    expect(r1.state).toBe("warn");
    expect(r1.label).toBe("Degraded");

    const r2 = judgeProbe({ imap: false, submission: true });
    expect(r2.state).toBe("warn");
    expect(r2.label).toBe("Degraded");
  });
});
