# Cloud Run container for the PBuddy API. Node 22+ runs TypeScript natively via
# type stripping, so there is no separate build/emit step.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY api/package.json ./api/package.json
RUN npm install --omit=dev --workspace api --include-workspace-root

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY api ./api
COPY package.json ./package.json
WORKDIR /app/api
EXPOSE 8080
CMD ["node", "src/server.ts"]
