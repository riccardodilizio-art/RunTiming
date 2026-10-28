#!/bin/sh
set -e
# In dev: allinea lo schema al DB (crea le tabelle) senza file di migrazione.
# In produzione si userà invece `prisma migrate deploy`.
echo "→ prisma db push…"
# Solo sviluppo locale (docker-compose): DB_PUSH_ACCEPT_DATA_LOSS=true applica le
# modifiche di schema anche quando Prisma chiede conferma (es. nuovi vincoli unique).
if [ "$DB_PUSH_ACCEPT_DATA_LOSS" = "true" ]; then
  npx prisma db push --skip-generate --accept-data-loss
else
  npx prisma db push --skip-generate
fi
echo "→ avvio API…"
exec node dist/main.js
