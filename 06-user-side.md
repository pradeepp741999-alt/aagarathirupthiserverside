# 06 — User Side (Customer App)

Role `user`. Responses are **raw camelCase JSON** (D3/D4). Payload examples: `reference/user-app_API_DOCUMENTATION.md`. Shared routes (auth, master data, enquiries, notifications, combos GET) are in doc 05 — this doc lists everything **user-specific** plus the screen map.

## 1. Journey

```
Onboarding → Login(OTP) → Profile setup → Dashboard (GPS/locality, categories, combos, nearby)
  → Category → Requirement form (dates, guests, makeup staffing, budget)
  → Search results (match & rank) → Provider detail (calendar, reviews)
  → [Catering: dish/package selection + cart] → Enquiry form → Success
  → Enquiries list → Enquiry detail (quote, accept/cancel, call/WhatsApp)
  → (after completion) Rating & Review → Notifications / Profile
```

## 2. Screen → API map (19 screens)

| # | Screen | APIs (see doc 05 for ★ shared) |
| :-: | :-- | :-- |
| 1 | Onboarding | ★`GET /app/onboarding` |
| 2 | Login | ★`POST /auth/send-otp` |
| 3 | OTP | ★`POST /auth/verify-otp`, ★`POST /auth/resend-otp` |
| 4 | Profile Setup | `POST /user/profile` |
| 5 | Dashboard | ★`GET /categories`, ★`GET /combos/special`, `GET /providers/nearby`, `GET /enquiries/summary`, ★`GET /notifications/unread-count`, `PATCH /user/location`, (provider-mode: ★`POST /combos/special`) |
| 6 | Explore | `GET /providers`, ★`GET /categories`, ★`GET /districts` |
| 7 | Category Select | ★`GET /categories/details` |
| 8 | Requirement Form | ★`GET /config/event-types`, ★`GET /districts`, `POST /requirements/draft` |
| 9 | Search Results | `POST /providers/match`, ★`GET /providers/filters-meta` |
| 10 | Provider Detail | `GET /providers/:id`, `GET /providers/:id/calendar`, `GET /providers/:id/reviews`, (provider-mode: `PUT /providers/:id/calendar/date`) |
| 11 | Dish Selection | `GET /providers/:id/menu`, `GET /providers/:id/packages` |
| 12 | Enquiry Form | `GET /providers/:id/availability`, ★`POST /enquiries` |
| 13 | Enquiry Success | ★`GET /enquiries/:id` |
| 14 | Enquiries List | ★`GET /enquiries` |
| 15 | Enquiry Detail | ★`GET /enquiries/:id`, ★`PATCH /enquiries/:id/status` |
| 16 | Rating & Review | ★`GET /enquiries/:id`, `POST /reviews` |
| 17 | Notifications | ★`GET /notifications`, ★`PATCH /notifications/:id/read`, ★`PATCH /notifications/mark-all-read` |
| 18 | Profile | `GET /user/profile`, ★`POST /auth/logout` |
| 19 | Edit Profile | `PUT /user/profile` |

## 3. User-only endpoints (16)

| # | Method & Path | Auth | Summary |
| :-: | :-- | :-: | :-- |
| 1 | `POST /user/profile` | U | Complete profile (201). |
| 2 | `GET /user/profile` | U | Profile + stats. |
| 3 | `PUT /user/profile` | U | Update profile. |
| 4 | `PATCH /user/location` | U | Save manual locality / GPS. |
| 5 | `POST /requirements/draft` | U | Validate + store requirement draft. |
| 6 | `GET /providers` | opt | Directory search. |
| 7 | `GET /providers/nearby` | opt | Distance-sorted. |
| 8 | `POST /providers/match` | U | Rank by requirement. |
| 9 | `GET /providers/:id` | opt | Full provider profile. |
| 10 | `GET /providers/:id/calendar` | opt | Month map. |
| 11 | `GET /providers/:id/availability` | opt | Range check. |
| 12 | `GET /providers/:id/reviews` | opt | Public reviews. |
| 13 | `GET /providers/:id/menu` | opt | Dishes by category. |
| 14 | `GET /providers/:id/packages` | opt | Menu packages. |
| 15 | `GET /enquiries/summary` | U | (listed in doc 05 §4) |
| 16 | `POST /reviews` | U | Submit review. |

(opt = `optionalAuth`; data is public.) Item 15 is specified in doc 05 §4 and is counted here so the user-only total is 16.

### 3.1 User profile

