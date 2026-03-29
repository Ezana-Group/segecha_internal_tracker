# Stage 1: Build all frontends sequentially to save RAM
FROM node:20-alpine AS builder
WORKDIR /app

# Declare build args for Admin Portal
ARG VITE_API_URL
ARG VITE_ADMIN_KEY
ARG VITE_APP_NAME
ARG VITE_COMPANY_NAME
ARG VITE_VAT_RATE
ARG VITE_TYRE_WARNING_KM
ARG VITE_INVOICE_OVERDUE_DAYS

# Set as env vars so Vite can read them
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_KEY=$VITE_ADMIN_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_COMPANY_NAME=$VITE_COMPANY_NAME
ENV VITE_VAT_RATE=$VITE_VAT_RATE
ENV VITE_TYRE_WARNING_KM=$VITE_TYRE_WARNING_KM
ENV VITE_INVOICE_OVERDUE_DAYS=$VITE_INVOICE_OVERDUE_DAYS

# 1. Build Admin Portal (Root)
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Build Driver Portal
WORKDIR /app/driver-portal
COPY driver-portal/package*.json ./
RUN npm ci
COPY driver-portal/ .
RUN npm run build

# 3. Build Payment Portal
WORKDIR /app/payment-portal
COPY payment-portal/package*.json ./
RUN npm ci
COPY payment-portal/ .
RUN npm run build

# 4. Build Track Portal
WORKDIR /app/track-portal
COPY track-portal/package*.json ./
RUN npm ci
COPY track-portal/ .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/driver-portal/dist ./driver-portal/dist
COPY --from=builder /app/payment-portal/dist ./payment-portal/dist
COPY --from=builder /app/track-portal/dist ./track-portal/dist

# Setup Server
COPY server/package*.json ./server/
RUN cd server && npm ci --production
COPY server/ ./server/

EXPOSE 3001
CMD ["node", "server/index.js"]