# Stage 1: Build static assets
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json ./client/

RUN npm ci --workspace=client

COPY client/ ./client/

ENV API_BASE_URL=""
RUN npm run build --workspace=client

# Stage 2: Serve static assets & route api calls using Nginx
FROM nginx:alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
