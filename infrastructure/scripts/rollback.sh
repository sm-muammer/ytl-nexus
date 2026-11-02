#!/usr/bin/env bash
# rollback.sh   (requirement 4.25, manual rollback)
#
# Runs on Nexus Core 01 as root. Switches `current` back to the `previous`
# release, restarts nexus-web and waits for the health check. `current` and
# `previous` trade places, so running it twice returns to where you started.
#
# Database migrations are not reversed here; see docs/operations/rollback.md.

set -Eeuo pipefail
# shellcheck source=release-lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-lib.sh"

verify_target
acquire_lock

CURRENT="$NEXUS_ROOT/current"
PREVIOUS="$NEXUS_ROOT/previous"
TARGET="$(link_target "$PREVIOUS")"
FROM="$(link_target "$CURRENT")"

[ -n "$TARGET" ] || die "there is no previous release to roll back to"
[ -d "$TARGET" ] || die "the previous release $TARGET no longer exists"

log "rolling back from $(basename "${FROM:-none}") to $(basename "$TARGET")"
swap_link "$TARGET" "$CURRENT"
if [ -n "$FROM" ]; then swap_link "$FROM" "$PREVIOUS"; fi
restart_service

if wait_healthy; then
  log "rolled back to $(basename "$TARGET"); health check passed"
  exit 0
fi
die "rolled back to $(basename "$TARGET") but its health check failed; investigate with: journalctl -u nexus-web"
