# API server. Build from the repository root:
#   docker build --platform linux/amd64 -f apps/api/Dockerfile -t chibi-town-api:latest .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@chibi-town/api...
# A self-contained copy of the API with production dependencies only (workspace packages included).
RUN pnpm --filter @chibi-town/api deploy --prod --legacy /out

FROM node:22-alpine AS production
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3001/api/auth/session || exit 1
CMD ["node", "dist/main.js"]
