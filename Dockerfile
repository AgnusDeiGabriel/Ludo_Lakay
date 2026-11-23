# Ludo Lakay — imaj sèvè a
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DB_FILE=/app/data/db.json
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY shared ./shared
COPY public ./public

# Done yo (pòtfèy + liv kontab) rete nan yon volim
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "server/server.js"]
