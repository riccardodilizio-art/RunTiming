#!/bin/sh
set -e
# In dev: allinea lo schema al DB (crea le tabelle) senza file di migrazione.
# In produzione si userà invece `prisma migrate deploy`.
echo "→ prisma db push…"
npx prisma db push --skip-generate
echo "→ avvio API…"
exec node dist/main.js
