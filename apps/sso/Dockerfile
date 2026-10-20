# Keycloak with the verify-only legacy password provider and the two login themes baked in.
FROM maven:3.9.9-eclipse-temurin-21 AS providers
WORKDIR /build
COPY providers/legacy-password/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY providers/legacy-password/src src
RUN mvn -B -q package

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=providers /build/target/legacy-password-1.0.0.jar /opt/keycloak/providers/
COPY themes /opt/keycloak/themes
