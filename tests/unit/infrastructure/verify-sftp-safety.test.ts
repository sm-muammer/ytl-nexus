// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../infrastructure/scripts/verify-sftp",
  ),
  "utf8",
);

describe("verify-sftp destructive safety", () => {
  it("removes only the Defender entry for its own test address", () => {
    expect(script).toMatch(/TARGET_DEFENDER_ID=.*HOST.*od -An -tx1/);
    expect(script).toMatch(
      /api DELETE "\/defender\/hosts\/\$TARGET_DEFENDER_ID"/,
    );
    expect(script).not.toMatch(/for id in \$\(api GET \/defender\/hosts/);
    expect(script).toMatch(
      /if \[ "\$defender_test_started" -eq 1 \]; then defender_reset_target; fi/,
    );
  });

  it("refuses to reuse or remove an existing nxtest account", () => {
    expect(script).toMatch(/an account named \$USER_NAME already exists/);
    expect(script).not.toMatch(/verify-sftp test account\*\)\).*api DELETE/);
  });

  it("refuses to overwrite pre-existing test paths", () => {
    expect(script).toMatch(
      /if \[ -e "\$HOME_DIR" \] \|\| \[ -L "\$HOME_DIR" \]; then/,
    );
    expect(script).toMatch(
      /if \[ -e "\$ESCAPE_TEST_PATH" \] \|\| \[ -L "\$ESCAPE_TEST_PATH" \]; then/,
    );
    expect(script).toMatch(/ESCAPE_TEST_PATH=\/tmp\/nx-escape-test-\$\$/);
  });
});
