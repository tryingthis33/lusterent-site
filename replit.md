# LUSTER ENT LLC Portfolio Platform

## Overview

This is a portfolio showcase website for LUSTER ENT LLC, a holding company that displays their digital ventures and investments. The platform features a luxury dark-mode design with gold accents, allowing visitors to browse company websites, learn about the organization, and submit investment inquiries. The application follows a monorepo structure with a React frontend and Express backend sharing TypeScript types and validation schemas.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for smooth transitions and interactions
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express 5 running on Node.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints defined in shared routes configuration
- **Validation**: Zod schemas for request/response validation
- **Development**: Hot module replacement via Vite middleware in development

### Data Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (connection via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### Shared Code
- **Location**: `shared/` directory contains code used by both frontend and backend
- **Schema**: Database tables and Zod validation schemas in `shared/schema.ts`
- **Routes**: API route definitions with type-safe request/response contracts in `shared/routes.ts`

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/   # React components including shadcn/ui
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions and query client
│   │   └── pages/        # Page components
├── server/           # Express backend
│   ├── db.ts         # Database connection
│   ├── routes.ts     # API route handlers
│   ├── storage.ts    # Data access layer
│   └── index.ts      # Server entry point
├── shared/           # Shared TypeScript code
│   ├── schema.ts     # Drizzle schemas and Zod validation
│   └── routes.ts     # API route contracts
└── migrations/       # Database migrations
```

### LENT Credit
- New brand: USD-denominated revolving credit lines (5 tiers from $20 starter to multi-million) spendable at portfolio businesses, with $Pc cashback.
- Pages: `/lent-credit` (brand + multi-step KYC application) and `/lent-credit/dashboard` (authenticated cardholder dashboard).
- Tables: `creditApplications`, `creditAccounts`, `creditTransactions` in `shared/schema.ts`.
- `creditTransactions.type` column distinguishes `"charge"` from `"payment"` transactions (defaults to `"charge"` for backward compatibility).
- Cardholders can make payments via POST `/api/lent-credit/make-payment` (`makePaymentSchema` validates `amountCents`). Payments reduce balance and create a payment transaction. Amount cannot exceed current balance.
- BaaS abstraction lives in `server/lentCredit/provider.ts` — single-file swap point for Unit / Synapse / Bond / Treasury Prime. Default implementation is a mock. Provider interface includes `recordPayment()` alongside `recordTransaction()`.
- Money is stored in integer USD cents; `$Pc` rewards are stored as integer token amounts.
- SSN is collected for KYC but is stripped from every API response. Admins see only the last 4 digits via `AdminCreditApplication.ssnLast4`.
- **Compliance features**: application form includes an e-sign step (typed legal name + consent checkbox agreeing to credit/FCRA/E-SIGN terms) before submission. Adverse-action, ECOA, and FCRA disclosure copy is part of the application flow.
- **Two-track membership**:
  - Good-credit applicants → admin-approved, no-fee real spendable credit line (tiered).
  - Everyone else → paid credit-builder membership (`creditMemberships` table): report-only tradeline to the bureaus, no spending, payable via Stripe/card or $Pc. Keeps the tradeline reporting on-time (0 DPD).
  - Builder-tier pricing ladder (Starter $5.99 … Diamond $299.99, 6 tiers) is planned in Task #17 and not yet implemented.
- Bureau reporting is mocked in the provider abstraction until a real BaaS/SFTP partner is connected.

### Admin (Partner Portal)
- Admins are determined by email allowlist via the `ADMIN_EMAILS` env var (comma-separated). Default allowlist is `lusterent@gmail.com` if unset.
- `GET /api/admin/me` returns `{ isAdmin: boolean }` for the current session.
- LENT Credit admin endpoints (all require admin):
  - `GET /api/lent-credit/admin/applications`, `PATCH /api/lent-credit/admin/applications/:id` (status pending/approved/denied, decisionNotes). Approving an application with a `userId` auto-creates a `creditAccount` if none exists.
  - `GET /api/lent-credit/admin/accounts`, `PATCH /api/lent-credit/admin/accounts/:id` (status active/frozen/closed for freeze/unfreeze).
  - `GET /api/lent-credit/admin/transactions` (most recent 100).
- Admin UI lives in `client/src/components/admin/LentCreditAdmin.tsx` and is rendered inside `client/src/pages/PartnerPortal.tsx` only when `adminStatus.isAdmin` is true.

### Design System
- **Theme**: Luxury dark mode with gold accent colors (#D4AF37)
- **Typography**: Playfair Display for headings, DM Sans for body text
- **Component Style**: shadcn/ui New York style variant
- **CSS Variables**: Theme colors defined in `client/src/index.css`

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection string via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe query builder and schema management

### UI Libraries
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-styled component library
- **Framer Motion**: Animation library
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the entire codebase

### Runtime Dependencies
- **TanStack React Query**: Async state management
- **React Hook Form**: Form handling with Zod resolver
- **Wouter**: Lightweight React router
- **date-fns**: Date manipulation utilities