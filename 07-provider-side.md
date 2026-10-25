# 07 — Provider Side (Provider App)

Role `provider`. Responses use the `{success,data,message?,meta?}` envelope in **snake_case** (D3/D4). Controllers write camelCase; the transformer does the rest. Exact payload examples: `reference/provider-app_SCREEN_API_DOCUMENTATION.md` ("P-doc"). Shared routes (auth, master data, enquiries list/detail/status/messages, notifications, media) are in doc 05.

## 1. Journey

```
Onboarding(local) → Login(OTP) → Registration steps 1–6 → Review & Submit (7)
  → Pending approval (admin) → Home dashboard
  → Catalog (dishes / packages / combos) + Availability calendar
  → Enquiries (view → quote → accepted → confirm) → Bookings (payments, status, invoice)
  → CRM · Reviews (reply) · Reports · Earnings · Documents · Settings · Help
```

## 2. Screen → API map (32 screens, 79 client calls)

| # | Screen | APIs (★ shared, see doc 05) |
| :-: | :-- | :-- |
| 1 | Onboarding | none (local) |
| 2–3 | Login / OTP | ★`send-otp`, ★`verify-otp`, ★`resend-otp` |
| 4 | RegBusinessInfo | `GET registration/draft`, `PUT registration/step/1` |
| 5 | RegCategory | ★`GET /categories`, `PUT step/2` |
| 6 | RegServiceDetails | `PUT step/3` |
| 7 | RegPricing | `PUT step/4` |
| 8 | RegCoverageArea | ★`GET /districts`, `PUT step/5` |
| 9 | RegDocuments | ★`POST /media/upload-url`, `PUT step/6` |
| 10 | RegReview | `GET registration/summary`, `POST registration/submit` |
| 11 | PendingApproval | `GET /providers/me/status`, `POST /support/enquiry` |
| 12 | Home | `GET /providers/me`, `GET /dashboard/metrics`, ★`GET /enquiries`, `GET /bookings`, `GET /providers/combos`, `PATCH /providers/me/online-status` |
| 13 | EnquiriesList | ★`GET /enquiries`, `GET /enquiries/counts` |
| 14 | EnquiryDetail | ★`GET /enquiries/:id`, ★`PATCH …/status`, `POST …/quote`, ★`POST …/messages` |
| 15 | BookingsList | `GET /bookings`, `GET /bookings/counts` |
| 16 | BookingDetail | `GET /bookings/:id`, `PATCH …/status`, `POST …/payments`, `GET …/invoice` |
| 17 | Customers (CRM) | `GET /crm/customers`, `GET /crm/stats` |
| 18 | CustomerDetail | `GET /crm/customers/:id`, `…/history`, `GET/POST …/notes` |
| 19 | ServicesManagement | list / status / delete for dishes, packages, combos |
| 20 | DishEditor | `GET/POST/PUT /providers/dishes(/:id)`, ★`media/upload-url` |
| 21 | PackageEditor | `GET/POST/PUT /providers/packages(/:id)`, `GET /providers/dishes` |
| 22 | ComboEditor | `GET/POST/PUT /providers/combos(/:id)`, ★`media/upload-url` |
| 23 | AvailabilityCalendar | `GET availability/month`, `PUT availability/date`, `POST availability/bulk` |
| 24 | Reviews | `GET /providers/reviews`, `…/summary`, `POST …/:id/reply` |
| 25 | Reports | `GET /analytics/overview`, `…/revenue-chart`, `…/export` |
| 26 | Notifications | ★ four notification routes (incl. `DELETE`) |
| 27 | More | `GET /providers/me`, ★`POST /auth/logout` |
| 28 | EditProfile | `GET/PUT /providers/me`, ★`media/upload-url` |
| 29 | BusinessSettings | `GET/PUT /providers/settings` |
| 30 | Earnings | `GET earnings/summary`, `GET earnings/transactions` |
| 31 | Documents | `GET /providers/documents`, ★`media/upload-url`, `PUT documents/:type` |
| 32 | HelpSupport | ★`GET /support/faqs`, `POST /support/tickets` |

