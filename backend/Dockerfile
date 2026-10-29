# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl   # argon2 + prisma engine
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package*.json ./
# Versioni esatte del lockfile; gli strumenti di compilazione (argon2) si tolgono subito dopo
RUN apk add --no-cache --virtual .build python3 make g++ \
    && npm ci --omit=dev && npm cache clean --force \
    && apk del .build
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./
# normalizza i fine-riga (robusto anche con checkout CRLF su Windows) + eseguibile
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh && chown -R node:node /app
# Niente root dentro il container
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health >/dev/null 2>&1 || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
