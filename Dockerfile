# Stage 1: Build Admin Portal (Root)
FROM node:20-alpine AS build-admin
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Declare build args
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
COPY --from=build-admin /app/dist ./dist
COPY --from=build-driver /app/dist ./driver-portal/dist
COPY --from=build-payment /app/dist ./payment-portal/dist
COPY --from=build-track /app/dist ./track-portal/dist
COPY server/package*.json ./server/
RUN cd server && npm install --production
COPY server/ ./server/
EXPOSE 3001
WORKDIR /app
CMD ["node", "server/index.js"]