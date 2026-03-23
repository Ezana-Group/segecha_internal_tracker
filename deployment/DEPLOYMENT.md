# 🚀 Step-by-Step Deployment Guide

Follow these exact steps to move your app to production using **Railway** and **Neon**.

## Phase 1: Database (Neon)
1. [ ] Log in to [Neon Console](https://console.neon.tech/).
2. [ ] Create a new project called `segecha-prod`.
3. [ ] Open the **SQL Editor** in the sidebar.
4. [ ] Paste and **Run** the contents of `deployment/schema.sql`.
5. [ ] Copy your **Connection String** from the dashboard (keep it for Phase 2).

## Phase 2: Server & App (Railway)
1. [ ] Log in to [Railway](https://railway.app/).
2. [ ] Click **New Project** > **Deploy from GitHub repo**.
3. [ ] Select your repository.
4. [ ] **Backend Setup**:
   - Go to settings for the `server` service.
   - Add variable `DATABASE_URL` = (The string from Phase 1).
   - Add variable `ADMIN_KEY` = (Your secret key).
   - Add variable `CORS_ORIGINS` = `*` (Change to your frontend URL later for security).
5. [ ] **Frontend Setup**:
   - Ensure the root directory is building using the root `package.json`.
   - Railway will automatically detect the Vite build.

## Phase 3: Final Sync
1. [ ] Once deployed, copy your Railway **Backend URL**.
2. [ ] Update `VITE_API_URL` in your `driver-portal/.env` with this URL.
3. [ ] Redeploy the frontend to apply the new API endpoint.

---
**Done!** Your application is now live on Railway with a Neon PostgreSQL backend.
