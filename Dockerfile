# Google Cloud Run image: builds the Vite game and serves it + the AI functions from server.mjs.
# AI = Gemini on Vertex AI via the Cloud Run service account (no key in the image). Secrets (EXPERTS_PASSCODE,
# SESSION_SECRET, optional ANTHROPIC_API_KEY) are injected at runtime from Secret Manager, never baked in.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