## 3. Registration & account

Access gating per D19: items marked **any** work for every provider status except `suspended`/inactive; items marked **P✓** require `status='approved'`.

| # | Method & Path | Auth | Behavior |
| :-: | :-- | :-: | :-- |
| 1 | `GET /providers/registration/draft` | any | Returns saved values (P-doc 4.1 shape) + all other saved step data: `registration_step`, `business_name, owner_name, whatsapp, email, district, description, tagline, primary_category, secondary_categories, service details, pricing, coverage, documents(summary)`. |
| 2 | `PUT /providers/registration/step/:n` | any | `n ∈ 1..6`. Only while `status ∈ {draft, rejected}` else 409 `REGISTRATION_LOCKED`. `n > registrationStep` → 422 `PREVIOUS_STEP_INCOMPLETE`. Re-saving earlier steps is allowed. Response `{registration_step: <next>, saved:true}` (+ `primary_category`, `secondary_categories` on step 2). Validation below. |
| 3 | `GET /providers/registration/summary` | any | P-doc 10.1 shape; `documents:{aadhaar:bool,pan:bool,gst:bool,trade_license:bool,fssai:bool}`. |
| 4 | `POST /providers/registration/submit` | any | Body `{terms_accepted:true, submitted_at?}` (client time ignored). Requires steps 1–6 complete → else 422; `terms_accepted` must be true. Allowed from `draft|rejected`. Sets `status='pending'`, `submittedAt=now`, `termsAcceptedAt`, clears `rejectionReason`. Data `{status:'pending', message:'Application submitted for review. Verification takes 24-48 business hours.'}`. Logs an admin-queue event. |
| 5 | `GET /providers/me/status` | any | `{status, submission_date, rejection_reason, estimated_decision}`; `estimated_decision = submittedAt + 48h`; for `draft` all null. |
| 6 | `GET /providers/me` | any | Profile card (union of P-doc 12.1/27.1/28.1): `id, business_name, owner_name, mobile, whatsapp, email, tagline, description, category, secondary_categories, rating, review_count, is_online, verified, status, cover_image, logo_color, portfolio_images, district, profile_completion_percent`. |
| 7 | `PUT /providers/me` | P✓ | Body subset: `business_name, owner_name, tagline, description, whatsapp, email, cover_image, logo_color(#RRGGBB), portfolio_images[]≤12, lat, lng` (A6). Message `"Profile updated successfully"`. Validate image URLs (doc 04 §12.6). |
| 8 | `PATCH /providers/me/online-status` | P✓ | `{is_online}` → `{is_online}`. |
| 9 | `GET /providers/settings` | P✓ | `{pricing_model, starting_price, min_capacity, max_capacity, advance_notice_days, auto_accept_enquiries, cancellation_policy, advance_percentage, payment_terms}` |
| 10 | `PUT /providers/settings` | P✓ | Partial update; `min≤max`, `advance_notice_days 0–60`, `starting_price>0`, `advance_percentage 0–100`. Message `"Settings updated"`. |
| 11 | `GET /providers/documents` | any | One row per applicable type (`aadhaar, pan, gst, trade_license`, + `fssai` for catering primary/secondary): `{type, title, status, number(masked)|null, expiry_date?, rejection_reason?, is_required}`. `status ∈ missing|uploaded|verified|rejected|expired`. |
| 12 | `PUT /providers/documents/:type` | any | Body `{number?, expiry_date?, file_url}`; validates number format (below), ownership of `file_url`; upserts doc with `status='uploaded'`; recompute `verified` (Q3). Message `"Document uploaded and submitted for reverification."` Notifies admin queue. |

**Step validation (zod, strict; snake keys shown as sent):**

