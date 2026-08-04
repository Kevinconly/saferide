FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY tsconfig*.json ./
COPY . ./
RUN npm ci
RUN npm run build --workspace=saferide-backend

FROM node:18-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=builder /usr/src/app/apps/saferide-backend/dist ./dist
COPY --from=builder /usr/src/app/apps/saferide-backend/package*.json ./
RUN npm ci --production
USER node
CMD ["node","dist/main.js"]
