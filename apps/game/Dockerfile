# Game web app (Next.js standalone). Build from the repository root:
#   docker build --platform linux/amd64 -f apps/game/Dockerfile -t chibi-town-web:latest .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Public paths are baked into the browser bundle; rebuild when changing the deployment prefix.
ARG NEXT_PUBLIC_BASE_PATH=
ARG NEXT_PUBLIC_API_URL=/api
# Public origin for absolute share-image URLs (Open Graph/Twitter); empty keeps relative metadata.
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --filter=@chibi-town/game

FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/game/.next/standalone ./
COPY --from=build /repo/apps/game/.next/static ./apps/game/.next/static
COPY --from=build /repo/apps/game/public ./apps/game/public
USER node
EXPOSE 3000
CMD ["node", "apps/game/server.js"]
