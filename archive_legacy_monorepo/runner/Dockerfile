# ANGKOR EYES runner — Docker image (run on a VPS or local machine)
# The runner needs Docker-in-Docker ONLY for the sandbox; it must NEVER
# mount the host Docker socket. Use docker:dind as a sidecar instead, or
# run the sandbox via the host docker CLI through a restricted socket proxy.
FROM node:20-alpine

# git + docker CLI (client only — no daemon, no socket mount)
RUN apk add --no-cache git docker-cli curl tini && \
    adduser -D -u 10001 runner

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
RUN npm run build 2>/dev/null || npx tsc -p tsconfig.json

# Worktrees + logs live outside the image
VOLUME ["/worktrees", "/app/logs"]
USER 10001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
# Env (set at runtime, never baked in):
#   RUNNER_TOKEN, BACKEND_WSS_URL, REPO_PATH=/repos/<project>
