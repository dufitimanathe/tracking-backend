# External API & Integration Requirements

The backend is fully usable for the core REST + GPS (rider app) + PostGIS dispatch + billing + incidents flow **without** WhatsApp, AI, or Google Maps.

Use this checklist when you are ready to enable each integration.

---

## 1. Google Maps Platform (Routes / Geocoding)

**Why:** road distance, ETA, route matrix for ranking nearest riders (after PostGIS shortlist). GPS points themselves never call Google.

### What to create

1. Google Cloud project
2. Enable APIs:
   - **Geocoding API**
   - **Routes API** (preferred) and/or **Distance Matrix API**
   - Optionally **Places API** later
3. Create an **API key** (restrict by IP for server backends)
4. Enable billing on the GCP project (Maps requires a billing account even within free credit)

### Env vars

```env
GOOGLE_MAPS_API_KEY=your_server_key
```

### Behavior when missing

`MapsModule` falls back to **Haversine** distance/duration estimates. Dispatch still works via PostGIS proximity.

### Cost control (already designed)

- Do **not** call Google on every GPS ping
- Call only for: new request estimate, top-N rider ranking, occasional ETA refresh
- Cache route results where practical

### Docs

- https://developers.google.com/maps/documentation/routes
- https://developers.google.com/maps/documentation/geocoding

---

## 2. Meta WhatsApp Business Cloud API

**Why:** employees request transport via WhatsApp; webhook → AI parse → confirmation → normal transport-request flow.

### What you need (business / Meta)

1. **Meta Business Portfolio** (business.facebook.com)
2. **WhatsApp Business Account (WABA)**
3. A phone number registered for WhatsApp Business API (not a personal WhatsApp in production)
4. Meta **Developer App** with WhatsApp product added
5. From the app dashboard collect:
   - **Temporary / permanent access token** (System User token recommended for production)
   - **Phone number ID**
   - **WhatsApp Business Account ID**
   - **App Secret** (for `X-Hub-Signature-256` validation)
6. Choose a **Verify Token** string you invent (must match backend `WHATSAPP_VERIFY_TOKEN`)
7. Configure webhook callback URL (public HTTPS):
   - Verify: `GET https://YOUR_API_HOST/api/v1/integrations/whatsapp/webhook`
   - Receive: `POST` same URL
8. Subscribe to webhook fields: **messages** (and optionally `message_status`)
9. For production outbound templates (outside 24h session window): create and submit **message templates** for approval

### Env vars

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=choose-a-long-random-string
WHATSAPP_APP_SECRET=
```

### Backend already supports

- Webhook verification challenge
- Optional HMAC signature validation when `WHATSAPP_APP_SECRET` is set
- Idempotency via `whatsapp_messages.externalMessageId`
- Domain flow through `TransportRequestsService` (not raw SQL in webhook)

### Important Meta requirements

- Public HTTPS endpoint (ngrok/cloudflare tunnel for local dev)
- Privacy policy URL often required for app review
- Business verification may be required for higher messaging limits
- Rwanda / target-country number regulations and display name approval

### Docs

- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started

---

## 3. AI transport message parser (OpenAI or Gemini)

**Why:** turn free-text (e.g. Kinyarwanda/English) into structured `{ pickup, destination, time, confidence }`.

**AI must NOT** decide approval, pricing, dispatch, or authorization — only parse intent.

### Option A — OpenAI

1. Account at https://platform.openai.com
2. Add payment method / credits
3. Create API key
4. Prefer a model with reliable JSON / structured outputs (e.g. latest GPT-4.1 / GPT-4o class)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_CONFIDENCE_THRESHOLD=0.75
```

### Option B — Google Gemini

1. Google AI Studio or Vertex AI project
2. Enable Generative Language / Gemini API
3. Create API key (AI Studio) or service account (Vertex)

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=...
AI_CONFIDENCE_THRESHOLD=0.75
```

### Option C — Mock (default for local)

```env
AI_PROVIDER=mock
```

Heuristic parser for demos; no external key needed.

### Low confidence

If confidence &lt; threshold or required fields missing, backend asks the employee to clarify over WhatsApp — it does **not** create a final approved request.

### Docs

- OpenAI: https://platform.openai.com/docs/guides/structured-outputs
- Gemini: https://ai.google.dev/gemini-api/docs

---

## 4. Optional GPS hardware providers

Architecture uses `GpsProvider.normalizeLocation()` +  
`POST /api/v1/integrations/gps/:provider/webhook`.

For a vendor (Teltonika, Queclink, etc.):

1. Obtain vendor webhook auth (API key / HMAC)
2. Implement a provider adapter under `src/locations/providers/`
3. Map payload → `NormalizedGpsPayload`
4. Set vendor-specific secret in env (extend `env.validation.ts` as needed)

Rider React Native GPS works today without hardware.

---

## 5. Suggested enablement order

1. Core REST + PostGIS + rider GPS (done without external APIs)
2. Google Maps key (better ETAs / fares)
3. WhatsApp Cloud API (employee channel)
4. OpenAI or Gemini (natural language → structured request)
5. Hardware GPS adapters

---

## 6. Minimum credentials checklist

| Integration | Required secrets / IDs |
|-------------|------------------------|
| Google Maps | `GOOGLE_MAPS_API_KEY` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` |
| OpenAI | `OPENAI_API_KEY`, `AI_PROVIDER=openai` |
| Gemini | `GEMINI_API_KEY`, `AI_PROVIDER=gemini` |
| JWT (always) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥32 chars) |
| DB / Redis | `DATABASE_*`, `REDIS_*` |

Never commit production tokens. Rotate System User tokens and restrict Maps keys by server IP.
