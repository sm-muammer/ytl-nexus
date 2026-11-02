// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const scripts = path.resolve(
  import.meta.dirname,
  "../../../infrastructure/scripts",
);

let sandbox: string; // everything lives here, nothing outside it is touched
let root: string; // plays the role of /opt/ytl-nexus
let work: string; // a working clone the test commits in
let bare: string; // plays the role of /opt/ytl-nexus/repo.git

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.test",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.test",
    },
  }).trim();
}

/** Commits a release. `healthy` decides whether the stub health check passes. */
function commit(label: string, healthy: boolean): string {
  fs.writeFileSync(path.join(work, "label"), label);
  const flag = path.join(work, "healthy");
  if (healthy) fs.writeFileSync(flag, "yes");
  else fs.rmSync(flag, { force: true });
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", label);
  git(work, "push", "-q", "origin", "HEAD:refs/heads/main");
  const sha = git(work, "rev-parse", "HEAD");
  git(work, "tag", label);
  git(work, "push", "-q", "origin", label);
  return sha;
}

function env(overrides: Record<string, string> = {}) {
  return {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test" as const,
    NEXUS_ROOT: root,
    NEXUS_REPO: bare,
    NEXUS_RUN_AS: "",
    NEXUS_VERIFY_CMD: "true",
    NEXUS_BUILD_CMD: '[ ! -e "$NEXUS_ROOT/fail-build" ]',
    NEXUS_MIGRATE_CMD: '[ ! -e "$NEXUS_ROOT/fail-migrate" ]',
    NEXUS_GRANTS_CMD: '[ ! -e "$NEXUS_ROOT/fail-grants" ]',
    NEXUS_RESTART_CMD:
      'readlink "$NEXUS_ROOT/current" >> "$NEXUS_ROOT/restarts.log"',
    NEXUS_HEALTH_CMD: '[ -e "$NEXUS_ROOT/current/healthy" ]',
    NEXUS_HEALTH_TIMEOUT: "1",
    NEXUS_HEALTH_INTERVAL: "0.1",
    NEXUS_KEEP_RELEASES: "3",
    ...overrides,
  };
}

function run(script: string, args: string[], overrides = {}) {
  return spawnSync("bash", [path.join(scripts, script), ...args], {
    env: env(overrides),
    encoding: "utf8",
  });
}

const current = () => {
  const link = path.join(root, "current");
  return fs.existsSync(link) ? fs.readlinkSync(link) : null;
};
const release = (sha: string) => path.join(root, "releases", sha);
const restarts = () => {
  const log = path.join(root, "restarts.log");
  return fs.existsSync(log)
    ? fs.readFileSync(log, "utf8").trim().split("\n")
    : [];
};

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-deploy-"));
  root = path.join(sandbox, "opt");
  work = path.join(sandbox, "work");
  bare = path.join(sandbox, "repo.git");
  fs.mkdirSync(root);
  git(sandbox, "init", "-q", "--bare", bare);
  git(sandbox, "init", "-q", work);
  git(work, "remote", "add", "origin", bare);
});

afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

