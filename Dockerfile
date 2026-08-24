# ─── Stage 1: Base Image ────────────────────────────────────────────────────────
# Use the official Node.js 18 Alpine image as the base.
# Alpine is a minimal Linux distribution (~5MB), keeping the image small and secure.
FROM node:18-alpine

# ─── Set Working Directory ───────────────────────────────────────────────────────
# All subsequent commands will run from this directory inside the container.
WORKDIR /app

# ─── Set Environment ─────────────────────────────────────────────────────────────
# Tell Node.js we are running in production mode.
# This disables dev-only features, enables optimizations, and reduces logging noise.
ENV NODE_ENV=production

# ─── Install Dependencies ─────────────────────────────────────────────────────────
# Copy package.json and package-lock.json BEFORE copying the rest of the source.
# Docker caches each layer — if these files haven't changed, it reuses the cached
# node_modules layer and skips npm install on the next build. This speeds up builds.
COPY package*.json ./

# Install only production dependencies (skip devDependencies like nodemon).
# --omit=dev is the modern equivalent of --only=production.
RUN npm ci --omit=dev

# ─── Copy Application Source ──────────────────────────────────────────────────────
# Copy the rest of the application code into the container.
# This step comes AFTER npm install so that code changes don't invalidate the
# dependency cache layer.
COPY . .

# ─── Expose Port ──────────────────────────────────────────────────────────────────
# Document that the container listens on port 3000 at runtime.
# This does NOT publish the port — that is done in docker-compose.yml.
EXPOSE 3000

# ─── Security: Run as Non-Root User ───────────────────────────────────────────────
# The node:alpine image includes a built-in "node" user (uid 1000).
# Running as non-root is a container security best practice.
USER node

# ─── Start Command ────────────────────────────────────────────────────────────────
# Start the Express server. Use the array (exec) form to ensure signals like
# SIGTERM and SIGINT are passed directly to Node.js, enabling graceful shutdown.
CMD ["node", "server.js"]
