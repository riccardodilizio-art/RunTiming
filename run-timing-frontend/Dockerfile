# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# URL del backend + flag uso API, iniettati a build-time (Vite)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_USE_API="false"
ENV VITE_USE_API=$VITE_USE_API
RUN npm run build

# ---- runtime stage (static, served by nginx) ----
FROM nginx:1.27-alpine AS run
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
