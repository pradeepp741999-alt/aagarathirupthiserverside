# Aagara Thirupthi Backend 🚀
**Hyper-local Event Services Marketplace API Engine**

Production-ready Node.js & TypeScript backend for **Aagara Thirupthi**, powering both the **Customer (User) React Native Mobile App** and the **Provider (Partner) React Native Mobile App** across Tamil Nadu event service categories: Catering, Bridal Makeup, Event Decoration, and Audio/Photography.

---

## 📌 Architectural Overview & Contract Preservation

This backend strictly preserves the contracts of both already-built React Native mobile applications without altering API paths, request bodies, or response schemas.

### Key Architectural Tenets (Decisions D1 – D20)

1. **Role-Aware Dual Dispatch (D1 & D2):**
   - The same endpoint URLs (e.g. `/api/v1/enquiries`, `/api/v1/categories`, `/api/v1/auth/*`) dynamically serve both User and Provider apps based on verified role.
   - Resolved via JWT claims or the `X-App-Role: user | provider` request header. Mismatches strictly reject with `403 ROLE_MISMATCH`.
2. **Dual Response Envelope & Casing (D3 & D4):**
   - **Provider Role:** All responses wrapped in `{ "success": true, "data": ..., "message"?: string, "meta"?: { "total": N, "page": P, "total_pages": T } }` and transformed to deep `snake_case`.
   - **User Role:** Returns raw `camelCase` objects or arrays matching client-side TypeScript models.
3. **Canonical State Machine (D6, D7 & D8):**
   - Centralized canonical enquiry states (`submitted`, `provider_reviewing`, `quote_sent`, `accepted`, `confirmed`, `completed`, `cancelled`, `rejected`) safely mapped to the specific terminology of each app.
   - Customer accepting a quote sets `accepted`. Only provider confirmation moves the status to `confirmed` and auto-reserves the calendar date.
4. **Timezone & Data Normalization (D11 & D12):**
   - All calendar, event, and booking dates are calculated strictly in **Indian Standard Time** (`Asia/Kolkata`).
   - Sequential, human-readable codes generated atomically (`ENQ-100001`, `BKG-100001`, `REC-100001`, `INV-100001`, `TKT-100001`).
5. **Zero-Leak Security (D19 & AES-256-GCM):**
   - Aadhaar, PAN, GST, FSSAI, and trade license numbers are encrypted using AES-256-GCM at rest. Only masked values ever reach public or provider APIs.
   - Unapproved providers are restricted from catalog, calendar, and business endpoints.

---

## 🛠 Tech Stack

- **Runtime:** Node.js 20+ LTS
- **Language:** TypeScript 5.6 (strict mode enabled)
- **Framework:** Express 4.21+
- **Database:** MongoDB 7.0+ with Mongoose 8.7+ (replica set transactions supported)
- **Validation:** Zod 3.23+ schemas with custom per-role error formatters
- **Security:** Helmet, CORS, express-mongo-sanitize, express-rate-limit, AES-256-GCM
- **PDF Generation:** PDFKit 0.15+ (invoices and analytics reports)
- **Testing:** Vitest 2.1+, Supertest 7.0+
- **Logging:** Pino 9.5+ with structured PII redaction

---

## 📁 Project Structure

```
AagaraThirupthiBackend/
├── docs/                        # Architecture logs & Postman collections
│   ├── DECISIONS_LOG.md         # Documented architectural choices (D1-D20)
│   └── api-collection/          # Postman collection JSON
├── scripts/                     # Shell initialization utilities
│   ├── gen-secrets.sh           # Generate 32-byte secure base64 keys
│   └── mongo-init-replset.sh    # MongoDB replica set setup script
├── src/
│   ├── app.ts                   # Express app configuration & middleware pipeline
│   ├── server.ts                # Server startup & graceful shutdown
│   ├── common/
│   │   ├── errors/              # AppError & ERROR_CODES
│   │   ├── http/                # Pagination & per-role respond helpers
│   │   ├── middleware/          # roleContext, caseTransform, rateLimiters, authenticate
│   │   └── utils/               # crypto, dates, distance, mask, money, counters
│   ├── config/                  # env, db, logger, constants
│   ├── jobs/                    # node-cron scheduled tasks (document expiry, stale enquiries)
│   ├── models/                  # Mongoose schemas with indexed models
│   ├── modules/                 # Modular domain features
│   │   ├── admin/               # Admin verification & platform management
│   │   ├── analytics/           # Reports & revenue analytics
│   │   ├── auth/                # OTP authentication & session management
│   │   ├── availability/        # Month availability & date blocking
│   │   ├── bookings/            # Booking management, payments, invoice PDF
│   │   ├── catalog/             # Dishes, packages, special combos
│   │   ├── crm/                 # Customer relationship management
│   │   ├── dashboard/           # Provider home metrics
│   │   ├── earnings/            # Payouts & financial summaries
│   │   ├── enquiries/           # Shared role-aware enquiries lifecycle
│   │   ├── master/              # Categories, districts, FAQs, onboarding
│   │   ├── media/               # Upload URLs & dev local storage driver
│   │   ├── notifications/       # Role-aware notification inbox
│   │   ├── providers/           # Provider registration, me, public discovery
│   │   ├── requirements/        # Requirement form drafts
│   │   ├── reviews/             # User reviews & provider replies
│   │   ├── support/             # Tickets & help queries
│   │   └── users/               # Customer profiles & geo-locations
│   ├── routes/
│   │   └── index.ts             # Central router mounting sub-routers in strict priority
│   └── seed/                    # Master seed & demo providers dataset
└── tests/
    ├── contract/                # Route precedence & ordering tests
    ├── integration/             # Supertest route & middleware tests
    └── unit/                    # Unit tests for caseConvert, crypto, distance, dates
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **MongoDB** >= 7.0 (Standalone or Replica Set for transaction support)

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure required secrets are configured (min 32 characters for JWT, 32-byte base64 string for `DOC_ENCRYPTION_KEY`).

### 3. Running MongoDB with Replica Set (Local Development)
You can start a local replica set using Docker Compose:
```bash
docker compose up -d
```
Or run the replica set initialization script:
```bash
bash scripts/mongo-init-replset.sh
```

### 4. Database Seeding
Populate master categories, Tamil Nadu districts, FAQs, onboarding slides, initial admin user, and full demo data (Salem providers, packages, combos, and reviews):
```bash
# Seed master data only
npm run seed

