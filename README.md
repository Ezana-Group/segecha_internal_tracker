# 🚛 Segecha Group — Fleet ERP

Internal fleet operations management system for Segecha Group, Nairobi Kenya.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password + magic link invites)
- **Hosting:** Vercel
- **Features:** Fleet, Drivers, Journeys, Fuel, Expenses, Invoices, Payroll, Tyre Monitor, P&L

## Quick Start (Development)

```bash
npm install
cp .env.local.example .env.local
# Fill in your Supabase keys in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

See `DEPLOYMENT_GUIDE.md` for complete step-by-step instructions.

## User Roles
| Role | Permissions |
|------|-------------|
| `admin` | Full access + user management |
| `director` | Full read/write on all fleet data |
| `viewer` | Read-only |

## Database Setup
Run `supabase-schema.sql` in your Supabase SQL Editor.
