#!/bin/sh
set -e
# Apply the (idempotent) schema migration before starting, unless disabled.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node src/db/migrate.js
fi
exec "$@"
