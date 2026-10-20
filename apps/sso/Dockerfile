# Keycloak with the verify-only legacy password provider and the two login themes baked in.
FROM maven:3.9.9-eclipse-temurin-21 AS providers
WORKDIR /build
COPY providers/legacy-password/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY providers/legacy-password/src src
RUN mvn -B -q package

# Optional import tools: build --target tools, context apps/sso; no source DB secrets baked in.
FROM node:22-alpine AS tools
WORKDIR /tools
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
COPY package.json ./
RUN pnpm install --prod --ignore-workspace --no-frozen-lockfile
COPY *.mjs clients.json ./
USER node
ENTRYPOINT ["node", "import-legacy-users.mjs"]

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=providers /build/target/legacy-password-1.0.0.jar /opt/keycloak/providers/
COPY themes /opt/keycloak/themes
