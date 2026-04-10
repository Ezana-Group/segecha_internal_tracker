# Segecha Internal Tracker - System Architecture

## 1) Overview

Segecha Internal Tracker is a full-stack fleet, operations, finance, and payroll platform built around:

- A React-based admin tracker frontend
- An Express API backend
- PostgreSQL as system-of-record
- Cloudinary (images) and Cloudflare R2 (documents/backups)
- SendGrid and M-Pesa integrations

The system follows a server-first data model: frontend state is hydrated from backend tables and synchronized through authenticated collection endpoints.

## 2) High-Level Components

### Frontend (Admin Tracker)

- **Path**: `src/`
- **Framework**: React + React Router
- **Key responsibilities**:
  - User workflows for operations, finance, payroll, documents, settings
  - Local UX state + optimistic updates
  - Permission-gated UI and profile preview controls
  - Export tooling (Excel/CSV)

### Backend API

- **Path**: `server/`
- **Framework**: Express (CommonJS)
- **Key responsibilities**:
  - Authenticated CRUD endpoints for domain collections
  - Report generation (P&L, KRA exports, receivables/payables, reconciliation)
  - Upload routing to Cloudinary/R2
  - Error logging and schema health checks
  - Payroll payslip generation, dispatch queue, and ledger postings

### Database

- **Engine**: PostgreSQL
- **Schema**: `server/schema.sql`
- **Runtime migration safety**: startup auto-seed/ALTER guards in `server/index.js`
- **Primary domain tables**:
  - `trucks`, `trailers`, `drivers`, `staff`, `customers`
  - `journeys`, `fuel_logs`, `expenses`, `invoices`, `payroll`
  - `documents`, `assets`, `mpesa_transactions`, `error_logs`
  - Payroll/finance extensions: `payroll_statutory_configs`, `payroll_statutory_change_log`, `deduction_templates`, `employee_deductions`, `payslip_dispatch_queue`, `ledger_entries`

## 3) Core Data Flow

1. Frontend calls `GET /api/tracker/data-full`
2. Backend reads all tracked tables and returns snapshot payload
3. Frontend `transformDBTables()` maps SQL rows + metadata to UI models
4. UI edits call `saveItem()` -> `POST /api/admin/collection/:col`
5. Backend extracts canonical columns + preserves full object in `metadata`
6. Data becomes durable in PostgreSQL and rehydrates on next fetch

## 4) Finance & Payroll Architecture

### Finance and Payments

- Main workspace is inside `src/pages/PnL.jsx` (Finance & Payments tab)
- Includes:
  - Financial reporting/KRA export actions
  - M-Pesa transactions + reconciliation
  - Ledger summary + posting audit trail

### Payroll Lifecycle

1. Payroll record created/edited in tracker
2. KRA calculations derived via `computePayrollKRA()`
3. Payment confirmation via `POST /api/admin/payroll/:id/mark-paid`
4. Ledger double-entry posting written into `ledger_entries`
5. Payslip PDF generated (`/generate-payslip`) and saved into `documents`
6. Dispatch queued (`/queue-dispatch`) with paid-only gate
7. Queue processed manually or by cron worker (`/dispatch/process`)

### KRA Reporting Endpoints

- `p10`, `p9a`, `vat3`, `wht-schedule`
- `nssf-schedule`, `nhif-schedule`, `housing-levy-schedule`
- CSV output available via `?format=csv`

## 5) Documents & File Storage

- **Images** -> Cloudinary (when configured)
- **PDF/docs/non-image** -> Cloudflare R2
- `documents` table stores cross-module document index
- Profile pages and central Documents page read from same source-of-truth

## 6) Security & Permissions

- JWT/session-based admin auth middleware
- Profile permission model in `src/utils/profilePermissions.js`
- Role-aware gating for:
  - Settings access
  - Sensitive data operations
  - Staff/driver account actions
  - Payslip visibility/open actions

## 7) Reliability, Backups, and Observability

- Snapshot/backup endpoints include extended financial/payroll tables
- Hard reset reseeds admin principals and now truncates new payroll-finance tables
- Centralized error logging in `error_logs` from frontend/backend/process events
- `GET /api/admin/schema-health` validates required tables/columns

## 8) Deployment Notes

- Branch in use: `ProductionV7_Final`
- Remote: `origin` -> `https://github.com/Ezana-Group/segecha_internal_tracker.git`
- Environment examples:
  - `.env.example.local`
  - `.env.production.example`

## 9) Current Architectural Direction

The platform is moving toward:

- Ledger-backed financial truth for reporting consistency
- Paid-only payroll dispatch controls with auditability
- Filing-ready KRA export surfaces
- Unified document visibility across all profile and system contexts