- **`POST /user/profile`** body `{name, district, location, whatsapp?}` → creates/completes: sets `profileCompleted=true`, assigns `avatarColor` (random from palette `['#8B5CF6','#EC4899','#F97316','#3B82F6','#10B981','#EAB308']`), `whatsapp` defaults to `mobile`. **201** `{success:true,user:{id,name,mobile,whatsapp,district,location,avatarColor}}`. `district` must exist in `districts`; `location` must be one of that district's `areas` (case-insensitive) else 400. Calling again when already completed → 409 `ALREADY_EXISTS` (client should use PUT).
- **`GET /user/profile`** → `CustomerProfile`: `{id,name,mobile,whatsapp,altMobile,district,location,avatarColor,stats:{totalEnquiries,activeEnquiries,completedEvents,reviewsGiven}}`.
- **`PUT /user/profile`** body `{name, whatsapp, altMobile?, district, location}` → same validations → 200 updated profile.
- **`PATCH /user/location`** body `{district?, location?, lat?, lng?}` (at least one) → updates fields and `geo` (lat −90..90, lng −180..180, rounded to 4 dp). Returns updated profile.

### 3.2 Requirement draft — `POST /requirements/draft`

Body: see U-doc 8.3. Validation (400, message includes the rule):
- `category` ∈ active categories; `eventType` ∈ `categories[category].eventTypes`.
- `eventDate ≥ today(IST)`; `eventEndDate` optional, **`≥ eventDate`** (message: `eventEndDate must be equal or later than eventDate`); max span 7 days.
- `guestCount ≥ 1` (for `makeup` equals persons).
- `budgetMin ≤ budgetMax`.
- **Makeup rules (doc 08 §5):** `makeupPersonsCount ≥ 1`; if `simultaneousStyling` then persons must be ≥ 2; `backupArtistNeeded` is **forced** `true` when `simultaneousStyling && persons ≥ 2`, and `false` otherwise (server overrides client).
- Non-makeup categories ignore makeup fields.
Stores in `requirement_drafts` (TTL 7 d). Returns `{draftId, valid:true, requirement:{…normalized…}, staffing?:{leadArtists,backupArtists,hoursPerPerson}}`.

### 3.3 Provider discovery (public data)

Visibility (D19): `status='approved' AND isActive`. `isOnline=false` providers appear in directory with `isOnline:false`, excluded from `nearby` and `match`.

**Provider summary DTO** (used by directory, nearby, match):
```json
{ "id":"…","name":"Glow & Glamour Bridal Studio","category":"makeup","categories":["makeup"],
  "tagline":"…","rating":4.9,"reviewCount":128,"startingPrice":12000,"pricingModel":"per_event",
  "verified":true,"isOnline":true,"distanceKm":2.1,"isAvailable":true,
  "coverImage":"…","logoColor":"#0E7C7B","district":"Salem","areas":["Fairlands","Hasthampatti"],
  "vegPreference":"both","minCapacity":1,"maxCapacity":3,"responseTime":"Usually responds within 2 hours" }
```
`distanceKm`/`isAvailable` appear only when computable/requested. `pricingModel` emitted as stored (`per_plate|per_event|fixed|hourly`).

1. **`GET /providers`** — query `category`, `district`, `query`, `page`, `limit`, `sort` (`relevance|rating|price`; default `rating`), `minRating`, `veg` (`veg|non_veg|both`), `minPrice`, `maxPrice`. `district` matches providers whose coverage includes it (or `isAllDistricts`). `query` = escaped case-insensitive regex on `businessName`, `tagline`, `cuisineTypes`. Response: `{providers:[summary], page, limit, total, totalPages, hasMore}`.
2. **`GET /providers/nearby`** — query `lat?`, `lng?`, `district?`, `area?`, `category?`, `limit` (default 10, max 30). Origin fallback chain per D13. Candidates: online providers covering `district` (or all, if `district` missing). Compute `distanceKm` (Haversine, 1 dp), sort ascending; providers lacking `geo` are appended by rating. Response: **bare array** of summaries (U-doc 5.4).
3. **`POST /providers/match`** — body = requirement draft (U-doc 8.3 shape, or `{draftId}`); optional `sortBy` (`relevance|rating|distance|price`, default `relevance`), `page`, `limit`. Algorithm: doc 08 §4. Response `{totalMatches, providers:[summary + {isAvailable:true, estimatedStartingTotal}]}`; providers that are otherwise suitable but unavailable on the dates are included **after** available ones with `isAvailable:false` and `unavailableDates:[…]` (UI greys them).
4. **`GET /providers/:id`** — full provider (404 if not visible). Adds to the summary: `ownerName`, `about` (description), `gallery:[coverImage]`, `previousWork:[portfolioImages urls]`, `phone` (mobile), `whatsapp`, `yearsActive`, `serviceAreas:{districts,areas,isAllDistricts,travelsOutstation,outstationFeePerKm}`, `advancePercentage`, `cancellationPolicy`, `paymentTerms`, `advanceNoticeDays`, `specialties`/`cuisineTypes`, `bridalTrialOffered`, `serviceLocation`, `isAvailable` (when `?startDate&endDate` given), `activeCombos:[…]` (≤3).
5. **`GET /providers/:id/calendar?year=&month=`** — `{providerId, dates:{"YYYY-MM-DD":"available|blocked|booked", …}}` for **every day of the month**. Validates month 1–12, year within ±2 of now.
6. **`GET /providers/:id/availability?startDate=&endDate=`** — `{isAvailable, blockedDates:[…]}`; blocked = stored `blocked|booked` days in range **plus** days within the provider's `advanceNoticeDays` window; also adds `reasons:{"2026-11-15":"booked"|"blocked"|"notice_period"}`. `endDate` defaults to `startDate`; max range 7 days.
7. **`GET /providers/:id/reviews`** — `?page&limit&rating`. Response `{summary:{averageRating,totalReviews,breakdown:{"5":n,…},pillars:{quality,communication,value,timeliness}}, reviews:[{id,customerName,avatarColor,rating,ratings,eventType,comment,photos,createdAt,providerReply:{text,repliedAt}|null}], page, limit, total}`.
8. **`GET /providers/:id/menu`** — `[{category:"Main Course", dishes:[{id,name,price,veg,image,isPopular,description}]}]`. Only `isActive` dishes; category slug → label via constants map (`starters→Starters, main→Main Course, rice→Rice, curries→Curries, breads→Breads, sweets→Sweets, drinks→Drinks, non_veg→Non-Veg`; fallback Title Case). Non-catering providers return `[]`. Query `?veg=true|false` optional.
9. **`GET /providers/:id/packages`** — `[{id,name,description,pricePerPerson,minGuests,veg,includedItems:[dish names],dishes:[{id,name,veg}]}]` (`pricePerPerson = pricePerPlate`). Only `isActive`.