| Step | Fields & rules |
| :-: | :-- |
| 1 | `business_name` 2–150, `owner_name` 2–120, `whatsapp` mobile, `email?` email, `district` must exist in `districts`, `description?` ≤ 1000, `tagline?` ≤ 255. Side effect: `district`, `geo = district centroid` (D13). |
| 2 | `primary_category` ∈ active categories; `secondary_categories[]` ⊂ categories, no duplicates, excludes primary. |
| 3 | Step 2 must be complete. `category` (if sent) must equal primary. **catering:** `veg_preference` (`veg|non-veg|both`), `min_capacity ≥1`, `max_capacity ≥ min`, `years_active ≥0`, `cuisine_types[]`. **makeup:** `makeup_specialties[]` ≥1, `bridal_trial_offered` bool, `service_location` (`venue|home|venue_and_home`), `max_daily_clients ≥1`, `years_active`. **decoration/audio:** `years_active`, optional `min_capacity/max_capacity`, optional `specialties[]`. |
| 4 | `pricing_model` ∈ `per_plate|per_event|fixed|hourly`, `starting_price > 0`, `advance_percentage` 0–100 (default 30), `cancellation_policy?` ≤ 500, `payment_terms?` ≤ 500. |
| 5 | `districts[]` ≥1 (each exists; the value `"All"` or all 38 ⇒ `isAllDistricts=true`), `service_areas[]`, `travels_outstation` bool, `outstation_fee_per_km` ≥0 (required when travelling). Refresh `geo` if the first area has coordinates. |
| 6 | `documents[]` items `{type, number?, expiry_date?, file_url}`; all `REQUIRED_DOC_TYPES` must be present after the save (this call or earlier) else 422 listing missing types. |

