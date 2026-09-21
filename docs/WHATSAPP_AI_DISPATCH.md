# WhatsApp + AI + Places + Auto-assignment

Production path: **WhatsApp webhook → Bull queue → employee phone lookup → OpenAI structured parse → Google Places → Confirm → `confirmRequest` → supervisor approve → PostGIS shortlist → Route Matrix rank → atomic reserve/offer**.

See also [`INTEGRATION_REQUIREMENTS.md`](./INTEGRATION_REQUIREMENTS.md).

## Webhook URLs

Both aliases work (same controller):

- `GET|POST /api/v1/integrations/whatsapp/webhook`
- `GET|POST /api/v1/webhooks/whatsapp/webhook`

Verify token: `WHATSAPP_VERIFY_TOKEN`. Signature: `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` (skipped if secret empty in dev).

Webhook **acks immediately** and enqueues Bull job `whatsapp` / `process-inbound` (idempotent on Meta `message.id`).

## Environment

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=dev-whatsapp-verify
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_API_VERSION=v21.0

OPENAI_API_KEY=
OPENAI_TRANSPORT_MODEL=gpt-4o
AI_PROVIDER=openai   # or mock / gemini
AI_CONFIDENCE_THRESHOLD=0.75

GOOGLE_MAPS_API_KEY=   # Places (New) + Routes/Distance Matrix + Geocoding

RIDER_LOCATION_MAX_AGE_SECONDS=60
ASSIGNMENT_CANDIDATE_LIMIT=10
ASSIGNMENT_MATRIX_FALLBACK=true
```

## Conversation flow

1. Unknown phone → polite decline (no request).
2. AI intents: create / status / cancel / greeting / help.
3. Low confidence or missing fields → clarification WhatsApp (no Places call).
4. Places Text Search (Rwanda-biased). 0 hits → rewrite; 1 → continue; many → numbered/interactive buttons.
5. Shared WhatsApp location can set pickup coords directly.
6. Confirm / Cancel buttons → `confirmRequest` → `PENDING_APPROVAL` (does **not** create a new request on every message).
7. Status updates to employee WhatsApp on approve/reject/assign/arrive/start/complete/cancel when `channel=WHATSAPP`.

AI never invents coordinates. Places resolves Place IDs + lat/lng.

## Meta templates (ops)

Code can send templates by name via `MetaWhatsAppMessagingProvider.sendTemplate`. Approve templates in Meta Business Manager (customer-care window vs business-initiated). Suggested names (ops-owned):

- `transport_request_submitted`
- `transport_request_approved`
- `transport_rider_assigned`
- `transport_trip_completed`

## Admin health

`GET /api/v1/integrations/health` — configured flags + last webhook time + recent WhatsApp error counts (no secrets). Settings → Integrations UI consumes this.

## Confirm API (non-WhatsApp)

`POST /api/v1/companies/:companyId/transport-requests/:id/confirm`

## Dispatch hardening

- GPS freshness filter (`RIDER_LOCATION_MAX_AGE_SECONDS`)
- PostGIS shortlist → Route Matrix re-rank (duration then distance)
- On Matrix failure: keep PostGIS order and audit `assignmentMethod=POSTGIS_FALLBACK`
- Atomic offer: pessimistic lock; skip to next if not `AVAILABLE`; set rider `RESERVED` until accept
- Persist `assignment_attempts`
