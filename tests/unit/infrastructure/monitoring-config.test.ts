import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QUERIES } from "@/lib/monitoring/queries";
import { TRACKED_SERVICES } from "@/lib/monitoring/services";

// The monitoring files must agree with the code that reads them. These tests
// catch a renamed unit, a port opened beyond loopback, or a lost retention
// setting before the script runs on the server.

const root = path.resolve(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("monitoring configuration (CMD-01)", () => {
  const unit = read("infrastructure/systemd/prometheus.service");
  const config = read("infrastructure/prometheus/prometheus.yml");
  const script = read("infrastructure/scripts/setup-monitoring");

  it("binds Prometheus to loopback with 15 days of retention", () => {
    expect(unit).toContain("--web.listen-address=127.0.0.1:9090");
    expect(unit).toContain("--storage.tsdb.retention.time=15d");
    expect(unit).not.toMatch(/0\.0\.0\.0|--web\.listen-address=:/);
  });

  it("runs Prometheus as its own user, sandboxed, with one writable path", () => {
    expect(unit).toMatch(/^User=prometheus$/m);
    expect(unit).toMatch(/^NoNewPrivileges=yes$/m);
    expect(unit).toMatch(/^ProtectSystem=strict$/m);
    expect(unit).toMatch(/^ReadWritePaths=\/var\/lib\/prometheus$/m);
  });

  it("scrapes only loopback targets, and keeps the job name the queries use", () => {
    const targets = [...config.matchAll(/targets:\s*\["([^"]+)"\]/g)].map(
      (m) => m[1],
    );
    // Prometheus itself, node_exporter and SFTPGo's telemetry listener (Task 12).
    expect(targets).toEqual([
      "127.0.0.1:9090",
      "127.0.0.1:9100",
      "127.0.0.1:10000",
    ]);
    // TRF-11 / requirement 12.20: SFTPGo is scraped every 60 seconds.
    expect(config).toMatch(
      /job_name: sftpgo\s+scrape_interval: 60s\s+static_configs:/,
    );
    expect(config).toContain("job_name: node");
    expect(QUERIES.node_up).toContain('job="node"');
  });

  it("asks node_exporter for exactly the units the app tracks", () => {
    const listed = script
      .match(/^TRACKED_UNITS="([^"]+)"/m)?.[1]
      ?.split(" ")
      .map((u) => `${u}.service`);
    expect(listed).toEqual(TRACKED_SERVICES.map((s) => s.unit));
  });

  it("keeps characters systemd would expand out of the node_exporter flag", () => {
    const lines = script.split("\n");
    const regexLine = lines.find((l) => l.startsWith('regex="')) ?? "";
    // Only what is added to the unit, not the grep patterns that test for it.
    const addLines = lines
      .filter((l) => l.includes("|| add="))
      .map((l) => l.slice(l.indexOf("|| add=")))
      .join("\n");
    expect(regexLine).toContain("[.]service");
    expect(addLines).toContain("--collector.systemd");
    for (const line of [regexLine, addLines]) {
      expect(line).not.toMatch(/\$'|\\\./);
    }
  });

  it("verifies the download checksum and loopback listeners before it finishes", () => {
    expect(script).toContain("sha256sum");
    expect(script).toContain("checksum mismatch");
    expect(script).toContain("loopback only");
    expect(script).toContain('verify-target" --local');
  });

  it("is shipped to the server by server-run", () => {
    const run = read("infrastructure/scripts/server-run");
    expect(run).toContain("prometheus.service");
    expect(run).toContain("prometheus/prometheus.yml");
  });
});
