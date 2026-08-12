FROM node:22-alpine

WORKDIR /app

# Leverage caching for npm dependencies
COPY package.json package-lock.json ./
COPY server/package.json ./server/

RUN npm ci --omit=dev --workspace=server

COPY server/ ./server/

WORKDIR /app/server

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production
ENV DB_PATH=./data/iacuc.db

CMD ["npm", "start"]
