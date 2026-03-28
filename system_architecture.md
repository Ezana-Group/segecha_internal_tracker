# Segecha Internal Tracker - System Architecture

## 1. High-Level Overview
The Segecha Internal Tracker is a comprehensive monorepo application structured around a central **Node.js/Express API Backend** that serves multiple distinct **React Frontends (Portals)**. The system is designed for high-concurrency fleet management, financial tracking, and public logistics transparency.

The system is composed of the following core segments:
- **Server (`server/`)**: Express.js REST API providing data, authentication, and automated background tasks.
- **Admin Portal (`src/`)**: Primary control panel for Admins and Staff, featuring deep system management and analytics.
- **Driver Portal (`driver-portal/`)**: Mobile-first Web App for drivers to log expenses, journeys, and view payroll details.
- **Track Portal (`track-portal/`)**: Public-facing page for clients to track shipments via waybill numbers with integrated rate limiting.
- **Payment Portal (`payment-portal/`)**: Secure public-facing checkout for invoice payments via M-Pesa, Card, or Bank.

---

## 2. Infrastructure & Deployment
- **Build System**: Vite is used for all frontends. A multi-stage **Dockerfile** ensures optimized production builds by isolating portal compilations before assembly into the final runtime image.
- **Deployment**: Configured for **Railway** using the **NIXPACKS** builder. The root `railway.json` orchestrates the build and start commands, while a `Procfile` provides process management.
- **Static File Serving**: The Express backend serves built static files (`dist/`) for all portals. It intelligently routes requests based on subdomains (e.g., `driver.segecha.com`) or path-based fallbacks (e.g., `/driver/*`).

---

## 3. Database Architecture (PostgreSQL/Neon)
The application utilizes a **PostgreSQL** database hosted on Neon, connected via a high-performance connection pool (`pg` driver).

### Core Tables & Relationships
1. **Administrative & Auth**:
   - `superadmins`: Global system owners.
   - `admins`: Standard administrative users with established roles.
   - `staff_auth` & `driver_auth`: Separate authentication tables for staff and drivers, supporting multi-method login (OTP, Password).
2. **Fleet & Personnel**:
   - `trucks` & `trailers`: Fleet assets with metadata and status tracking.
   - `drivers` & `staff`: Personal records linked to their respective authentication identities.
3. **Operations & Logistics**:
   - `journeys`: The central operational unit linking trucks, drivers, and customers. Includes T1/TR form tracking and internal status workflows.
   - `incidents`: Safety and operational disruptions linked to journeys.
4. **Financials & Logs**:
   - `fuel_logs` & `expenses`: Operational costs linked to specific journeys and trucks.
   - `invoices`: Financial records for customer billing.
   - `payroll`: Automated salary and commission tracking for drivers and staff.
5. **System & Security**:
   - `documents`: Center point for PDF/DOC storage across the entire system.
   - `system_settings`: Central JSONB store for dynamic configuration.
   - `system_settings_audit`: Full audit trail for every change made to system settings.

*(Note: Almost all tables utilize a `metadata JSONB` column for schema-less flexibility, allowing for rapid feature deployment without complex migrations).*

---

## 4. Backend Architecture (`server/`)
### Core Services
- **Authentication**: JWT-based security with strict role-based access control (RBAC). Implements a **`session_version`** mechanism, allowing superadmins to force-logout users globally.
- **Document Management**: Unified integration with **Cloudflare R2** for secure, high-availability document storage (Waybills, IDs, Licenses).
- **Automated Workflows**:
    - **Backup Scheduler**: Integrated system that performs automated backups (6h, Daily, or Weekly) to JSON or ZIP formats.
    - **Self-Healing Schema**: On-boot `autoSeed` and migration logic ensures the database schema stays synchronized with the code.
- **Security**: 
    - Rate limiting on public endpoints (`/api/track/:ref`).
    - Webhook signature verification for secure payment processing (M-Pesa/Flutterwave).

### Integrations
- **Payments**: M-Pesa (Safaricom Daraja) and Flutterwave SDKs.
- **Communications**: Dedicated Email and SMS modules for automated alerting.
- **Storage**: Cloudflare R2 (Primary) and Cloudinary (Legacy/Images).

---

## 5. Frontend Portals Architecture
### 5.1 Admin Portal (`src/`)
- **Type**: Advanced React SPA with centralized state management via `useAppState()`.
- **Key Features**: 
    - Real-time Dashboard with aggregated stats.
    - Full Fleet & Journey Management with Excel Import/Export engines.
    - Integrated Document Viewer and Backup/Restore management.
    - Master Reset & Audit Logs for system integrity.

### 5.2 Driver Portal (`driver-portal/`)
- **Type**: Mobile-first React SPA optimized for low-bandwidth environments.
- **Features**: 
    - Multi-method login (WhatsApp/SMS OTP or Password).
    - Background polling (10s) for real-time trip updates.
    - Document uploading (PODs, Fuel Receipts) directly from the field.

### 5.3 Payment & Track Portals
- **Payment**: Specialized checkout flow supporting M-Pesa STK Push, Card payments, and Bank instructions.
- **Track**: Lightweight, highly-cached search interface for logistics transparency.

---

## 6. Summary of Data Flow
1. **Creation**: Admin schedules a Journey. The backend generates a unique `tracking_id` and waybill record.
2. **Execution**: Driver receives notification, opens the portal, and completes verification steps. Fuel and expenses are logged in real-time.
3. **Transparency**: The client tracks the cargo via the Track Portal using the waybill reference.
4. **Conclusion**: Upon arrival, the Admin generates an Invoice. The client pays via the Payment Portal, and webhooks automatically update the invoice status and driver's payroll.
