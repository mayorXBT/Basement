# syntax=docker/dockerfile:1
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --chmod=0444 package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --strict-ssl=true && npm cache clean --force

COPY --chmod=0444 server.js ./
COPY --chmod=0555 public ./public

USER node
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
