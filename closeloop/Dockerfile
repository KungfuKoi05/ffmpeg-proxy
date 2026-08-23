FROM node:22-slim

WORKDIR /app

# There are no dependencies to install - package.json is copied for its
# metadata (version, scripts) only.
COPY package.json ./
COPY src ./src
COPY public ./public
COPY web ./web

RUN mkdir -p data && chown -R node:node /app
USER node

ENV PORT=3000
EXPOSE 3000

# Mount a volume at /app/data or the database is lost on redeploy.
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
