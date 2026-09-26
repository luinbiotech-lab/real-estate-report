FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_KAKAO_JAVASCRIPT_KEY=
ARG VITE_API_BASE_URL=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ARG VITE_REQUIRE_REMOTE_AUTH=true
ARG VITE_CUTOVER_MODE=false
ARG VITE_REMOTE_OPERATIONAL_MODE=false
ENV VITE_KAKAO_JAVASCRIPT_KEY=$VITE_KAKAO_JAVASCRIPT_KEY \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_REQUIRE_REMOTE_AUTH=$VITE_REQUIRE_REMOTE_AUTH \
    VITE_CUTOVER_MODE=$VITE_CUTOVER_MODE \
    VITE_REMOTE_OPERATIONAL_MODE=$VITE_REMOTE_OPERATIONAL_MODE

RUN npm run build && npm run scan:build-secrets

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    FRONTEND_HOST=0.0.0.0 \
    FRONTEND_PORT=4174 \
    MAP_PROXY_HOST=127.0.0.1 \
    MAP_PROXY_PORT=5175 \
    MAP_PROXY_INTERNAL_URL=http://127.0.0.1:5175

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts/production.mjs ./scripts/production.mjs
COPY --from=build /app/package.json ./package.json

RUN chown -R node:node /app
USER node

EXPOSE 4174
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4174/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/production.mjs"]
