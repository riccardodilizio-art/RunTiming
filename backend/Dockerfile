# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl   # argon2 + prisma engine
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./
# normalizza i fine-riga (robusto anche con checkout CRLF su Windows) + eseguibile
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health >/dev/null 2>&1 || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
