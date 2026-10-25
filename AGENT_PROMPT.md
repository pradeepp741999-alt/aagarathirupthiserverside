# AGENT PROMPT — Build the Aagara Thirupthi Backend

> Feed this file to the agent first. It is the entry point. Everything else is in `docs/`.

## 1. Mission

Build **one** Node.js + MongoDB backend that serves **two existing React Native apps**:

| App | Who uses it | Role value |
| :-- | :-- | :-- |
| **User app** (customer) | Families / organizers in Salem & Tamil Nadu who search, enquire, book event services | `user` |
| **Provider app** | Caterers, decorators, sound engineers, makeup artists who register, manage catalog, answer enquiries, run bookings | `provider` |

The product is **Aagara Thirupthi (ஆகார திருப்தி)**, a hyper-local event-service marketplace (categories: `catering`, `decoration`, `audio`, `makeup`).

The two client apps are **already built** and currently run on mock data. The backend must match their documented API contracts **without requiring client changes**, except one tiny one: both apps must send the header `X-App-Role: user|provider`.

## 2. Stack (fixed — do not substitute)

- Node.js 20 LTS, **TypeScript (strict)**, Express 4
- MongoDB 7 + Mongoose 8 (**replica set required** for transactions; docker-compose provides it)
- Zod (validation), jsonwebtoken, bcryptjs, pino, helmet, cors, express-rate-limit, express-mongo-sanitize, dayjs, pdfkit, multer (dev uploads), @aws-sdk/client-s3 + s3-request-presigner (prod uploads), expo-server-sdk (push), node-cron
- Tests: Vitest + Supertest + mongodb-memory-server (replica set mode)

## 3. Reading order (mandatory)

1. `docs/01-overview-and-decisions.md` — what the system is, **how conflicts between the two apps were resolved** (decisions D1…D20). These override the reference docs wherever they disagree.
2. `docs/02-folder-structure.md` — exact project layout. Create it as written.
3. `docs/03-database-design.md` — all MongoDB collections, fields, indexes.
4. `docs/04-api-conventions.md` — roles, auth, envelopes, casing, errors, status maps, route order. **Cross-cutting code is built from this.**
5. `docs/05-shared-endpoints.md` — auth, master data, media, enquiries, notifications (used by both apps).
6. `docs/06-user-side.md` — customer app endpoints and rules.
7. `docs/07-provider-side.md` — provider app endpoints and rules.
8. `docs/08-business-rules.md` — lifecycle, calendar, matching, staffing, ratings, CRM, notifications, analytics formulas, cron jobs.
9. `docs/09-build-plan.md` — phased plan with acceptance criteria, env vars, seed data, tests.

**Payload shapes** (exact JSON field names for every request/response) live in the originals in `docs/reference/`:

| File | Authoritative for |
| :-- | :-- |
| `user-app_API_DOCUMENTATION.md` | User app request/response JSON |
| `user-app_PROJECT_DOCUMENTATION.md` | User app TypeScript models (`Enquiry`, `EventRequirement`, `SpecialCombo`) |
| `provider-app_SCREEN_API_DOCUMENTATION.md` | Provider app request/response JSON (79 APIs) |
| `provider-app_BACKEND_SPECIFICATION_legacy.md` | **Legacy.** Use only for business ideas (CRM stages, document fields). Its `/api/v1/provider/*` paths and Postgres DDL are **NOT** implemented. |

Rule of precedence: **docs 01–09 > reference docs**. If a reference doc and docs 01–09 disagree, follow docs 01–09 and log it in `docs/DECISIONS_LOG.md`.

## 4. Non-negotiable rules

1. **Do not invent endpoints** beyond those listed in docs 05–07 (the "additive" ones in doc 01 §6 are allowed).
2. **Role-aware shared routes (D1):** the same URL (e.g. `GET /api/v1/enquiries`) serves both apps. Dispatch on the authenticated role. Never create `/user/...` or `/provider/...` duplicates of those URLs.
3. **Per-role response shape (D3–D5):** provider responses are `{ success, data, message?, meta? }` in **snake_case**; user responses are the **raw payload** in **camelCase**. Controllers return camelCase DTOs; a central response layer does the rest. Never hand-write snake_case in controllers.
4. **One source of truth for states:** use the canonical enquiry status enum and the maps in doc 04 §8. Never store per-app status strings.
5. **Multi-tenancy:** every provider-owned query is scoped by `providerId = req.auth.sub`. Every user-owned query by `userId = req.auth.sub`. Never trust ids in bodies for ownership (e.g. `providerId` inside `POST /combos/special` is ignored).
6. **Never return Mongoose documents.** Map to DTOs (`*.dto.ts`) with explicit field lists.
7. **Money** = integer rupees (no paise) unless a doc says otherwise. **Event dates and calendar days** = `"YYYY-MM-DD"` strings in IST; **timestamps** = UTC `Date`/ISO.
8. **Security:** Aadhaar/PAN/GST numbers are encrypted at rest and masked in every response (doc 03 §provider_documents). OTPs are hashed. No secrets or OTPs in logs. See doc 04 §12.
9. **Transactions** for multi-document writes (confirm booking, record payment, submit review) — see doc 08.
10. Keep each file small and single-purpose. Follow the module template in doc 02 §4.

## 5. Working method

1. Execute `docs/09-build-plan.md` phase by phase. Do not start phase N+1 until phase N's acceptance checklist passes (`npm run lint && npm run typecheck && npm test`).
2. After each phase, commit with message `phase-N: <title>`.
3. Write tests alongside code. Every endpoint gets at least one integration test; every provider endpoint also gets a **contract test** that asserts the response key set matches the example in `provider-app_SCREEN_API_DOCUMENTATION.md`; every user endpoint likewise against `user-app_API_DOCUMENTATION.md`.
4. Where a doc is genuinely ambiguous, choose the default stated in doc 01 §8 ("Open questions"), implement it behind a single constant/config, and note it in `docs/DECISIONS_LOG.md`. Do **not** stop to ask unless the answer blocks all progress.
5. When finished, produce `README.md` (setup, scripts, env, how to run both clients against it) and a Postman/Bruno collection under `docs/api-collection/`.

## 6. Definition of done

- [ ] `docker compose up` starts API + MongoDB replica set; `npm run seed` loads master data + demo data.
- [ ] All **99 client-contract endpoints** from docs 05–07 respond per contract; the 15 additive endpoints exist as described in doc 01 §6.
- [ ] End-to-end journey test passes: user OTP login → profile → search → enquiry → provider quote → customer accept → provider confirm (booking + calendar blocked) → payment recorded → booking completed → user review → provider reply.
- [ ] Provider registration journey passes: OTP → steps 1–6 → submit → admin approve → provider can use catalog/enquiry endpoints.
- [ ] Lint, typecheck and all tests green; no `any` in `src/` except at documented boundaries.
- [ ] No endpoint returns another tenant's data (isolation tests exist).
