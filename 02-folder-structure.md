# 02 — Folder Structure

Single repository, single deployable. Feature-based modules; one Mongoose model per file in a flat `models/` folder; cross-cutting code in `common/`; third-party integrations behind adapters in `services/`.

## 1. Overall tree

```
aagara-backend/
├── AGENT_PROMPT.md                      # entry point for the coding agent
├── README.md                            # written by agent at the end
├── package.json
├── tsconfig.json                        # strict, paths: "@/*" -> "src/*"
├── .env.example                         # every variable from doc 09 §3
├── .gitignore
├── .eslintrc.cjs   .prettierrc
├── vitest.config.ts
├── Dockerfile
├── docker-compose.yml                   # api + mongo (replica set rs0) + mongo-init
│
├── docs/
│   ├── 01-overview-and-decisions.md
│   ├── 02-folder-structure.md
│   ├── 03-database-design.md
│   ├── 04-api-conventions.md
│   ├── 05-shared-endpoints.md
│   ├── 06-user-side.md
│   ├── 07-provider-side.md
│   ├── 08-business-rules.md
│   ├── 09-build-plan.md
│   ├── DECISIONS_LOG.md                 # agent appends deviations here
│   ├── api-collection/                  # Postman/Bruno export (agent creates)
│   └── reference/                       # ORIGINAL client docs (read-only)
│       ├── user-app_API_DOCUMENTATION.md
│       ├── user-app_PROJECT_DOCUMENTATION.md
│       ├── provider-app_SCREEN_API_DOCUMENTATION.md
│       └── provider-app_BACKEND_SPECIFICATION_legacy.md
│
├── scripts/
│   ├── mongo-init-replset.sh            # rs.initiate for docker
│   └── gen-secrets.sh                   # prints JWT / encryption keys
│
├── src/
│   ├── server.ts                        # connect DB, start HTTP, start cron, graceful shutdown
│   ├── app.ts                           # express app: security, parsers, role ctx, routes, errors
│   │
│   ├── config/
│   │   ├── env.ts                       # zod-validated process.env (fail fast)
│   │   ├── db.ts                        # mongoose connect + index sync
│   │   ├── logger.ts                    # pino + PII redaction
│   │   └── constants.ts                 # enums, REQUIRED_DOC_TYPES, limits, palettes
│   │
│   ├── common/
│   │   ├── middleware/
│   │   │   ├── roleContext.ts           # resolves req.appRole (D2)
│   │   │   ├── authenticate.ts          # verifies JWT -> req.auth {sub, role, sid}
│   │   │   ├── optionalAuth.ts          # same but never 401s
│   │   │   ├── requireRole.ts           # requireRole('provider')
│   │   │   ├── requireApprovedProvider.ts
│   │   │   ├── byRole.ts                # byRole({user: h1, provider: h2}) dispatcher (D1)
│   │   │   ├── validate.ts              # zod: validate({body, query, params})
│   │   │   ├── caseTransform.ts         # provider: snake->camel in, camel->snake out (D4)
│   │   │   ├── rateLimiters.ts          # otpLimiter, apiLimiter
│   │   │   ├── notFound.ts
│   │   │   └── errorHandler.ts          # per-role error shape (D5)
│   │   ├── errors/
│   │   │   ├── AppError.ts
│   │   │   └── errorCodes.ts
│   │   ├── http/
│   │   │   ├── respond.ts               # ok/created/list -> per-role envelope (D3)
│   │   │   └── pagination.ts
│   │   ├── utils/
│   │   │   ├── asyncHandler.ts
│   │   │   ├── caseConvert.ts           # camelToSnake / snakeToCamel (deep)
│   │   │   ├── dates.ts                 # IST helpers, ymd(), eachDay(), relativeTime()
│   │   │   ├── distance.ts              # haversineKm()
│   │   │   ├── money.ts                 # formatINR()
│   │   │   ├── mask.ts                  # maskAadhaar/PAN/mobile
│   │   │   ├── crypto.ts                # AES-256-GCM encrypt/decrypt for doc numbers
│   │   │   ├── objectId.ts              # isValidObjectId guard
│   │   │   └── counters.ts              # nextCode('enquiry') -> ENQ-100001
│   │   └── types/
│   │       └── express.d.ts             # req.auth, req.appRole
│   │
│   ├── models/                          # Mongoose schemas (doc 03) — one per file
│   │   ├── User.ts
│   │   ├── Provider.ts
│   │   ├── ProviderDocument.ts
│   │   ├── Dish.ts
│   │   ├── MenuPackage.ts
│   │   ├── SpecialCombo.ts
│   │   ├── ProviderAvailability.ts
│   │   ├── Enquiry.ts
│   │   ├── Booking.ts
│   │   ├── Payout.ts
│   │   ├── CrmCustomer.ts
│   │   ├── Review.ts
│   │   ├── Notification.ts
│   │   ├── OtpSession.ts
│   │   ├── Session.ts
│   │   ├── Category.ts
│   │   ├── District.ts
│   │   ├── OnboardingSlide.ts
│   │   ├── RequirementDraft.ts
│   │   ├── SupportTicket.ts
│   │   ├── Faq.ts
│   │   ├── MediaUpload.ts
│   │   ├── Admin.ts
│   │   ├── Counter.ts
│   │   └── index.ts
│   │
│   ├── modules/                         # feature modules (template in §4)
│   │   ├── auth/            # send/verify/resend OTP, logout, refresh, push-token
│   │   ├── master/          # onboarding, categories, districts, event config, filters-meta, faqs
│   │   ├── media/           # upload-url + local upload
│   │   ├── users/           # customer profile + location
│   │   ├── requirements/    # requirement draft validation (user)
│   │   ├── providers/
│   │   │   ├── public/      # directory, nearby, match, detail, menu, packages, reviews list (user side)
│   │   │   ├── registration/# steps 1-6, draft, summary, submit (provider side)
│   │   │   ├── me/          # profile, status, online-status, settings
│   │   │   └── documents/   # list + update document (provider side)
│   │   ├── catalog/
│   │   │   ├── dishes/      # provider CRUD + toggle
│   │   │   ├── packages/
│   │   │   └── combos/      # provider CRUD + public GET /combos/special
│   │   ├── availability/    # month, date, bulk, user calendar + range check
│   │   ├── enquiries/       # role-aware: user.* and provider.* controllers
│   │   ├── bookings/        # provider: list, counts, detail, status, payments, invoice
│   │   ├── crm/             # provider: customers, stats, history, notes
│   │   ├── reviews/         # user submit; provider list/summary/reply
│   │   ├── notifications/   # role-aware feed
│   │   ├── dashboard/       # provider home metrics
│   │   ├── analytics/       # overview, revenue-chart, export
│   │   ├── earnings/        # summary, transactions
│   │   ├── support/         # tickets + support enquiry
│   │   └── admin/           # additive admin API (A5)
│   │
│   ├── services/                        # adapters & cross-module domain services
│   │   ├── sms/             # index.ts (interface) + console.ts msg91.ts fast2sms.ts twilio.ts
│   │   ├── push/            # expo.ts
│   │   ├── storage/         # index.ts (interface) + local.ts s3.ts
│   │   ├── pdf/             # invoice.ts, report.ts (pdfkit)
│   │   ├── token.service.ts # sign/verify access+refresh
│   │   ├── notify.service.ts# createNotification(+push) used by all modules
│   │   ├── matching.service.ts   # provider match/rank (doc 08 §4)
│   │   ├── calendar.service.ts   # block/free dates, range checks
│   │   ├── rating.service.ts     # recompute provider rating aggregates
│   │   └── crm.sync.service.ts   # upsert CRM customer on enquiry/booking events
│   │
│   ├── routes/
│   │   └── index.ts                     # mounts everything in the order of doc 04 §10
│   │
│   ├── jobs/
│   │   ├── index.ts                     # node-cron registrations
│   │   ├── documentExpiry.job.ts
│   │   └── staleEnquiry.job.ts
│   │
│   └── seed/
│       ├── index.ts                     # npm run seed [-- --demo]
│       ├── master.seed.ts               # categories, districts, event configs, slides, faqs
│       ├── districts.data.ts            # 38 TN districts + Salem areas
│       └── demo.seed.ts                 # demo users/providers/dishes/combos/enquiries
│
└── tests/
    ├── setup.ts                         # mongodb-memory-server (replset), helpers
    ├── helpers/                         # loginAs(user|provider), factories, snapshot of contract keys
    ├── contract/                        # key-set assertions vs reference docs
    ├── integration/                     # per module
    └── e2e/
        ├── customer-journey.test.ts
        └── provider-registration.test.ts
```