**Document number formats:** Aadhaar `^\d{12}$`; PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`; GST `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`; FSSAI `^\d{14}$` (+ `expiry_date` required & in the future); trade license: free text ≤ 40.

**`profile_completion_percent`:** business info 20 · category 10 · service details 15 · pricing 15 · coverage 10 · required documents uploaded 15 · cover image 10 · tagline 5 (sum to 100, integer).

## 4. Enquiry actions (provider branch)

List/detail/status/messages live in doc 05 §4. Provider-specific rules:

- **`POST /enquiries/:id/quote`** (P✓) — body `{quote_amount>0, valid_until?(YYYY-MM-DD, future), inclusions[]≤20, terms?, message?}`. Allowed from `submitted | provider_reviewing | quote_sent` (re-quote overwrites `quote`, adds a timeline entry). Effects: `status='quote_sent'`; set `firstRespondedAt` once and update provider `avgResponseMinutes`; CRM stage → `quoted`; notify customer (`quote_received`: title `Quote Received!`, message `{businessName} sent a quote for {₹amount}`); if `SMS_NOTIFY_QUOTES=true` also send an SMS. Response message `"Quote sent to customer and SMS notification dispatched"`.
- **`PATCH /enquiries/:id/status`** (provider) allowed transitions are in doc 08 §1. `confirmed` runs the booking-creation transaction and returns `booking_id`.
- **List filters:** `status` accepts `pending|reviewing|quote_sent|accepted|confirmed|completed|cancelled|rejected` (comma list). Home calls `limit=3&status=pending`.

## 5. Bookings & payments

| # | Method & Path | Auth | Behavior |
| :-: | :-- | :-: | :-- |
| 1 | `GET /bookings` | P✓ | Filters `status` (`upcoming|confirmed|in_progress|completed|cancelled`), `search` (customer name/mobile/code/event type), `page`, `limit`. Item: `{id, code, customer_name, customer_mobile:"+91 …", event_type, event_date, event_end_date?, venue, location(=venue), total_amount, advance_paid, balance_due, payment_status, status}`. Sort: `upcoming/confirmed` → `eventDate` asc; others desc. `meta` paging. |
| 2 | `GET /bookings/counts` | P✓ | `{all, upcoming, in_progress, completed, cancelled}`. |
| 3 | `GET /bookings/:id` | P✓ | P-doc 16.1 shape: `{id, code, enquiry_id, customer:{name,mobile,email}, event_details:{type,date,end_date?,start_time,venue,guest_count}, billing:{total_amount,advance_paid,balance_amount,payment_status}, payments_history:[{id,amount,method,date,receipt_no}], items:[…], status}`. |
| 4 | `PATCH /bookings/:id/status` | P✓ | Body `{status}`. Allowed: `confirmed→in_progress`, `confirmed→completed` (only when `eventDate ≤ today`), `in_progress→completed`, `confirmed|in_progress→cancelled`. Effects in doc 08 §3. Returns `{id, status}`. |
| 5 | `POST /bookings/:id/payments` | P✓ | Body `{amount>0, payment_method('upi'|'cash'|'bank_transfer'), reference_id?, notes?}`. Transaction: booking not `cancelled`; `amount ≤ balanceDue` else 422 `PAYMENT_EXCEEDS_BALANCE`; push payment with `receiptNo=REC-…`; recompute `advancePaid`, `balanceDue`, `paymentStatus`. Provider response keeps P-doc compatibility: `data:{balance_due, receipt_no, payment_status}` **and** top-level `balance_due` (use `respond.ok(..., {extraTopLevel})`). Message `"Payment recorded successfully"`. |
| 6 | `GET /bookings/:id/invoice` | P✓ | Generate PDF (pdfkit) with `INV-…` number, provider + customer + event details, line items (enquiry items, or a single "Service charges" line), total, payments, balance, terms. Store via storage adapter; cache `invoiceUrl` keyed by a hash of (total, payments) so it regenerates when payments change. Data `{pdf_url}`. |

## 6. Catalog (dishes · packages · combos)

All P✓. Dishes/packages are for **catering** providers (primary or secondary); others → 403 `FORBIDDEN` ("Dishes are available for catering providers"). Combos are available to all categories.

### 6.1 Dishes
| # | Method & Path | Body / behavior |
| :-: | :-- | :-- |
| 1 | `GET /providers/dishes` | Query `category`, `active=true|false`, `search`. Item `{id,name,category,price,is_veg,is_popular,is_active,photo_url}`. Sorted by category then name. |
| 2 | `POST /providers/dishes` | `{name 2–150, category slug, price>0, is_veg, is_popular?, photo_url?}` → 201 `{id}`. |
| 3 | `GET /providers/dishes/:id` | single (P-doc 20.1). |
| 4 | `PUT /providers/dishes/:id` | full update → `{id, saved:true}`. |
| 5 | `PATCH /providers/dishes/:id/status` | `{is_active}` → `{id,is_active}`. |
| 6 | `DELETE /providers/dishes/:id` | hard delete; also `$pull` from `menu_packages.dishIds` and recompute those packages' `isVeg`. Message `"Dish deleted successfully"`. |

### 6.2 Packages
| # | Method & Path | Body / behavior |
| :-: | :-- | :-- |
| 1 | `GET /providers/packages` | Item `{id,name,price(=pricePerPlate),is_active,items_count}`. |
| 2 | `POST /providers/packages` | `{name, price_per_plate>0, description?, min_guests≥1, dish_ids[]≥1}`; every dish must belong to the provider (else 422) → 201 `{id}`. |
| 3 | `GET /providers/packages/:id` | `{id,name,price_per_plate,description,min_guests,dish_ids}`. |
| 4 | `PUT /providers/packages/:id` | partial/full → `{saved:true}`. Recompute `isVeg`. |
| 5 | `PATCH /providers/packages/:id/status` | `{is_active}`. |
| 6 | `DELETE /providers/packages/:id` | message `"Package removed"`. |

### 6.3 Combos
| # | Method & Path | Body / behavior |
| :-: | :-- | :-- |
| 1 | `GET /providers/combos` | Query `limit`, `active`. Item `{id,name,price,original_price,is_active,image_url,valid_until:'YYYY-MM-DD'}` (superset of P-doc 12.5/19.7). |
| 2 | `POST /providers/combos` | `{name 3–180, description?, price>0, original_price?(> price), included_items[]≥1 (≤20), image_url, valid_until (tolerant parse, future, ≤365 d), badge?, category?(default primary)}` → 201 `{id}`. Max **10 active** combos per provider (exceeding it → 422 `VALIDATION_ERROR`, message `Maximum 10 active combos allowed`). This same handler backs the user-doc alias `POST /combos/special` (D20). |
| 3 | `GET /providers/combos/:id` | `{id,name,description,price,original_price,included_items,image_url,valid_until}` |
| 4 | `PUT /providers/combos/:id` | partial update → `{saved:true}`. |
| 5 | `PATCH /providers/combos/:id/status` | `{is_active}`. |
| 6 | `DELETE /providers/combos/:id` | message `"Combo deleted"`. |

## 7. Availability calendar (rules in doc 08 §2)

| # | Method & Path | Auth | Behavior |
| :-: | :-- | :-: | :-- |
| 1 | `GET /providers/availability/month?year=&month=` | P✓ | `{year,month,stats:{available_count,booked_count,blocked_count},dates:[{date,status,note,booking_id?}]}` — **every day** of the month. Counts cover all days of the month (past included). |
| 2 | `PUT /providers/availability/date` | P✓ | `{date, status:'available'|'blocked'|'booked'|'unavailable', note?}`. `date ≥ today`. `available` → delete doc; blocked/booked-by-booking days: 409 `DATE_HAS_BOOKING`. `booked` (no booking) = manual/offline booking. Returns `{date,status}`. Alias: `PUT /providers/:id/calendar/date` (D20; `:id` must be self). |
| 3 | `POST /providers/availability/bulk` | P✓ | `{start_date,end_date,status,note?}`; range ≤ 62 days; skips days owned by bookings (listed in `data.skipped_dates`); `bulkWrite`. Message `"{n} dates updated to {status}"` where n = updated days. |

## 8. CRM

All P✓, scoped by `providerId`. CRM rows are **created/updated automatically** (doc 08 §6); there is no create endpoint.

| # | Method & Path | Response |
| :-: | :-- | :-- |
| 1 | `GET /crm/customers` | Query `search` (name/mobile), `tag` (`repeat|vip|recent`), `page`, `limit`. Item `{id,name,mobile,city,total_bookings,total_spent,last_event_date,tags,stage,avatar_color,last_contact_at}`; `city = district`. |
| 2 | `GET /crm/stats` | `{total_customers, repeat_clients, repeat_rate_percent, avg_lifetime_value}` (formulas doc 08 §8). |
| 3 | `GET /crm/customers/:id` | `{id,name,mobile,whatsapp,email,district,total_bookings,total_spent,stage,tags,avatar_color}` |
| 4 | `GET /crm/customers/:id/history` | `[{type:'booking'|'enquiry', id, event, date, amount, status}]` newest first (bookings + enquiries that did not convert). |
| 5 | `GET /crm/customers/:id/notes` | `[{id, note, created_at}]` newest first. |
| 6 | `POST /crm/customers/:id/notes` | `{note 1–1000}` → `{id, created_at}`; bumps `lastContactAt`. |

## 9. Reviews · Dashboard · Analytics · Earnings · Support

| # | Method & Path | Auth | Behavior |
| :-: | :-- | :-: | :-- |
| 1 | `GET /providers/reviews` | P✓ | `rating=all|1..5`, `page`, `limit`. Item `{id,customer_name,rating,event_type,comment,created_at,provider_reply (text|null),provider_reply_at}`. |
| 2 | `GET /providers/reviews/summary` | P✓ | `{average_rating,total_reviews,breakdown:{"5_star":n,…,"1_star":n}}` |
| 3 | `POST /providers/reviews/:id/reply` | P✓ | `{reply_text 1–500}`; one reply only (409 `REPLY_ALREADY_EXISTS`); notifies the customer; message `"Reply published"`. |
| 4 | `GET /dashboard/metrics` | P✓ | `{active_enquiries, quote_pending, upcoming_bookings, month_earnings, response_rate_percent}` (doc 08 §8). |
| 5 | `GET /analytics/overview?period=this_month|last_3_months|this_year` | P✓ | `{total_revenue, completed_events, total_guests_served, conversion_rate_percent, avg_event_value}` |
| 6 | `GET /analytics/revenue-chart?year=` | P✓ | `[{month:'Jan', revenue, events}, …]` Jan→(current month if current year else Dec), zero-filled. |
| 7 | `GET /analytics/export?format=pdf|csv&period=` | P✓ | Generate file (pdfkit / csv), store, return `{download_url}`. |
| 8 | `GET /providers/earnings/summary` | P✓ | `{total_lifetime_earnings, this_month_earnings, pending_payout, escrow_advance_held, next_payout_date}` (doc 08 §8). |
| 9 | `GET /providers/earnings/transactions` | P✓ | Payout rows `{id,payout_date,amount,status,payout_method,utr_number}`, `page`,`limit`, `meta`. |
| 10 | `POST /support/enquiry` | any | `{subject,message}` → ticket `source='support_enquiry'`; message `"Support enquiry logged. Ticket #TKT-… created."` |
| 11 | `POST /support/tickets` | any | `{subject, category('billing'|'technical'|'account'|'general'), message}` → **201** `data:{ticket_id:'TKT-…', status:'open', message:'Support ticket created. Our team will contact you within 4 hours.'}`. |

## 10. Admin API (A5 — additive, 11 endpoints)

Separate auth: `POST /admin/auth/login` → JWT `{role:'admin'}` (8 h). All others require it. Admin responses use the provider envelope in snake_case. Every admin write is logged (`pino`, with admin id).

| # | Method & Path | Behavior |
| :-: | :-- | :-- |
| 1 | `POST /admin/auth/login` | `{email,password}` → `{access_token}`. 5 attempts / 15 min / IP. |
| 2 | `GET /admin/providers` | `status` (default `pending,under_review`), `search`, paging. |
| 3 | `GET /admin/providers/:id` | Full provider + documents with **decrypted numbers** and file URLs. |
| 4 | `POST /admin/providers/:id/approve` | Allowed from `pending|under_review|rejected`. Sets `approved`, `approvedAt`, `reviewedBy`; recompute `verified` (Q3); notify provider (`approval`: "You're approved! Start receiving enquiries"). |
| 5 | `POST /admin/providers/:id/reject` | `{reason}` required; sets `rejected`, `rejectionReason`; notify provider. |
| 6 | `POST /admin/providers/:id/suspend` | `{reason}`; sets `suspended`; hides from users; blocks provider API (403 `ACCOUNT_DISABLED`). Reversible via approve. |
| 7 | `PATCH /admin/providers/:providerId/documents/:type` | `{action:'verify'|'reject', reason?}` → doc status; recompute `verified`; notify provider (`document`). |
| 8 | `POST /admin/payouts` | `{providerId, amount, method, utrNumber?, payoutDate, bookingIds?, status?}`. |
| 9 | `PATCH /admin/payouts/:id` | `{status, utrNumber?}`. |
| 10 | `GET /admin/support/tickets` | `status`, paging. |
| 11 | `PATCH /admin/support/tickets/:id` | `{status?, reply?}`; reply appended to `replies[]`. |

## 11. Provider endpoint checklist (59)

- [ ] Registration (4): `draft`, `step/:n`, `summary`, `submit`
- [ ] Account (4): `me` GET, `me` PUT, `me/status`, `me/online-status`
- [ ] Settings (2) · Documents (2)
- [ ] Dashboard (1) · Enquiry extras (3): `counts`, `quote`, `messages`
- [ ] Bookings (6) · CRM (6)
- [ ] Dishes (6) · Packages (6) · Combos (6)
- [ ] Availability (3) · Reviews (3) · Analytics (3) · Earnings (2) · Support (2)

4+4+2+2+1+3+6+6+6+6+6+3+3+3+2+2 = **59**. (Combined with 16 user-only, 11 shared-dispatch, 8 master/public, 1 media, 4 auth ⇒ **99** client-contract endpoints.)
