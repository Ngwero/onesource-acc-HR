# AgriBooks Accounting System

A full-stack agricultural produce accounting system for managing purchases, inventory, local/export sales, expenses, payables, receivables, double-entry ledger, and financial reports.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| UI | shadcn/ui-style components, Recharts |
| Backend | Next.js API Routes |
| Database | PostgreSQL via **Supabase** |
| ORM | Prisma 7 |
| Auth | JWT (httpOnly cookies) |
| Validation | Zod |
| PDF | jsPDF |
| Export | xlsx (Excel/CSV) |
| Storage | Local uploads + Supabase Storage ready |

## Architecture

```
agribooks-accounting/
├── prisma/
│   ├── schema.prisma      # Full data model (30+ entities)
│   └── seed.ts            # Sample data
├── src/
│   ├── app/
│   │   ├── (dashboard)/   # Protected UI pages
│   │   ├── api/           # REST API routes
│   │   └── login/         # Auth page
│   ├── components/        # UI + layout components
│   ├── lib/               # Auth, permissions, utils, PDF
│   ├── services/          # Business logic (inventory, accounting, etc.)
│   └── generated/prisma/  # Prisma client
```

### Key Design Decisions

- **Monolithic Next.js app** — single deployable unit with API routes and React frontend
- **Service layer** — business rules (stock checks, journal posting, purchase/sale confirmation) live in `src/services/`
- **RBAC middleware** — `withAuth()` wrapper enforces role-based access on every API route
- **Audit trail** — all financial and stock actions log to `AuditLog`
- **Double-entry accounting** — auto-posted journal entries on purchase/sale/payment confirmation

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 2. Clone and install

```bash
cd agribooks-accounting
npm install
```

### 3. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database**
3. Copy the **Connection string** (URI mode, use Transaction pooler for `DATABASE_URL`)
4. Copy the **Direct connection** string for migrations (`DIRECT_URL`)

### 4. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

JWT_SECRET="your-long-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 5. Run migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Seed the database

```bash
npm run db:seed
```

### 7. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Admin Login (Seeded)

| Field | Value |
|-------|-------|
| Email | `admin@agribooks.com` |
| Password | `Admin@123` |

Other seeded users (same password): accountant@, procurement@, warehouse@, sales@, export@, manager@, auditor@agribooks.com

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run unit tests |

## Completed Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Authentication & User Management | ✅ Core |
| 2 | Dashboard | ✅ Full |
| 3 | Produce Management | ✅ Full |
| 4 | Supplier Management | ✅ Full |
| 5 | Customer Management | ✅ Full |
| 6 | Purchase Management | ✅ Full (confirm + inventory + payable) |
| 7 | Inventory/Stock | ✅ Full |
| 8 | Local Sales | ✅ Full (confirm + stock + receivable) |
| 9 | Export Sales | ✅ API structure |
| 10 | Export Shipments | ✅ Data model + API structure |
| 11 | Expenses | ✅ Full |
| 12 | Accounts Payable | ✅ Full + aging |
| 13 | Accounts Receivable | ✅ Full + aging |
| 14 | Invoicing & Documents | ✅ PDF generation |
| 15 | Multi-Currency | ✅ Full |
| 16 | Accounting Ledger | ✅ Full (COA, journal, trial balance) |
| 17 | Reports | ✅ P&L, trial balance, balance sheet |
| 18 | Approvals | ✅ Full workflow |
| 19 | Audit Trail | ✅ Full |
| 20 | Settings | ✅ Data model + UI |
| 21 | Notifications | ✅ Data model |
| 22 | Search | ✅ Global search API |
| 23 | Attachments | ✅ Data model + upload ready |
| 24 | Data Model | ✅ Complete Prisma schema |
| 25 | REST API | ✅ All core endpoints |
| 26 | UI/UX | ✅ Dashboard + all module pages |
| 27 | Business Logic Rules | ✅ Core rules implemented |
| 28 | Sample Data | ✅ Seed script |
| 29 | Testing | ✅ Unit tests |
| 30 | Documentation | ✅ This README |

## API Response Format

Success:
```json
{ "success": true, "message": "Record created successfully", "data": {} }
```

Error:
```json
{ "success": false, "message": "Validation failed", "errors": [] }
```

## Known Limitations & Next Steps

1. **Export sales/shipment UI forms** — API routes scaffolded; full CRUD forms can be added
2. **Email notifications** — notification model exists; email integration not wired
3. **Supabase Storage** — upload helper ready; file upload UI forms pending
4. **Advanced reports** — P&L and trial balance work; PDF export for all reports pending
5. **Password reset** — token fields on User model; reset flow UI not built
6. **CSV import** — produce import endpoint can be added to existing produce API

## License

Private — AgriBooks Produce Ltd
# onesource-acc-HR
