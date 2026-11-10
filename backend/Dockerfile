FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Generous retries/timeouts so installs survive slow or flaky connections
ENV npm_config_fetch_retries=6 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=180000 \
    npm_config_fetch_timeout=600000 \
    npm_config_maxsockets=4 \
    npm_config_audit=false \
    npm_config_fund=false
# Cache mount keeps downloaded tarballs between builds (and between retries on flaky networks)
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --prefer-offline

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