### 3.4 Reviews — `POST /reviews`

Body `{enquiryId, providerId, rating(1–5, integer), comment, photos?[], ratings?{quality,communication,value,timeliness}}` (A8).
Rules (all in one **transaction**):
1. Enquiry exists, belongs to caller, `status='completed'`, `providerId` matches (else 404/409 `INVALID_STATUS_TRANSITION`-style 409 `NOT_REVIEWABLE`).
2. No existing review for `enquiryId` → else 409 `REVIEW_ALREADY_EXISTS`.
3. `comment` 10–1000 chars; `photos` ≤ 4, each validated (doc 04 §12.6).
4. Insert review (`customerName/avatarColor` snapshot from user; `eventType` from enquiry); set `enquiry.hasReview=true, reviewId`.
5. `rating.service.recompute(providerId)` — updates `rating` (1 dp), `ratingBreakdown`, `reviewCount`.
6. Notify provider (`review`).
Response **201** `{success:true, review:{id, rating, comment, createdAt}}` (U-doc: "Review confirmation").

## 4. E1 — `POST /enquiries` (user branch of the shared route)

Body: U-doc 12.2 (+ optional `mealType`, `eventTime`, `budgetMin`, `budgetMax`, `draftId`).

Validation & rules (order matters; first failure wins):
1. Provider exists, visible, `isOnline` → else 404 / 409 `PROVIDER_NOT_ACCEPTING`.
2. `category` equals provider's primary or secondary category.
3. Dates valid (doc 04 §11); `eventDate` respects provider `advanceNoticeDays` → 422 `INSUFFICIENT_NOTICE`.
4. **Availability:** every day in `[eventDate, eventEndDate||eventDate]` must be free → 409 `DATE_UNAVAILABLE` with `details:{unavailableDates:[…]}`.
5. Capacity: `guestCount` within `[minCapacity, maxCapacity]` (makeup: `makeupPersonsCount ≤ maxCapacity`) → 422.
6. `items[]`: each `{name, price≥0, qty≥1}`; if `dishId`/`packageId` provided, verify it belongs to the provider and take the **catalog price** (server wins). `estimatedTotal = Σ price×qty` (**server computed**; client value ignored).
7. Makeup: apply the same staffing normalization as the draft (doc 08 §5); store `staffing`; `backupArtistAssigned` = computed.
8. Duplicate guard: same user + provider + `eventDate` with a non-terminal status → 409 `ALREADY_EXISTS`.

Side effects (transaction for DB writes; notify after commit):
- Create enquiry: `status='submitted'` (or `provider_reviewing` when provider `autoAcceptEnquiries`, with system timeline note), `customer` snapshot, timeline `[{kind:'status', status:'submitted', author:'customer', message:'Enquiry submitted by user'}]`, `code = ENQ-…`, `isNewLead=true`.
- `crm.sync.service.upsertOnEnquiry(...)`.
- Notify provider: `new_enquiry` — title `New Enquiry from {customer name}`, message `{eventType} for {guestCount} guests on {Mon D, YYYY}`.
Response **201** `{id, code, status:'submitted', createdAt:'YYYY-MM-DD'}` (U-doc shape; `createdAt` as date string `YYYY-MM-DD` in IST here, ISO elsewhere).

## 5. User-side business rules index

| Topic | See |
| :-- | :-- |
| Status machine, who may do what | doc 08 §1 |
| Calendar semantics | doc 08 §2 |
| Matching & ranking | doc 08 §4 |
| Makeup staffing | doc 08 §5 |
| Notification triggers | doc 08 §7 |
| `activeCount` / `awaitingResponseCount` | doc 08 §8 |