# Seed master data + demo marketplace data
npm run seed:demo
```

### 5. Running the Application
```bash
# Development mode with live reload
npm run dev

# Production build and run
npm run build
npm start
```
The server will start at `http://localhost:4000/api/v1` with a health check at `GET /api/v1/health`.

---

## 🧪 Testing & Verification

Run the complete test suite covering unit utilities, contract router ordering, and HTTP integration:
```bash
npm test
```
To run TypeScript compiler verification without emitting files:
```bash
npm run typecheck
```
To build production artifacts:
```bash
npm run build
```

---

## 📱 Client Screen to API Mapping

### User Mobile App (19 Screens)
| Screen | Methods & Endpoints |
| :--- | :--- |
| **Onboarding** | `GET /app/onboarding` |
| **Login / OTP** | `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/resend-otp` |
| **Profile Setup** | `POST /user/profile` |
| **Dashboard** | `GET /categories`, `GET /combos/special`, `GET /providers/nearby`, `GET /enquiries/summary`, `GET /notifications/unread-count`, `PATCH /user/location` |
| **Explore** | `GET /providers`, `GET /categories`, `GET /districts` |
| **Category Select**| `GET /categories/details` |
| **Requirement Form** | `GET /config/event-types`, `GET /districts`, `POST /requirements/draft` |
| **Search Results** | `POST /providers/match`, `GET /providers/filters-meta` |
| **Provider Detail**| `GET /providers/:id`, `GET /providers/:id/calendar`, `GET /providers/:id/reviews` |
| **Dish Selection** | `GET /providers/:id/menu`, `GET /providers/:id/packages` |
| **Enquiry Form** | `GET /providers/:id/availability`, `POST /enquiries` |
| **Enquiry Details**| `GET /enquiries/:id`, `PATCH /enquiries/:id/status` |
| **Rating & Review**| `POST /reviews` |
| **Notifications** | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/mark-all-read` |
| **Profile / Edit** | `GET /user/profile`, `PUT /user/profile`, `POST /auth/logout` |

### Provider Mobile App (32 Screens)
| Screen | Methods & Endpoints |
| :--- | :--- |
| **Registration 1-7**| `GET /providers/registration/draft`, `PUT /providers/registration/step/:n`, `GET /providers/registration/summary`, `POST /providers/registration/submit` |
| **Pending Approval**| `GET /providers/me/status`, `POST /support/enquiry` |
| **Home Dashboard** | `GET /providers/me`, `GET /dashboard/metrics`, `GET /enquiries`, `GET /bookings`, `PATCH /providers/me/online-status` |
| **Enquiries** | `GET /enquiries`, `GET /enquiries/counts`, `GET /enquiries/:id`, `PATCH /enquiries/:id/status`, `POST /enquiries/:id/quote`, `POST /enquiries/:id/messages` |
| **Bookings** | `GET /bookings`, `GET /bookings/counts`, `GET /bookings/:id`, `PATCH /bookings/:id/status`, `POST /bookings/:id/payments`, `GET /bookings/:id/invoice` |
| **CRM Customers** | `GET /crm/customers`, `GET /crm/stats`, `GET /crm/customers/:id`, `GET /crm/customers/:id/history`, `GET/POST /crm/customers/:id/notes` |
| **Catalog** | `GET/POST/PUT/DELETE /providers/dishes(/:id)`, `GET/POST/PUT/DELETE /providers/packages(/:id)`, `GET/POST/PUT/DELETE /providers/combos(/:id)` |
| **Availability** | `GET /providers/availability/month`, `PUT /providers/availability/date`, `POST /providers/availability/bulk` |
| **Reviews** | `GET /providers/reviews`, `GET /providers/reviews/summary`, `POST /providers/reviews/:id/reply` |
| **Earnings** | `GET /providers/earnings/summary`, `GET /providers/earnings/transactions` |
| **Reports** | `GET /analytics/overview`, `GET /analytics/revenue-chart`, `GET /analytics/export` |
| **Documents** | `GET /providers/documents`, `PUT /providers/documents/:type` |
| **Settings** | `GET/PUT /providers/settings`, `GET/PUT /providers/me` |
| **Help & Support** | `GET /support/faqs`, `POST /support/tickets` |

---

## 📬 Postman Collection

Import the included Postman Collection at `docs/api-collection/Aagara_Thirupthi_API.postman_collection.json`. It includes pre-configured environment variables for `baseUrl`, `userToken`, `providerToken`, and `adminToken`.
