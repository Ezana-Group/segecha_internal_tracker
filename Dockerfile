# Stage 1: Build Admin Portal (Root)
FROM node:20-alpine AS build-admin
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build Driver Portal
FROM node:20-alpine AS build-driver
WORKDIR /app
COPY driver-portal/package*.json ./
RUN npm install
COPY driver-portal/ .
RUN npm run build

# Stage 3: Build Payment Portal
FROM node:20-alpine AS build-payment
WORKDIR /app
COPY payment-portal/package*.json ./
RUN npm install
COPY payment-portal/ .
RUN npm run build

# Stage 4: Build Track Portal
FROM node:20-alpine AS build-track
WORKDIR /app
COPY track-portal/package*.json ./
RUN npm install
COPY track-portal/ .
RUN npm run build

# Stage 5: Runtime
FROM node:20-alpine
WORKDIR /app

# Copy built frontend assets from previous stages
COPY --from=build-admin /app/dist ./dist
COPY --from=build-driver /app/dist ./driver-portal/dist
COPY --from=build-payment /app/dist ./payment-portal/dist
COPY --from=build-track /app/dist ./track-portal/dist

# Copy and setup server
COPY server/package*.json ./server/
RUN cd server && npm install --production
COPY server/ ./server/

# Expose port and start explicitly
EXPOSE 3001
WORKDIR /app/server
CMD ["node", "index.js"]
