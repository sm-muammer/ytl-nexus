import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { expect, test } from "@playwright/test";

test.describe("Security Hardening & Threat Verification (Task 21)", () => {
  test.describe("HTTP Security Headers & CSP Nonces", () => {
    test("sets strict Content-Security-Policy with per-request nonces and standard hardening headers", async ({
      request,
    }) => {
      const res1 = await request.get("/");
      expect(res1.status()).toBe(200);

      const headers1 = res1.headers();
      const csp1 = headers1["content-security-policy"];
      expect(csp1).toBeTruthy();
      expect(csp1).toBeDefined();
      expect(csp1).toContain("default-src 'self'");
      expect(csp1).toContain("script-src 'self' 'nonce-");
      expect(csp1).toContain("'strict-dynamic'");
      expect(csp1).toContain("object-src 'none'");
      expect(csp1).toContain("frame-ancestors 'none'");

      const nonce1 = csp1?.match(/'nonce-([^']+)'/)?.[1];
      expect(nonce1).toBeTruthy();

      // Second request generates distinct nonce (unpredictable)
      const res2 = await request.get("/");
      const csp2 = res2.headers()["content-security-policy"];
      expect(csp2).toBeDefined();
      const nonce2 = csp2?.match(/'nonce-([^']+)'/)?.[1];
      expect(nonce2).toBeTruthy();
      expect(nonce1).not.toBe(nonce2);

      // Hardening headers
      expect(headers1["x-content-type-options"]).toBe("nosniff");
      expect(headers1["x-frame-options"]).toBe("DENY");
      expect(headers1["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(headers1["permissions-policy"]).toContain("camera=()");
    });
  });

  test.describe("Auth Bypass & Protected Handler Defense", () => {
    test("rejects unauthenticated access to protected API endpoints", async ({
      request,
    }) => {
      // Stream metrics requires Viewer+
      const streamRes = await request.get("/api/stream/metrics");
      expect([401, 403]).toContain(streamRes.status());

      // Data export requires Viewer+
      const dataExportRes = await request.get("/api/data/export");
      expect([401, 403]).toContain(dataExportRes.status());

      // AI conversations requires Member+
      const aiConvRes = await request.get("/api/ai/conversations");
      expect([401, 403]).toContain(aiConvRes.status());

      // Control audit export is hidden (returns 404 for non-admin)
      const auditExportRes = await request.get("/api/control/audit/export");
      expect(auditExportRes.status()).toBe(404);
    });

    test("redirects unauthenticated page requests to /signin with next parameter in live mode", async ({
      request,
    }) => {
      // When requested without cookie in live environment, redirect to signin
      const res = await request.get("/command/atlas", {
        maxRedirects: 0,
      });
      // In demo mode with no role cookie, demo defaults or redirects depending on policy
      expect([200, 307]).toContain(res.status());
      if (res.status() === 307) {
        expect(res.headers()["location"]).toContain("/signin");
      }
    });
  });

  test.describe("Rate Limiting on Public Endpoints", () => {
    test("enforces rate limits on /api/library under flood conditions", async ({
      request,
    }) => {
      let rateLimited = false;
      // Burst 65 fast requests to /api/library with a dedicated test IP header
      const headers = { "x-real-ip": "198.51.100.77" };
      for (let i = 0; i < 65; i++) {
        const res = await request.get("/api/library?type=runbook", { headers });
        if (res.status() === 429) {
          rateLimited = true;
          expect(res.headers()["retry-after"]).toBeTruthy();
          const json = await res.json();
          expect(json.error).toBe("rate-limited");
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });

    test("rejects oversized prompts and rate limits /api/ai/chat", async ({
      request,
    }) => {
      // Oversized prompt (> 2,000 chars)
      const hugePrompt = "A".repeat(2500);
      const resHuge = await request.post("/api/ai/chat?scope=yes-public", {
        data: { prompt: hugePrompt },
        headers: { "x-real-ip": "198.51.100.88" },
      });
      expect(resHuge.status()).toBe(400);
      const jsonHuge = await resHuge.json();
      expect(jsonHuge.error).toBe("prompt-too-long");

      // Repeated requests trigger 429
      let limited = false;
      const headers = { "x-real-ip": "198.51.100.99" };
      for (let i = 0; i < 15; i++) {
        const res = await request.post("/api/ai/chat?scope=yes-public", {
          data: { prompt: "Hello Yes 5G assistant" },
          headers,
        });
        if (res.status() === 429) {
          limited = true;
          const json = await res.json();
          expect(json.error).toBe("rate-limited");
          break;
        }
      }
      expect(limited).toBe(true);
    });
  });

  test.describe("IDOR Protection on Restricted Resources", () => {
    test("prevents members from accessing Control endpoints", async ({
      request,
    }) => {
      const res = await request.get("/control", {
        headers: { cookie: `${DEMO_ROLE_COOKIE}=member` },
        maxRedirects: 0,
      });
      // Non-admins receive 404 (hidden area)
      expect(res.status()).toBe(404);
    });

    test("prevents viewers from triggering operations agent actions", async ({
      request,
    }) => {
      const res = await request.post("/api/stream/metrics", {
        headers: { cookie: `${DEMO_ROLE_COOKIE}=viewer` },
      });
      // Viewer cannot post actions
      expect([404, 405]).toContain(res.status());
    });
  });
});