describe("deploy.sh", () => {
  it("creates releases/<sha>, points current at it, restarts and passes the health check", () => {
    const sha = commit("v1", true);
    const result = run("deploy.sh", ["v1"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(release(sha), "label"))).toBe(true);
    expect(current()).toBe(release(sha));
    expect(restarts()).toEqual([release(sha)]);
  });

  it("remembers the previous release on a second deploy", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    const second = commit("v2", true);
    const result = run("deploy.sh", ["v2"]);
    expect(result.status, result.stderr).toBe(0);
    expect(current()).toBe(release(second));
    expect(fs.readlinkSync(path.join(root, "previous"))).toBe(release(first));
  });

  it("leaves current unchanged and exits non-zero when the build fails (4.24)", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    const second = commit("v2", true);
    fs.writeFileSync(path.join(root, "fail-build"), "");
    const result = run("deploy.sh", ["v2"]);
    expect(result.status).not.toBe(0);
    expect(current()).toBe(release(first));
    expect(restarts()).toEqual([release(first)]); // no second restart
    expect(fs.existsSync(release(second))).toBe(false); // half-built release removed
  });

  it("treats a multi-line build command as failed when an early line fails (4.24)", () => {
    // Regression: the real build command is several lines. A failing line in the
    // middle must fail the build even though the last line succeeds.
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    commit("v2", true);
    const result = run("deploy.sh", ["v2"], {
      NEXUS_BUILD_CMD: "false\ntrue",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/build failed/i);
    expect(current()).toBe(release(first));
  });

  it("treats a multi-line migration command as failed when an early line fails (4.24)", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    commit("v2", true);
    const result = run("deploy.sh", ["v2"], {
      NEXUS_MIGRATE_CMD: "false\ntrue",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/migrations failed/i);
    expect(current()).toBe(release(first));
  });

  it("leaves current unchanged and exits non-zero when a migration fails (4.24)", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    commit("v2", true);
    fs.writeFileSync(path.join(root, "fail-migrate"), "");
    const result = run("deploy.sh", ["v2"]);
    expect(result.status).not.toBe(0);
    expect(current()).toBe(release(first));
    expect(restarts()).toEqual([release(first)]);
  });

  it("leaves current unchanged when the database grants step fails", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    commit("v2", true);
    fs.writeFileSync(path.join(root, "fail-grants"), "");
    const result = run("deploy.sh", ["v2"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/grants failed/i);
    expect(current()).toBe(release(first));
    expect(restarts()).toEqual([release(first)]);
  });
  it("applies grants after the migrations and before the switch", () => {
    commit("v1", true);
    const result = run("deploy.sh", ["v1"], {
      NEXUS_GRANTS_CMD: 'echo "grants-ran" >> "$NEXUS_ROOT/order.log"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr + result.stdout).toMatch(
      /running migrations[\s\S]*applying database grants[\s\S]*switching current/,
    );
    expect(fs.readFileSync(path.join(root, "order.log"), "utf8")).toBe(
      "grants-ran\n",
    );
  });
  it("restores the previous release, restarts and exits non-zero when the health check fails (4.25)", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    const second = commit("v2", false);
    const result = run("deploy.sh", ["v2"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/rolled back|restored/i);
    expect(current()).toBe(release(first));
    expect(restarts()).toEqual([
      release(first),
      release(second),
      release(first),
    ]);
  });

  it("with no previous release, a failed health check leaves no current and exits non-zero", () => {
    commit("v1", false);
    const result = run("deploy.sh", ["v1"]);
    expect(result.status).not.toBe(0);
    expect(current()).toBeNull();
  });

  it("stops before touching anything when verify-target fails (4.1, 4.2)", () => {
    commit("v1", true);
    const result = run("deploy.sh", ["v1"], { NEXUS_VERIFY_CMD: "false" });
    expect(result.status).not.toBe(0);
    expect(fs.existsSync(path.join(root, "releases"))).toBe(false);
    expect(current()).toBeNull();
  });

  it("rejects a ref that does not exist", () => {
    commit("v1", true);
    const result = run("deploy.sh", ["no-such-tag"]);
    expect(result.status).not.toBe(0);
    expect(current()).toBeNull();
  });

  it("keeps only the newest releases plus current and previous", () => {
    const shas = ["v1", "v2", "v3", "v4", "v5"].map((tag) => {
      const sha = commit(tag, true);
      expect(run("deploy.sh", [tag], { NEXUS_KEEP_RELEASES: "2" }).status).toBe(
        0,
      );
      return sha;
    });
    const kept = fs.readdirSync(path.join(root, "releases")).sort();
    expect(kept).toEqual([shas[3], shas[4]].sort());
  });

  it("refuses to run two deploys at once", () => {
    commit("v1", true);
    fs.mkdirSync(path.join(root, "deploy.lock"));
    const result = run("deploy.sh", ["v1"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/already running|lock/i);
  });
});

describe("rollback.sh", () => {
  it("switches current back to the previous release and restarts", () => {
    const first = commit("v1", true);
    run("deploy.sh", ["v1"]);
    const second = commit("v2", true);
    run("deploy.sh", ["v2"]);
    const result = run("rollback.sh", []);
    expect(result.status, result.stderr).toBe(0);
    expect(current()).toBe(release(first));
    expect(fs.readlinkSync(path.join(root, "previous"))).toBe(release(second));
  });

  it("exits non-zero when there is no previous release", () => {
    commit("v1", true);
    run("deploy.sh", ["v1"]);
    const result = run("rollback.sh", []);
    expect(result.status).not.toBe(0);
  });

  it("exits non-zero when the rolled-back release is unhealthy", () => {
    commit("v1", true);
    run("deploy.sh", ["v1"]);
    const second = commit("v2", true);
    run("deploy.sh", ["v2"]);
    fs.rmSync(path.join(release(second), "healthy"));
    // Make the target of the rollback (v1) unhealthy.
    const first = fs.readlinkSync(path.join(root, "previous"));
    fs.rmSync(path.join(first, "healthy"));
    const result = run("rollback.sh", []);
    expect(result.status).not.toBe(0);
  });
});
