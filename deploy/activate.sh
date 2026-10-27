#!/usr/bin/env bash
set -Eeuo pipefail
# Run on the existing VPS as root after configuration has been transferred securely.
image=${1:?release image required}
mode=${2:-stage}
[[ "$image" =~ ^reachard:[a-f0-9]{40}$ ]] || { echo "Unexpected image name" >&2; exit 1; }
[[ "$mode" == stage || "$mode" == activate ]] || exit 1
root=${REACHARD_RELEASE_ROOT:-/opt/reachard}
legacy_compose=${REACHARD_LEGACY_COMPOSE:-/home/ubuntu/siyi/docker-compose.yml}
python3 "$root/deploy/check-runtime-env.py" "$root/runtime.env"
docker image inspect "$image" >/dev/null
candidate=reachard_candidate
if docker inspect "$candidate" >/dev/null 2>&1; then
  test "$(docker inspect -f '{{index .Config.Labels "co.reachard.role"}}' "$candidate")" = candidate
  docker rm -f "$candidate" >/dev/null
fi
cleanup() { docker rm -f "$candidate" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Stage on a different loopback port. Both public hostnames continue using the old process.
docker run -d --name "$candidate" --label co.reachard.role=candidate --network host --memory 512m --memory-swap 768m --pids-limit 256 \
  --env-file "$root/runtime.env" -e HOSTNAME=127.0.0.1 -e PORT=18787 --init "$image" >/dev/null
healthy() {
  for attempt in $(seq 1 30); do
    if curl --max-time 5 --fail --silent "http://127.0.0.1:$1/health" | python3 -c 'import json,sys; d=json.load(sys.stdin);sys.exit(not d.get("ready"))' 2>/dev/null; then return 0; fi
    sleep 2
  done
  return 1
}
healthy 18787
curl --max-time 15 --fail --silent -H 'Host: reachard.co' http://127.0.0.1:18787/ >/dev/null
curl --max-time 15 --fail --silent -H 'Host: reachard.co' http://127.0.0.1:18787/sign-in >/dev/null
if [[ "$mode" == stage ]]; then echo "Candidate ready; public routing unchanged."; exit 0; fi
umask 077
snapshot="$root/backups/$(date -u +%Y%m%dT%H%M%SZ)-${image#reachard:}"
mkdir -p "$snapshot"
cp "$root/runtime.env" "$snapshot/runtime.env"
if test -f "$root/active-compose.yml"; then cp "$root/active-compose.yml" "$snapshot/compose.yml"; else cp "$root/deploy/compose.yml" "$snapshot/compose.yml"; fi
cp "$legacy_compose" "$snapshot/legacy-compose.yml"
old_image=$(docker inspect -f '{{.Image}}' reachard 2>/dev/null || true)
legacy_running=$(docker inspect -f '{{.State.Running}}' connection_contacts 2>/dev/null || true)
legacy_restart=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' connection_contacts 2>/dev/null || true)
if test -n "$old_image"; then
  # Capture the running configuration privately; never print container env values.
  docker inspect reachard | python3 -c 'import json,sys; c=json.load(sys.stdin)[0];open(sys.argv[1],"w").write("\n".join(c["Config"]["Env"])+"\n")' "$snapshot/previous-runtime.env"
fi
printf '%s\n' "$old_image" > "$snapshot/old-image"
printf '%s\n' "$legacy_running" > "$snapshot/legacy-running"
printf '%s\n' "$legacy_restart" > "$snapshot/legacy-restart"
rollback() {
  docker rm -f reachard >/dev/null 2>&1 || true
  if test -n "$old_image"; then
    cp "$snapshot/previous-runtime.env" "$root/runtime.env"
    cp "$snapshot/compose.yml" "$root/active-compose.yml"
    printf 'REACHARD_IMAGE=%s\n' "$old_image" > "$root/release.env"
    docker compose --project-name reachard --env-file "$root/release.env" -f "$root/active-compose.yml" up -d --no-build reachard
  elif [[ "$legacy_running" == true ]]; then
    docker update --restart="${legacy_restart:-always}" connection_contacts >/dev/null
    docker start connection_contacts >/dev/null
    cp "$snapshot/legacy-compose.yml" "$legacy_compose"
  fi
  healthy 8787
}
on_failure() {
  status=$?
  trap - ERR
  rollback || echo "Automatic rollback needs attention; inspect the retained snapshot." >&2
  echo "Activation failed; rollback attempted." >&2
  exit "$status"
}
trap on_failure ERR
if test -n "$old_image"; then docker stop --time 90 reachard >/dev/null; fi
if [[ "$legacy_running" == true ]]; then
  docker update --restart=no connection_contacts >/dev/null
  docker stop --time 90 connection_contacts >/dev/null
fi
printf 'REACHARD_IMAGE=%s\n' "$image" > "$root/release.env"
docker compose --project-name reachard --env-file "$root/release.env" -f "$root/deploy/compose.yml" up -d --no-build reachard
healthy 8787
# Keep the old service recoverable, but excluded from routine shared-compose starts.
python3 - "$legacy_compose" <<'PYTHON'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text();marker='  connection_contacts:\n'
if marker in s and '    profiles: ["legacy-reachard"]' not in s:
    assert s.count(marker)==1
    p.write_text(s.replace(marker,marker+'    profiles: ["legacy-reachard"]\n'))
PYTHON
cp "$root/deploy/compose.yml" "$root/active-compose.yml"
printf '%s\n' "$snapshot" > "$root/last-rollback-path"
trap - ERR
echo "Unified Next.js activated; rollback snapshot: $snapshot"
