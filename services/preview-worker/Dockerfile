FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim

RUN corepack enable \
  && corepack prepare pnpm@10.33.2 --activate \
  && corepack prepare yarn@1.22.22 --activate \
  && groupadd --gid 10001 caideapp \
  && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin caideapp

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

# The supervisor stays root only so it can launch generated apps under uid 10001.
# Generated apps receive a minimal environment and cannot read root-owned secrets.
CMD ["node", "dist/server.js"]
