# Contact Module — Frontend Integration Guide

This document describes all contact-related API features so frontend engineers can build the UI. All endpoints require **Bearer token** authentication (`Authorization: Bearer <accessToken>`). Base URL is workspace-scoped (e.g. `/contacts`, `/tags`).

---

## Table of Contents

1. [Contacts](#1-contacts)
2. [Tags](#2-tags)
3. [Custom Fields](#3-custom-fields)
4. [Contact Notes](#4-contact-notes)
5. [Segments (Saved Filters)](#5-segments-saved-filters)
6. [Import & Export](#6-import--export)
7. [Duplicates & Merge](#7-duplicates--merge)
8. [Activity Timeline](#8-activity-timeline)
9. [Suggested UI Flows](#9-suggested-ui-flows)

---

## 1. Contacts

### List contacts
- **GET** `/contacts`
- **Response:** `200` — Array of contacts (sorted by `lastMessageAt` desc, non-deleted only).

**Contact object:**
```ts
{
  id: string;
  workspaceId: string;
  phone: string;           // E.164
  name?: string;
  email?: string;
  isBlocked: boolean;
  isOptedOut: boolean;
  lastMessageAt?: string;  // ISO date
  createdAt: string;
  updatedAt: string;
}
```

**UI:** Table or list with phone, name, email, blocked/opted-out badges, last activity. No pagination yet — list returns all.

---

### Get one contact
- **GET** `/contacts/:id`
- **Response:** `200` — Single contact; `404` if not found.

**UI:** Contact detail header/summary.

---

### Create contact
- **POST** `/contacts`
- **Body:** `{ phone: string; name?: string; email?: string }`
- **Response:** `201` — Created/updated contact (upsert by phone); `400` for invalid phone.

**UI:** “Add contact” form. Phone required; validate/format with libphonenumber or let backend normalize.

---

### Update contact
- **PUT** `/contacts/:id`
- **Body:** `{ name?: string; email?: string; isBlocked?: boolean; isOptedOut?: boolean }` (all optional)
- **Response:** `200` — Updated contact; `404` if not found.

**UI:** Edit contact form; optional consent toggles (blocked / opted out).

---

### Update consent (blocked / opted out)
- **PUT** `/contacts/:id/consent`
- **Body:** `{ isBlocked?: boolean; isOptedOut?: boolean }`
- **Response:** `200` — Updated contact.

**UI:** Quick toggles on contact card or detail: “Blocked”, “Opted out”.

---

### Soft-delete contact
- **DELETE** `/contacts/:id`
- **Response:** `200` — Contact with `deletedAt` set (excluded from list).

**UI:** “Delete contact” with confirmation. Deleted contacts do not appear in list.

---

## 2. Tags

Tags are workspace-level; contacts can have multiple tags.

### List tags
- **GET** `/tags`
- **Response:** `200` — Array of `{ id, workspaceId, name, color?, createdAt, updatedAt }`.

**UI:** Tag list for management; tag picker for contact form.

---

### Create tag
- **POST** `/tags`
- **Body:** `{ name: string; color?: string }`
- **Response:** `201` — Tag; `409` if name already exists.

**UI:** “New tag” modal (name + optional color).

---

### Get / Update / Delete tag
- **GET** `/tags/:id` — `200` / `404`
- **PUT** `/tags/:id` — Body: `{ name?: string; color?: string }` — `200` / `404` / `409`
- **DELETE** `/tags/:id` — `200` — Deletes tag and all contact–tag links.

**UI:** Tag settings or edit tag modal.

---

### Assign tags to contact
- **POST** `/contacts/:id/tags`
- **Body:** `{ tagIds: string[] }` (min 1)
- **Response:** `200` — Array of `{ contactId, tagId, createdAt, tag: Tag }`.

**UI:** Multi-select tag dropdown/chips on contact card or detail; “Add tags”.

---

### Remove tags from contact
- **DELETE** `/contacts/:id/tags`
- **Body:** `{ tagIds: string[] }`
- **Response:** `200` — Remaining contact–tag associations.

**UI:** Remove tag chip or uncheck in tag picker.

---

## 3. Custom Fields

Workspace defines **custom field definitions**; each contact has **values** for those fields (e.g. city, order_id).

### List custom field definitions
- **GET** `/custom-fields`
- **Response:** `200` — Array of definitions.

**Definition object:**
```ts
{
  id: string;
  workspaceId: string;
  name: string;    // machine key, e.g. "city"
  label: string;   // display, e.g. "City"
  type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "URL" | "EMAIL";
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**UI:** Settings → Custom fields list; use definitions to render contact form/detail fields.

---

### Create custom field definition
- **POST** `/custom-fields`
- **Body:** `{ name: string; label: string; type?: CustomFieldType; isRequired?: boolean }`
- **Response:** `201` — Definition; `409` if name exists.

**UI:** “Add custom field” (name, label, type, required).

---

### Get / Update / Delete definition
- **GET** `/custom-fields/:id` — `200` / `404`
- **PUT** `/custom-fields/:id` — Body: `{ label?: string; type?: CustomFieldType; isRequired?: boolean }`
- **DELETE** `/custom-fields/:id` — `200` — Removes definition and all contact values.

**UI:** Edit/delete in custom fields settings.

---

### Get contact’s custom field values
- **GET** `/contacts/:id/custom-fields`
- **Response:** `200` — Array of `{ fieldId, fieldName, label, value }`.

**UI:** Contact detail section “Custom fields” (label + value per row).

---

### Set contact’s custom field values
- **PUT** `/contacts/:id/custom-fields`
- **Body:** `{ fields: Array<{ fieldId: string; value: string }> }`
- **Response:** `200` — Same shape as GET (all values for that contact).

**UI:** Form with one input per definition; submit all fields (empty string to clear).

---

## 4. Contact Notes

Internal notes on a contact (not chat messages). Only the **author** can delete their own note.

### Create note
- **POST** `/contacts/:id/notes`
- **Body:** `{ content: string }`
- **Response:** `201` — `{ id, contactId, authorUserId, content, createdAt }`.

**UI:** “Add note” textarea on contact detail; submit adds to list.

---

### List notes
- **GET** `/contacts/:id/notes`
- **Response:** `200` — Array of notes (newest first).

**UI:** “Notes” section; show content, author (if you have user map), date. Optionally “Delete” only when `authorUserId === currentUser.id`.

---

### Delete note
- **DELETE** `/contacts/:id/notes/:noteId`
- **Response:** `200`; `403` if not author; `404` if note/contact missing.

**UI:** Delete button only for current user’s notes.

---

## 5. Segments (Saved Filters)

Segments are saved filter criteria; used to list/filter contacts and in campaigns.

### List segments
- **GET** `/segments`
- **Response:** `200` — Array of `{ id, workspaceId, name, description?, query, contactCount?, createdAt, updatedAt }`.

**UI:** Segments sidebar or dropdown; show name + optional count.

---

### Create segment
- **POST** `/segments`
- **Body:** `{ name: string; description?: string; query: SegmentQuery }`
- **Response:** `201` — Segment; `409` if name exists.

**Segment query shape (all keys optional):**
```ts
{
  tags?: string[];              // contact has all these tags (by name)
  hasEmail?: boolean;
  hasPhone?: boolean;
  isBlocked?: boolean;
  isOptedOut?: boolean;
  customFields?: Array<{ name: string; op: string; value: string }>;  // op: "eq" | "ne" | "contains"
  lastMessageAfter?: string;    // ISO date
  lastMessageBefore?: string;
}
```

**UI:** “New segment” form: name, description, filter builder (tags multi-select, checkboxes for hasEmail/isBlocked/isOptedOut, custom field filters, date range).

---

### Get / Update / Delete segment
- **GET** `/segments/:id` — `200` / `404`
- **PUT** `/segments/:id` — Body: `{ name?: string; description?: query?: SegmentQuery }`
- **DELETE** `/segments/:id` — `200`

**UI:** Segment settings or edit segment modal.

---

### Preview segment
- **GET** `/segments/:id/preview`
- **Response:** `200` — `{ contacts: Array<{ id, phone, name, email }>; contactCount: number }`. Also updates segment’s cached `contactCount`.

**UI:** “Preview” or “View contacts” for a segment; show count and optionally first page of contacts.

---

## 6. Import & Export

### Import (CSV or Excel)
- **POST** `/contacts/import`
- **Content-Type:** `multipart/form-data`
- **Body:** `file` — CSV or XLSX/XLS
- **Query:** `defaultCountry` (optional) — ISO 3166-1 alpha-2 (e.g. `IN`, `US`), default `IN` (for phone parsing).

**Expected file format:**
- First row = header. Column names case-insensitive.
- **Required column:** `phone`
- **Optional columns:** `name`, `email`, `tags` (comma-separated tag names), plus any other columns as **custom fields** (definitions created automatically by column name).

**Response:** `201`
```ts
{
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;  // row = 1-based data row
}
```

**UI:** “Import contacts” → file picker (accept `.csv`, `.xlsx`, `.xls`) → optional country dropdown → submit → show result (imported/failed) and error table (row number + message).

---

### Export (CSV download)
- **GET** `/contacts/export`
- **Response:** `200` — Streaming CSV file; `Content-Disposition: attachment; filename="contacts.csv"`.

**CSV columns:** phone, name, email, isBlocked, isOptedOut, lastMessageAt, createdAt, tags (comma-separated), then one column per custom field definition.

**UI:** “Export contacts” button → trigger download (e.g. `window.open(url)` or fetch with blob and create object URL). No request body; optional loading state for large workspaces.

---

## 7. Duplicates & Merge

### Find duplicates
- **GET** `/contacts/duplicates`
- **Response:** `200`
```ts
{
  duplicateGroups: Array<{
    contacts: Contact[];
    matchedOn: "phone" | "email";
  }>;
}
```
Groups are contacts sharing the same phone or the same email (non-null).

**UI:** “Find duplicates” action → show groups; each group list contacts and “Merge” actions.

---

### Merge contacts
- **POST** `/contacts/merge`
- **Body:** `{ primaryId: string; duplicateId: string }`
- **Response:** `200` — The **primary** contact after merge; `404` if either missing; `400` if same id.

**Backend behavior:** Primary is kept; duplicate’s tags, custom fields, notes, conversations, and messages are moved to primary; duplicate is soft-deleted.

**UI:** From duplicate group, “Merge” opens a step to choose which is primary (or default to oldest). Confirm → call API with chosen primaryId and duplicateId.

---

## 8. Activity Timeline

Single feed of **notes** and **messages** for a contact, sorted by date (newest first), cursor-paginated.

- **GET** `/contacts/:id/timeline?limit=20&cursor=<cursor>`
- **Query:** `limit` (optional, default 20, max 100); `cursor` (optional) — from previous response’s `nextCursor`.
- **Response:** `200`
```ts
{
  items: Array<{
    type: "note" | "message";
    id: string;
    createdAt: string;
    data: {
      // note: content, authorUserId
      // message: direction, text, type, status
    };
  }>;
  nextCursor: string | null;  // e.g. "message:clx_msg_123"
}
```

**UI:** Contact detail “Activity” or “Timeline” tab: unified list (notes + messages), newest first. “Load more” uses `nextCursor` until `nextCursor` is null. Differentiate by `type` (icon/label for note vs message).

---

## 9. Suggested UI Flows

### Contact list page
- **GET** `/contacts` — table/list.
- Filters: optional client-side filter by tags, segment (use segment preview or your own filter state).
- Actions: Add contact, Import, Export, Find duplicates.
- Row actions: Open detail, Edit, Block/Unblock, Opt out, Delete, Assign tags.

### Contact detail page
- **GET** `/contacts/:id` — header (phone, name, email, consent toggles).
- Tabs/sections:
  - **Details:** Edit contact (PUT), Custom fields (GET/PUT).
  - **Tags:** List current tags (from contact or GET tags + contact tags); Assign (POST), Remove (DELETE).
  - **Notes:** List (GET), Add (POST), Delete own (DELETE).
  - **Activity:** Timeline (GET with cursor).
- Consent: **PUT** `/contacts/:id/consent` for quick toggles.

### Tags management (settings or sidebar)
- **GET** `/tags` — list; Create (POST), Edit (PUT), Delete (DELETE).
- When deleting, warn that tag is removed from all contacts.

### Custom fields (settings)
- **GET** `/custom-fields` — list definitions; Create (POST), Edit (PUT), Delete (DELETE).
- When deleting, warn that all contact values for that field are removed.

### Segments
- **GET** `/segments` — list; Create (POST) with query builder, Edit (PUT), Delete (DELETE), Preview (GET `/:id/preview`).
- Use segments in contact list as “saved filter” (e.g. apply segment’s query client-side or use preview to show matching contacts).

### Import flow
1. “Import” → file picker + optional country.
2. **POST** `/contacts/import` with file.
3. Result screen: “Imported X, failed Y” and table of errors (row, message).

### Export flow
1. “Export” → **GET** `/contacts/export` (download CSV).
2. Optional: loading indicator while stream completes.

### Duplicates flow
1. “Find duplicates” → **GET** `/contacts/duplicates`.
2. Show groups; for each group, “Merge” → choose primary → confirm → **POST** `/contacts/merge`.
3. Refresh list or redirect to primary contact.

---

## Quick reference: Base paths

| Area        | Base path        |
|------------|------------------|
| Contacts   | `/contacts`      |
| Tags       | `/tags`          |
| Custom fields | `/custom-fields` |
| Segments   | `/segments`      |

All require `Authorization: Bearer <token>`. Use the workspace base URL (e.g. after selecting a workspace in your app).
