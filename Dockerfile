# 🐳 Multi-stage Dockerfile for MCP NextGen Suite
# Optimized for minimal footprint (< 95MB) and zero-root execution

# Stage 1: Build & Compile TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root dependencies definition
COPY package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/generator-cli/package.json ./packages/generator-cli/
COPY packages/server-db-profiler/package.json ./packages/server-db-profiler/
COPY packages/server-devops-k8s/package.json ./packages/server-devops-k8s/

# Install all dependencies including devDependencies for build
RUN npm install

# Copy source code and configs
COPY tsconfig.json ./
COPY packages ./packages

# Build all TypeScript packages
RUN npm run build

# Remove development dependencies to keep final layer small
RUN npm prune --production

# Stage 2: Minimal Production Image
FROM node:22-alpine AS runner

# Install essential CLI tools (sqlite3, curl) for healthchecks and diagnostics
RUN apk add --no-cache sqlite curl bash

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built dist artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/server-db-profiler/dist ./packages/server-db-profiler/dist
COPY --from=builder /app/packages/server-db-profiler/package.json ./packages/server-db-profiler/package.json
COPY --from=builder /app/packages/server-devops-k8s/dist ./packages/server-devops-k8s/dist
COPY --from=builder /app/packages/server-devops-k8s/package.json ./packages/server-devops-k8s/package.json

# Run as non-root user for enterprise security
USER node

EXPOSE 3000

# Default entrypoint runs DB profiler on stdio
ENTRYPOINT ["node", "packages/server-db-profiler/dist/index.js"]
