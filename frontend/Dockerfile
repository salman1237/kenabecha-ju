FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# npm ci, not npm install: it installs exactly what the lockfile pins and fails
# loudly on drift, so a production image can't silently resolve different
# versions than the ones that were tested.
RUN npm ci

FROM deps AS dev
COPY . .
CMD ["npm", "run", "dev"]

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
# Docker sets HOSTNAME to the container id, and Next's standalone server binds
# to whatever HOSTNAME says — so it listens on the container's eth0 address and
# refuses connections on 127.0.0.1. External traffic still works, which makes
# this easy to miss, but the container health check (and anything else talking
# to localhost inside the container) fails permanently.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
