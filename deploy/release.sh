#!/usr/bin/env bash
# Releases one commit (backend + frontend) on the VPS. It is the SSH forced command of the CI deploy key (authorized_keys):
#   restrict,command="/abs/path/to/repo/deploy/release.sh" ssh-ed25519 AAAA... tijaratk-bot-deploy
# CI runs `ssh user@host <40-hex sha>`; by hand: `deploy/release.sh <sha>`.
set -Eeuo pipefail

# Args: <40-hex sha> [backend] [frontend]  (no app given = both)
read -r sha apps <<< "${SSH_ORIGINAL_COMMAND:-$*}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "release: need a full 40-char commit sha, got '${sha}'" >&2; exit 2; }
[[ "${apps:-backend frontend}" =~ ^(backend|frontend)( (backend|frontend))?$ ]] || { echo "release: bad apps '${apps}'" >&2; exit 2; }
apps=" ${apps:-backend frontend} "

# A non-interactive ssh session has a minimal PATH, so pick up node/pnpm/pm2 the way a login shell would.
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
for c in git node pnpm pm2 flock; do command -v "$c" > /dev/null || { echo "release: $c not on PATH" >&2; exit 3; }; done

repo="$(cd "$(dirname "$0")/.." && pwd)"
exec 9> "${TMPDIR:-/tmp}/tijaratk-bot-release.lock"
flock -n 9 || { echo "release: another release is running" >&2; exit 4; }

# One brace group, parsed whole before it runs: the merge below can rewrite this very file.
{
  cd "$repo"
  git fetch --quiet origin main
  git merge --ff-only "$sha"          # never a reset: refuses a sha that isn't ahead of what is deployed

  names=()
  if [[ "$apps" == *" backend "* ]]; then
    (cd backend && pnpm install --frozen-lockfile && pnpm build && pnpm db:migrate)
    names+=(tijaratk-bot-backend tijaratk-bot-backend-worker)
  fi
  if [[ "$apps" == *" frontend "* ]]; then
    (cd frontend && pnpm install --frozen-lockfile && pnpm build)
    names+=(tijaratk-bot-frontend)
  fi

  # startOrRestart also creates an app that was never started; --only limits it to the changed ones.
  pm2 startOrRestart ecosystem.config.js --only "$(IFS=,; echo "${names[*]}")" --update-env && pm2 save
  echo "release: $sha restarted"
  exit 0
}
