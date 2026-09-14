#!/usr/bin/env bash
# Boots the API against a throwaway SQLite db, downloads the Swagger document and
# writes it pretty-printed to contracts/openapi.json (stable diffs).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/../contracts/openapi.json"
TMP="$(mktemp -d)"
PORT=5099

cleanup() { [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null && wait "$API_PID" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="http://127.0.0.1:$PORT" \
DB_PROVIDER=sqlite CONNECTION_STRING="Data Source=$TMP/export.db" \
Uploads__Path="$TMP/uploads" \
dotnet run --project "$DIR/src/Qseng.Api" --no-launch-profile > "$TMP/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/swagger/v1/swagger.json" -o "$TMP/swagger.json"; then
    mkdir -p "$(dirname "$OUT")"
    python3 -c 'import json,sys; json.dump(json.load(open(sys.argv[1])), open(sys.argv[2], "w"), indent=2, ensure_ascii=False); open(sys.argv[2], "a").write("\n")' "$TMP/swagger.json" "$OUT"
    echo "wrote $OUT"
    exit 0
  fi
  sleep 1
done

echo "API did not come up; log:" >&2
cat "$TMP/api.log" >&2
exit 1
