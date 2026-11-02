#!/usr/bin/env bash
# Shared functions for deploy.sh and rollback.sh. Source it; do not run it.
#
# Everything is configurable through environment variables so the tests can
# drive the real scripts in a temporary directory with stub commands. The
# defaults are the production values on Nexus Core 01.
#
# Written for bash 3.2 and later (the tests run on macOS).

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NEXUS_ROOT="${NEXUS_ROOT:-/opt/ytl-nexus}"
NEXUS_RUN_AS="${NEXUS_RUN_AS-nexus}"
NEXUS_VERIFY_CMD="${NEXUS_VERIFY_CMD:-$HERE/verify-target --local}"
NEXUS_RESTART_CMD="${NEXUS_RESTART_CMD:-systemctl restart nexus-web}"
NEXUS_HEALTH_CMD="${NEXUS_HEALTH_CMD:-curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3000/api/health/ready}"
NEXUS_HEALTH_TIMEOUT="${NEXUS_HEALTH_TIMEOUT:-60}"
NEXUS_HEALTH_INTERVAL="${NEXUS_HEALTH_INTERVAL:-2}"
export NEXUS_ROOT

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

# Runs a shell command string in the current directory, as the service user
# when NEXUS_RUN_AS is set (build and migrations never run as root).
as_service_user() {
  if [ -n "$NEXUS_RUN_AS" ]; then
    runuser -u "$NEXUS_RUN_AS" -- bash -c "$1"
  else
    bash -c "$1"
  fi
}

# Points the symlink $2 at $1 in one step, so there is no moment without a link.
swap_link() {
  local target="$1" link="$2" tmp="$2.new.$$"
  ln -sfn "$target" "$tmp"
  # GNU mv needs -T so it replaces the link instead of moving into its target;
  # BSD mv (macOS) uses -h.
  if ! mv -T "$tmp" "$link" 2>/dev/null; then
    mv -fh "$tmp" "$link"
  fi
}

link_target() { [ -L "$1" ] && readlink "$1" || true; }

# Waits until the health command succeeds or the timeout passes.
wait_healthy() {
  local waited=0
  while :; do
    if bash -c "$NEXUS_HEALTH_CMD" >/dev/null 2>&1; then
      return 0
    fi
    # Compare as integers of tenths of a second so decimals work on every shell.
    waited=$(awk -v w="$waited" -v i="$NEXUS_HEALTH_INTERVAL" 'BEGIN { print w + i }')
    if awk -v w="$waited" -v t="$NEXUS_HEALTH_TIMEOUT" 'BEGIN { exit !(w >= t) }'; then
      return 1
    fi
    sleep "$NEXUS_HEALTH_INTERVAL"
  done
}

restart_service() {
  bash -c "$NEXUS_RESTART_CMD"
}

acquire_lock() {
  mkdir -p "$NEXUS_ROOT"
  if ! mkdir "$NEXUS_ROOT/deploy.lock" 2>/dev/null; then
    die "another deploy or rollback is already running (lock: $NEXUS_ROOT/deploy.lock)"
  fi
  trap 'rmdir "$NEXUS_ROOT/deploy.lock" 2>/dev/null || true' EXIT
}

verify_target() {
  bash -c "$NEXUS_VERIFY_CMD" || die "verify-target failed; no changes were made"
}
