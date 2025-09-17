# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV NODE_ENV=production
WORKDIR /app

# Install dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY src ./src
COPY public ./public
COPY README.md ./README.md

# Cloud Run provides PORT, default to 8080
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
