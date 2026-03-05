# Templates API — Frontend Integration

All requests require `Authorization: Bearer <access_token>`.

Base path: same as API root (e.g. `https://api.example.com`).

---

## Template CRUD

### Create template

**POST** `/templates`

**Request body**

```json
{
  "name": "welcome_message",
  "description": "First-time user greeting",
  "channel": "WHATSAPP",
  "category": "MARKETING"
}
```

| Field         | Type   | Required | Values                                      |
|---------------|--------|----------|---------------------------------------------|
| name          | string | yes      | min 1 char                                  |
| description   | string | no       |                                             |
| channel       | string | no       | `WHATSAPP` (default)                        |
| category      | string | no       | `MARKETING`, `UTILITY`, `AUTHENTICATION`    |

**Response** `201` — single template

```json
{
  "id": "clx_tpl_123",
  "workspaceId": "clx_ws_123",
  "name": "welcome_message",
  "description": "First-time user greeting",
  "channel": "WHATSAPP",
  "category": "MARKETING",
  "providerTemplateId": null,
  "isActive": true,
  "createdAt": "2025-02-09T00:00:00.000Z",
  "updatedAt": "2025-02-09T00:00:00.000Z"
}
```

---

### List templates

**GET** `/templates`

**Query**

| Param          | Type   | Required | Description                                                                 |
|----------------|--------|----------|-----------------------------------------------------------------------------|
| q              | string | no       | Search by name (case-insensitive)                                          |
| channel        | string | no       | `WHATSAPP`                                                                  |
| category       | string | no       | `MARKETING`, `UTILITY`, `AUTHENTICATION`                                   |
| isActive       | string | no       | `true` \| `false`                                                           |
| providerStatus | string | no       | e.g. `APPROVED`, `NOT_ON_PROVIDER`                                          |
| hasProviderId  | string | no       | `true` \| `false` — filter by presence of providerTemplateId                |
| page           | number | no       | Page (default 1)                                                            |
| limit          | number | no       | Page size (default 25, max 100)                                            |
| sortBy         | string | no       | `updatedAt`, `createdAt`, `name`, `category`, `isActive`, `providerStatus`  |
| sortOrder      | string | no       | `asc`, `desc` (default `desc`)                                             |

**Response** `200`

```json
{
  "items": [
    {
      "id": "clx_tpl_123",
      "workspaceId": "clx_ws_123",
      "name": "welcome_message",
      "description": null,
      "channel": "WHATSAPP",
      "category": "MARKETING",
      "providerTemplateId": "123456789",
      "isActive": true,
      "createdAt": "2025-02-09T00:00:00.000Z",
      "updatedAt": "2025-02-09T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 25
}
```

---

### Get template

**GET** `/templates/:id`

**Response** `200` — same shape as single template above.

---

### Update template

**PUT** `/templates/:id`

**Request body** (all optional)

```json
{
  "name": "welcome_v2",
  "description": "Updated description",
  "category": "MARKETING",
  "isActive": true
}
```

**Response** `200` — single template.

---

### Delete template

**DELETE** `/templates/:id`

**Response** `200` — no body.

---

## Import from provider

### Import templates from WhatsApp

**POST** `/templates/provider/import`

No body. Fetches templates from Meta and upserts into the workspace.

**Response** `200`

```json
{
  "imported": 5,
  "updated": 2,
  "flagged": 1
}
```

---

## Versions

### Create version

**POST** `/templates/:id/versions`

**Request body**

```json
{
  "headerType": "TEXT",
  "headerContent": "Welcome",
  "body": "Hello {{1}}, welcome to {{2}}!",
  "footer": "Powered by MsgBuddy",
  "language": "en_US",
  "buttons": [
    { "type": "QUICK_REPLY", "text": "Yes" },
    { "type": "URL", "text": "Learn more", "url": "https://example.com" }
  ],
  "variables": [],
  "layoutType": "STANDARD",
  "carouselCards": null
}
```

**Standard template**

