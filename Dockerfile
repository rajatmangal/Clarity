FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && node scripts/prepare-desktop.mjs
FROM node:22-bookworm-slim
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=4310 CLARITY_CONFIG_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/build-runtime ./
COPY --chown=node:node scripts/container-entry.mjs ./container-entry.mjs
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4310
CMD ["node", "container-entry.mjs"]