## 2. Layer rules

| Layer | May import | Must not |
| :-- | :-- | :-- |
| `routes/*` (inside a module) | middleware, controller, validation | touch models |
| `*.controller.ts` | service, dto, `respond` | contain business logic or queries |
| `*.service.ts` | models, other services, adapters | read `req`/`res` |
| `*.dto.ts` | plain types | query DB |
| `models/*` | mongoose only | import modules/services |
| `services/*` (adapters) | `config`, SDKs | import modules |

## 3. Naming

- Files: `kebab`/`camel` per above; classes/types `PascalCase`; DB fields `camelCase`; collections `snake_case` plural (`provider_documents`).
- Routes are lowercase, kebab where multi-word (`mark-all-read`, `online-status`).
- Env vars `UPPER_SNAKE`.

## 4. Module template

```
modules/<feature>/
├── <feature>.routes.ts        # express.Router; applies validate()/authenticate()/byRole()
├── <feature>.controller.ts    # thin: parse -> service -> respond
├── <feature>.service.ts       # business logic, transactions
├── <feature>.validation.ts    # zod schemas (strict) for body/query/params
├── <feature>.dto.ts           # toUserDto / toProviderDto mappers (camelCase out)
└── <feature>.test.ts          # (or in tests/integration)
```

Role-aware modules (`enquiries`, `notifications`, `auth`, `master`) split controllers/DTOs:

```
modules/enquiries/
├── enquiries.routes.ts           # uses byRole({user: userCtrl.x, provider: providerCtrl.x})
├── enquiries.user.controller.ts
├── enquiries.provider.controller.ts
├── enquiries.service.ts          # shared domain logic (state machine in doc 08 §1)
├── enquiries.statusMap.ts        # canonical <-> user/provider labels (doc 04 §8)
├── enquiries.validation.ts
└── enquiries.dto.ts              # toUserDto, toProviderDto
```

## 5. Scripts (`package.json`)

```
dev          tsx watch src/server.ts
build        tsc -p tsconfig.build.json
start        node dist/server.js
lint         eslint . --ext .ts
typecheck    tsc --noEmit
test         vitest run
test:watch   vitest
seed         tsx src/seed/index.ts
seed:demo    tsx src/seed/index.ts --demo
```