| Field         | Type   | Required | Values                                                                 |
|---------------|--------|----------|------------------------------------------------------------------------|
| body          | string | yes      | min 1 char; use `{{1}}`, `{{2}}` for variables                         |
| headerType    | string | no       | `NONE`, `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`                           |
| headerContent | string | no       | Text or media URL/handle                                               |
| footer        | string | no       |                                                                        |
| language      | string | no       | e.g. `en_US` (default `en_US`)                                        |
| buttons       | array  | no       | `{ type, text, url? }` or `{ type, text, phone_number? }`             |
| variables     | array  | no       |                                                                        |
| layoutType    | string | no       | `STANDARD` (default), `CAROUSEL`                                       |
| carouselCards | array  | no       | Required when `layoutType` is `CAROUSEL`; see below                    |

**Carousel template** (`layoutType`: `CAROUSEL`)

- `category` of the template must be `MARKETING`.
- `carouselCards`: array of 2–10 cards. Each card:
  - `headerFormat`: `IMAGE` or `VIDEO`
  - `headerHandle`: string (URL or media handle)
  - `body`: string
  - `buttons`: array (at least one button per card)
- All cards must use the same `headerFormat`.

Example card:

```json
{
  "headerFormat": "IMAGE",
  "headerHandle": "https://example.com/image.png",
  "body": "Card body text",
  "buttons": [{ "type": "URL", "text": "Shop", "url": "https://shop.example.com" }]
}
```

**Response** `201` — template version (see Template version object below).

---

### Get version

**GET** `/templates/:id/versions/:version`

**Response** `200` — template version object.

---

### Get latest approved version

**GET** `/templates/:id/versions/latest/approved`

Returns the latest version with status `PROVIDER_APPROVED` (the one that can be used for sending).

**Response** `200` — template version object.

---

### Update version

**PUT** `/templates/:id/versions/:version`

Only allowed for versions in `DRAFT`. Same body shape as create version; all fields optional.

**Request body** (all optional)

```json
{
  "headerType": "TEXT",
  "headerContent": "Updated header",
  "body": "Updated body",
  "footer": "Footer",
  "language": "en_US",
  "buttons": [],
  "variables": [],
  "layoutType": "STANDARD",
  "carouselCards": null
}
```

**Response** `200` — template version object.

---

## Approval workflow

### Submit for approval

**POST** `/templates/:id/versions/:version/submit`

Moves version from `DRAFT` to `PENDING`. No body.

**Response** `200` — template version object.

---

### Approve version

**POST** `/templates/:id/versions/:version/approve`

Moves version from `PENDING` to `APPROVED` (local). No body.

**Response** `200` — template version object.

---

### Reject version

**POST** `/templates/:id/versions/:version/reject`

**Request body**

```json
{
  "reason": "Button format not compliant with policy"
}
```

**Response** `200` — template version object.

---

## Provider sync

### Sync version to provider

**POST** `/templates/:id/versions/:version/sync`

Only for versions with status `APPROVED`. Sends template to Meta; after success, status becomes `PROVIDER_PENDING`. Meta approval/rejection is applied later via webhook (`PROVIDER_APPROVED` / `PROVIDER_REJECTED`).

**Response** `200`

```json
{
  "success": true,
  "providerTemplateId": "123456789",
  "providerVersionId": "123456789"
}
```

On failure:

```json
{
  "success": false,
  "error": "Error message from provider"
}
```

---

## Template version object (response shape)

Returned by create/update version, get version, get latest approved, submit/approve/reject.

```json
{
  "id": "clx_ver_123",
  "templateId": "clx_tpl_123",
  "version": 1,
  "headerType": "TEXT",
  "headerContent": "Welcome",
  "body": "Hello {{1}}, welcome!",
  "footer": "Powered by MsgBuddy",
  "language": "en_US",
  "status": "DRAFT",
  "providerRejectionReason": null,
  "layoutType": "STANDARD",
  "carouselCards": null,
  "providerVersionId": null,
  "isLocked": false,
  "createdAt": "2025-02-09T00:00:00.000Z"
}
```

**status** values: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `PROVIDER_PENDING`, `PROVIDER_APPROVED`, `PROVIDER_REJECTED`.

Only versions with `status` **`PROVIDER_APPROVED`** can be used for sending (e.g. in campaigns).

---

## Campaigns — template requirement

When creating or updating a campaign with `templateId` and `templateVersion`:

- The template version **must** have `status` **`PROVIDER_APPROVED`**.
- Otherwise the API returns `400` with message: `Template version must be approved by provider before sending`.

Use **GET** `/templates/:id/versions/latest/approved` to get the sendable version, or **GET** `/templates/:id/versions/:version` and check `status === "PROVIDER_APPROVED"`.
