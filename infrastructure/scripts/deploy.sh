#!/usr/bin/env bash
# deploy.sh <git-ref>   (requirements 4.23 to 4.25)
#
# Runs on Nexus Core 01 as root. Deploys a tag or commit from the bare
# repository at /opt/ytl-nexus/repo.git:
#
#   1. verify-target
#   2. create /opt/ytl-nexus/releases/<git-sha> from `git archive`
#   3. build as the `nexus` user (npm ci && npm run build) and run migrations
#   4. swap the `current` symlink, restart nexus-web, wait for the health check
#
# A failed build or migration leaves `current` untouched and removes the
# half-built release. A failed health check puts `current` back on the previous
# release and restarts it. Both exit non-zero.
#
# Layout:  /opt/ytl-nexus/{repo.git,releases/<sha>,current,previous,releases.log}

set -Eeuo pipefail
# shellcheck source=release-lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-lib.sh"

NEXUS_REPO="${NEXUS_REPO:-$NEXUS_ROOT/repo.git}"
NEXUS_KEEP_RELEASES="${NEXUS_KEEP_RELEASES:-3}"
NEXUS_ENV_DIR="${NEXUS_ENV_DIR:-/etc/ytl-nexus}"
NEXUS_CACHE_DIR="${NEXUS_CACHE_DIR:-/var/cache/ytl-nexus}"

# Production build: the web.env file supplies NEXUS_MODE=live. The standalone
# output needs public/ and .next/static copied in (Next.js output docs), and
# its writable cache is redirected to a directory the service may write.
DEFAULT_BUILD_CMD='
  set -a; . "'"$NEXUS_ENV_DIR"'/web.env"; set +a
  npm ci --no-audit --no-fund
  npm run build
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  rm -rf .next/standalone/.next/cache
  ln -sfn "'"$NEXUS_CACHE_DIR"'/next" .next/standalone/.next/cache
'
# Migrations arrive in Task 5 (`npm run migrate`); until then this is a no-op.
DEFAULT_MIGRATE_CMD='
  if [ -r "'"$NEXUS_ENV_DIR"'/migrate.env" ]; then set -a; . "'"$NEXUS_ENV_DIR"'/migrate.env"; set +a; fi
  npm run migrate --if-present
'
NEXUS_BUILD_CMD="${NEXUS_BUILD_CMD:-$DEFAULT_BUILD_CMD}"
NEXUS_MIGRATE_CMD="${NEXUS_MIGRATE_CMD:-$DEFAULT_MIGRATE_CMD}"

REF="${1:-}"
[ -n "$REF" ] || die "usage: deploy.sh <git-tag-or-sha>"

verify_target
acquire_lock

[ -d "$NEXUS_REPO" ] || die "repository $NEXUS_REPO not found"
SHA="$(git --git-dir="$NEXUS_REPO" rev-parse --verify --quiet "${REF}^{commit}")" ||
  die "ref '$REF' not found in $NEXUS_REPO"

RELEASES="$NEXUS_ROOT/releases"
RELEASE="$RELEASES/$SHA"
CURRENT="$NEXUS_ROOT/current"
PREVIOUS="$NEXUS_ROOT/previous"
OLD_RELEASE="$(link_target "$CURRENT")"
CREATED=no

cleanup_failed_release() {
  if [ "$CREATED" = yes ] && [ -d "$RELEASE" ]; then
    log "removing the half-built release $SHA"
    rm -rf "$RELEASE"
  fi
}

mkdir -p "$RELEASES"

if [ -e "$RELEASE/.nexus-built" ]; then
  log "release $SHA is already built; reusing it"
else
  log "creating release $SHA (ref $REF)"
  rm -rf "$RELEASE"
  mkdir "$RELEASE"
  CREATED=yes
  git --git-dir="$NEXUS_REPO" archive "$SHA" | tar -x -C "$RELEASE"
  if [ -n "$NEXUS_RUN_AS" ]; then chown -R "$NEXUS_RUN_AS": "$RELEASE"; fi

  log "building"
  if ! (cd "$RELEASE" && as_service_user "$NEXUS_BUILD_CMD"); then
    cleanup_failed_release
    die "build failed; 'current' is unchanged"
  fi
  log "running migrations"
  if ! (cd "$RELEASE" && as_service_user "$NEXUS_MIGRATE_CMD"); then
    cleanup_failed_release
    die "migrations failed; 'current' is unchanged"
  fi
  : >"$RELEASE/.nexus-built"
fi

log "switching current to $SHA"
swap_link "$RELEASE" "$CURRENT"
restart_service

if wait_healthy; then
  if [ -n "$OLD_RELEASE" ] && [ "$OLD_RELEASE" != "$RELEASE" ]; then
    swap_link "$OLD_RELEASE" "$PREVIOUS"
  fi
  # Newest-last list of deployed releases, used for pruning.
  { grep -v -x "$SHA" "$NEXUS_ROOT/releases.log" 2>/dev/null || true; echo "$SHA"; } >"$NEXUS_ROOT/releases.log.new"
  mv -f "$NEXUS_ROOT/releases.log.new" "$NEXUS_ROOT/releases.log"

  # Prune: keep the newest N plus whatever current and previous point at.
  keep="$(tail -n "$NEXUS_KEEP_RELEASES" "$NEXUS_ROOT/releases.log")"
  keep_current="$(basename "$(link_target "$CURRENT")")"
  keep_previous="$(basename "$(link_target "$PREVIOUS")" 2>/dev/null || true)"
  for dir in "$RELEASES"/*; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    if [ "$name" = "$keep_current" ] || [ "$name" = "$keep_previous" ]; then continue; fi
    if printf '%s\n' "$keep" | grep -q -x "$name"; then continue; fi
    log "pruning old release $name"
    rm -rf "$dir"
  done
  log "deployed $SHA; health check passed"
  exit 0
fi

# The health check failed: put the previous release back.
if [ -n "$OLD_RELEASE" ] && [ -d "$OLD_RELEASE" ]; then
  log "health check failed; restoring $(basename "$OLD_RELEASE")"
  swap_link "$OLD_RELEASE" "$CURRENT"
  restart_service || true
  die "health check failed for $SHA; rolled back to $(basename "$OLD_RELEASE")"
fi
rm -f "$CURRENT"
die "health check failed for $SHA and there is no previous release; 'current' removed"
