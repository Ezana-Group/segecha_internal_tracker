# Segecha Internal Tracker - System Architecture

## 1. High-Level Overview
The Segecha Internal Tracker is a full-stack logistics and fleet management system. It follows a **Monolithic API + Multi-Portal Frontend** architecture. A single Node.js/Express server acts as the central hub, managing data persistence, authentication, and external integrations, while serving four distinct React-based web applications (Portals).

### Core Components:
-   **API Server (`server/`)**: Express.js backend handling RESTful requests, security, and automated workflows.
-   **Admin Portal (`src/`)**: Real-time management dashboard for operations, finance, and system settings.
-   **Driver Portal (`driver-portal/`)**: Mobile-optimized app for field reporting (fuel, expenses, journey updates).
-   **Track Portal (`track-portal/`)**: Public-facing lightweight interface for shipment tracking.
-   **Payment Portal (`payment-portal/`)**: Secure interface for M-Pesa and invoice settlements.

---

## 2. Database Layer (PostgreSQL / Neon)
The system uses **PostgreSQL** (hosted on Neon) for structured data.

### 2.1 Connection Logic
-   **Driver**: `pg` (node-postgres) with a high-performance `Pool`.
-   **Security**: SSL is enabled (`rejectUnauthorized: false`) for secure cloud database communication.
-   **Resilience**: The backend includes a fallback mechanism to load credentials from local `.env` if the environment variables are missing on boot.

### 2.2 Schema & Table Definitions
The database contains ~20 tables designed for relational integrity with "schema-less" flexibility via JSONB metadata.

| Category | Tables | Description |
| :--- | :--- | :--- |
| **Identity** | `superadmins`, `admins`, `staff`, `drivers` | Core personnel and identity records. |
| **Auth** | `staff_auth`, `driver_auth` | Credentials, OTP hashes, and reset tokens for portals. |
| **Fleet** | `trucks`, `trailers` | Physical assets with maintenance and status tracking. |
| **CRM** | `customers` | Client directory linked to journeys and invoices. |
| **Operations** | `journeys`, `incidents` | The central "trip" unit and exception tracking. |
| **Financials** | `fuel_logs`, `expenses`, `invoices`, `payments`, `payroll` | Cost tracking, billing, and automated salary calculation. |
| **Logistics** | `maintenance_logs`, `tyre_logs` | Deep fleet health monitoring. |
| **System** | `documents`, `system_settings`, `system_settings_audit` | Document storage meta, JSONB settings, and change logs. |

> [!TIP]
> **Metadata Column**: Most tables include a `metadata JSONB` column. This allows the system to store dynamic, non-standard fields for specific journeys or trucks without requiring database migrations for every UI change.

---

## 3. "Inside-Out" System Flow
### 3.1 Portal Serving (Static Assets)
The backend serves the built React applications from their respective `dist/` folders. It uses a **Dual-Routing** strategy:
1.  **Subdomain Routing**: Requests to `driver.segecha.com` are automatically routed to the Driver Portal's static files.
2.  **Path-Based Routing**: Fallback routes like `/driver/*` or `/pay/*` serve the respective portal if subdomains are not used.

### 3.2 Request Lifecycle
1.  **Entry**: A Request hits the Express server.
2.  **Middleware Stack**:
    -   `CORS`: Configured to reflect origins for multi-portal support.
    -   `adminAuth`: Validates either a `Bearer JWT` (user sessions) or `x-admin-key` (internal sync).
    -   `restrictTo`: Enforces Role-Based Access Control (e.g., only `superadmin` can perform a system reset).
3.  **Controllers**: Logic in `server/index.js` (and modular files like `driver-data.js`) interacts with `db.query`.
4.  **Response**: Data is returned as JSON, or static files are served for frontend navigation.

### 3.3 Self-Healing Architecture
On every server boot, the `autoSeed()` function executes:
-   **Migration Check**: Ensures critical columns (like `session_version` or `finalized`) exist before the app starts.
-   **Superadmin Sync**: Ensures at least one `superadmin` exists based on `INITIAL_ADMIN_EMAIL`.
-   **Settings Init**: Populates default system settings if the database is fresh.

---

## 4. Key Integrations
-   **Payments**: 
    -   **M-Pesa STK Push**: Initiated via `/api/mpesa/stk-push`. The server handles asynchronous callbacks (`/api/webhooks/mpesa`), automatically updates `invoices` to 'Paid', and creates `payments` records.
-   **Storage**: 
    -   **Cloudflare R2**: Unified document storage for Waybills, IDs, and Receipts.
    -   **Cloudinary**: Used as an auxiliary for image processing.
-   **Communications**: 
    -   **SendGrid**: Automated invoice and receipt emails.
    -   **Africa's Talking**: SMS alerts for drivers and portal OTPs.

---

## 5. Security Model
-   **JWT Force-Logout**: Portals use `session_version`. If an admin's password is changed, the `session_version` increments in the DB, immediately invalidating all existing JWTs.
-   **Rate Limiting**: Public endpoints like `/api/track/:ref` are throttled (30 requests per 15 mins) to prevent enumeration attacks.
-   **Encryption**: All passwords use `bcrypt` with 10 salt rounds.

---

## 6. Environment Configuration (`server/.env`)
-   `DATABASE_URL`: Connection string for Neon PostgreSQL.
-   `ADMIN_KEY`: Shared secret for internal sync and master actions.
-   `JWT_SECRET`: Signing key for user tokens.
-   `MPESA_*`: Credentials for Daraja API (Consumer Key, Secret, Passkey).
-   `CF_ACCOUNT_ID/R2_*`: Cloudflare storage credentials.
