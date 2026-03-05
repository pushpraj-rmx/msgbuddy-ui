# MsgBuddy v2 API Documentation

**Version:** 2.0  
**Base URL:** `/api` (or as configured)  
**Last Updated:** February 4, 2026

---

## Table of Contents

1. [Authentication & Workspace Context](#authentication--workspace-context)
2. [Frontend Integration Notes](#frontend-integration-notes)
3. [API Endpoints by Module](#api-endpoints-by-module)
   - [Auth](#auth)
   - [App / Workspace Context](#app--workspace-context)
   - [Workspaces](#workspaces)
   - [Contacts](#contacts)
   - [Conversations](#conversations)
   - [Messages](#messages)
   - [Campaigns](#campaigns)
   - [Templates](#templates)
   - [Media](#media)
   - [Usage / Limits](#usage--limits)
   - [Analytics](#analytics)
   - [Internal Notes](#internal-notes)
   - [Integrations / Channel Accounts](#integrations--channel-accounts)
   - [Webhooks](#webhooks-system-to-system)
   - [SSE (Server-Sent Events)](#sse-server-sent-events)
4. [Important Integration Flows](#important-integration-flows)
5. [Inconsistencies & Notes](#inconsistencies--notes)

---

## Authentication & Workspace Context

### How Auth Works

1. **JWT Token Structure:**
   - Token contains: `sub` (userId), `wid` (workspaceId), `role` (OWNER/ADMIN/AGENT)
   - Token is obtained via `/auth/login` or `/auth/register`
   - Token must be sent in `Authorization: Bearer <token>` header

2. **Workspace Scoping:**
   - JWT token includes a workspace ID (`wid`)
   - All endpoints automatically scope to this workspace
   - User must be a member of the workspace (validated by `WorkspacesGuard`)
   - Workspace context is injected into `req.workspace` and `req.member`

3. **Public Endpoints:**
   - Marked with `@Public()` decorator
   - Health check: `GET /`
   - Auth endpoints: `POST /auth/register`, `POST /auth/login`
   - Webhook endpoints: `GET /webhooks/whatsapp`, `POST /webhooks/whatsapp`

---

## Frontend Integration Notes

### Authentication Flow

1. **Registration/Login:**
   ```
   POST /auth/register → { accessToken, refreshToken, expiresIn }
   POST /auth/login → { accessToken, refreshToken, expiresIn }
   ```

2. **Using the Token:**
   - Access tokens are short-lived (~15 minutes). Store in memory/localStorage for the `Authorization` header.
   - Refresh tokens are returned and also set as HttpOnly cookies for web; they rotate on every refresh/login.
   - Include in all requests: `Authorization: Bearer <accessToken>`
   - Token includes workspace context - user is automatically scoped to that workspace

3. **Switching Workspaces:**
   - Call `GET /workspaces` to list user's workspaces
   - To switch workspace, frontend must call login again (backend doesn't support workspace switching without re-auth)
   - Each workspace requires a separate login

4. **Refreshing & Logout:**
   - `POST /auth/refresh` with the refresh cookie (or refreshToken) returns rotated `{ accessToken, refreshToken, expiresIn }`
   - Clients should refresh silently on `401` and force logout if refresh fails
   - `POST /auth/logout` revokes the current refresh token (use logout-all to revoke every session)

### Pagination

- **Cursor-based pagination** is used for list endpoints
- Parameters:
  - `limit` (optional, number): Number of items per page (default: 50)
  - `cursor` (optional, string): ID of last item from previous page
- **How to paginate:**
  1. First request: `GET /endpoint?limit=50`
  2. Next page: `GET /endpoint?limit=50&cursor=<last_item_id>`
  3. Continue until response is empty or has fewer items than limit

**Endpoints with pagination:**
- `GET /conversations` (limit, cursor)
- `GET /media` (limit, cursor)
- Others return all items (may need pagination in future)

### Real-Time Updates (SSE)

- **Endpoint:** `GET /sse/workspace/:workspaceId`
- **Event Types:**
  - `MESSAGE_CREATED` - New message received/sent
  - `CONVERSATION_UPDATED` - Conversation status/changes
  - `CONTACT_UPDATED` - Contact changes
- **Usage:**
  ```javascript
  const eventSource = new EventSource('/sse/workspace/clx_ws_123', {
    headers: { Authorization: 'Bearer <token>' }
  });
  eventSource.onmessage = (e) => {
    const event = JSON.parse(e.data);
    // Handle: event.type, event.data
  };
  ```

### Async Operations

**Campaigns:**
- Creating/starting a campaign returns immediately
- Use `GET /campaigns/:id/progress` to poll for status
- Campaign execution happens via background jobs
- Progress includes: `totalJobs`, `completedJobs`, `failedJobs`, `progressPercent`

**Template Sync:**
- `POST /templates/:id/versions/:version/sync` is async
- Returns sync result immediately, actual sync happens in background

**Media Sync:**
- `POST /media/:id/sync/:provider` is async
- Returns sync result immediately

---

## API Endpoints by Module

---

## Auth

### POST /auth/register
**Auth Required:** No (Public)

**Request Body:**
```json
{
  "email": "owner@example.com",
  "password": "SuperSecret123",
  "workspace": "Acme Workspace"
}
```

**Response:** `201 Created`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400 Bad Request` - Invalid email/password/workspace
- `401 Unauthorized` - Registration failed

**Notes:** Creates user account, workspace, and workspace membership (OWNER role). Returns JWT token.

---

### POST /auth/login
**Auth Required:** No (Public)

**Request Body:**
```json
{
  "email": "agent@example.com",
  "password": "StrongPass123!"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400 Bad Request` - Invalid credentials
- `401 Unauthorized` - Authentication failed
- `403 Forbidden` - Account locked (too many failed attempts)

**Notes:** Returns JWT token with workspace context. Token includes `wid` (workspaceId) from user's first membership.

---

## App / Workspace Context

### GET /
**Auth Required:** No (Public)

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

**Notes:** Health check endpoint.

---

### GET /workspaces
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
[
  {
    "id": "clx_ws_123",
    "slug": "acme-workspace",
    "name": "Acme Workspace",
    "role": "OWNER",
    "joinedAt": "2025-01-01T00:00:00Z",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized` - Invalid/missing token

**Notes:** Lists all workspaces the authenticated user is a member of, with their role in each.

---

### GET /me
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "clx_user_123",
    "email": "user@example.com",
    ...
  },
  "workspace": {
    "id": "clx_ws_123",
    "name": "Acme Workspace",
    ...
  },
  "role": "OWNER"
}
```

**Errors:**
- `401 Unauthorized` - Invalid/missing token

**Notes:** Returns current user, workspace context, and role.

---

## Workspaces

### GET /workspaces
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
[
  {
    "id": "clx_ws_123",
    "slug": "acme-workspace",
    "name": "Acme Workspace",
    "role": "OWNER",
    "joinedAt": "2025-01-01T00:00:00Z",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists workspaces for current user (same as `GET /workspaces`).

---

### GET /workspaces/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Response:** `200 OK`
```json
{
  "id": "clx_ws_123",
  "slug": "acme-workspace",
  "name": "Acme Workspace",
  "description": "Customer support workspace",
  "timezone": "America/New_York",
  "locale": "en",
  "status": "ACTIVE",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found` - Workspace not found or user not a member

---

### POST /workspaces
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New Workspace"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_ws_456",
  "name": "New Workspace",
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid name
- `401 Unauthorized`

**Notes:** Creates workspace and adds creator as OWNER.

---

### PUT /workspaces/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  ...
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_ws_123",
  "name": "Updated Name",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden` - Not OWNER/ADMIN
- `404 Not Found`

---

### DELETE /workspaces/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Response:** `200 OK`
```json
{
  "message": "Workspace deleted"
}
```

**Errors:**
- `401 Unauthorized`
- `403 Forbidden` - Not OWNER
- `404 Not Found`

**Notes:** Soft-deletes workspace.

---

### GET /workspaces/:id/members
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Response:** `200 OK`
```json
[
  {
    "id": "clx_member_123",
    "userId": "clx_user_123",
    "workspaceId": "clx_ws_123",
    "role": "OWNER",
    "user": {
      "id": "clx_user_123",
      "email": "user@example.com",
      ...
    },
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /workspaces/:id/members
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Request Body:**
```json
{
  "userId": "clx_user_456",
  "role": "AGENT"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_member_456",
  "userId": "clx_user_456",
  "role": "AGENT",
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid userId/role
- `401 Unauthorized`
- `403 Forbidden` - Not OWNER/ADMIN
- `404 Not Found`

**Notes:** Adds user to workspace. Role: OWNER, ADMIN, or AGENT.

---

### PUT /workspaces/:id/members/:memberId/role
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID
- `memberId` (string) - Member ID

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_member_456",
  "role": "ADMIN",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `403 Forbidden` - Not OWNER/ADMIN
- `404 Not Found`

---

### DELETE /workspaces/:id/members/:memberId
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID
- `memberId` (string) - Member ID

**Response:** `200 OK`
```json
{
  "message": "Member removed"
}
```

**Errors:**
- `401 Unauthorized`
- `403 Forbidden` - Not OWNER/ADMIN
- `404 Not Found`

---

### GET /workspaces/:id/settings
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Response:** `200 OK`
```json
{
  "timezone": "America/New_York",
  "locale": "en",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Returns workspace settings (sensitive fields omitted).

---

### PUT /workspaces/:id/settings
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Workspace ID

**Request Body:**
```json
{
  "timezone": "America/Los_Angeles",
  "locale": "es",
  ...
}
```

**Response:** `200 OK`
```json
{
  "message": "Settings updated"
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden` - Not OWNER/ADMIN
- `404 Not Found`

---

## Contacts

### POST /contacts
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "phone": "+14155552671",
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_contact_123",
  "workspaceId": "clx_ws_123",
  "phone": "+14155552671",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "isBlocked": false,
  "isOptedOut": false,
  "createdAt": "2025-01-01T00:00:00Z",
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid phone/email
- `401 Unauthorized`

**Notes:** Creates or upserts contact by phone (phone is unique per workspace).

---

### GET /contacts
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
[
  {
    "id": "clx_contact_123",
    "phone": "+14155552671",
    "name": "Jane Doe",
    "isBlocked": false,
    "isOptedOut": false,
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns all contacts in workspace. **No pagination** - may return large lists.

---

### GET /contacts/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Contact ID

**Response:** `200 OK`
```json
{
  "id": "clx_contact_123",
  "phone": "+14155552671",
  "name": "Jane Doe",
  "isBlocked": false,
  "isOptedOut": false,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /contacts/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Contact ID

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com"
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_contact_123",
  "name": "Jane Smith",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /contacts/:id/consent
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Contact ID

**Request Body:**
```json
{
  "isBlocked": true,
  "isOptedOut": false
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_contact_123",
  "isBlocked": true,
  "isOptedOut": false,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Updates contact consent flags (blocked/opted out).

---

### DELETE /contacts/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Contact ID

**Response:** `200 OK`
```json
{
  "id": "clx_contact_123",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Soft-deletes contact.

---

## Conversations

### GET /conversations
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional, enum) - Filter by status: `OPEN`, `CLOSED`, `ARCHIVED`
- `channel` (optional, enum) - Filter by channel: `WHATSAPP`, `TELEGRAM`, `EMAIL`, `SMS`
- `limit` (optional, number) - Items per page (default: 50)
- `cursor` (optional, string) - Cursor for pagination

**Response:** `200 OK`
```json
[
  {
    "id": "clx_conv_123",
    "workspaceId": "clx_ws_123",
    "contactId": "clx_contact_123",
    "channel": "WHATSAPP",
    "status": "OPEN",
    "unreadCount": 2,
    "lastMessageAt": "2025-01-01T12:00:00Z",
    "contact": { ... },
    "lastMessage": { ... },
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns conversations with pagination support. Ordered by `lastMessageAt` desc.

---

### GET /conversations/stats
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "total": 100,
  "open": 25,
  "closed": 50,
  "archived": 25,
  ...
}
```

**Errors:**
- `401 Unauthorized`

---

### GET /conversations/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Conversation ID

**Response:** `200 OK`
```json
{
  "id": "clx_conv_123",
  "contactId": "clx_contact_123",
  "channel": "WHATSAPP",
  "status": "OPEN",
  "unreadCount": 2,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### GET /conversations/contact/:contactId
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `contactId` (string) - Contact ID

**Response:** `200 OK`
```json
[
  {
    "id": "clx_conv_123",
    "contactId": "clx_contact_123",
    "channel": "WHATSAPP",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists all conversations for a specific contact.

---

### PUT /conversations/:id/open
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Conversation ID

**Response:** `200 OK`
```json
{
  "id": "clx_conv_123",
  "status": "OPEN",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /conversations/:id/close
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Conversation ID

**Response:** `200 OK`
```json
{
  "id": "clx_conv_123",
  "status": "CLOSED",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /conversations/:id/archive
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Conversation ID

**Response:** `200 OK`
```json
{
  "id": "clx_conv_123",
  "status": "ARCHIVED",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /conversations/:id/read
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Conversation ID

**Response:** `200 OK`
```json
{
  "id": "clx_conv_123",
  "unreadCount": 0,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Marks conversation as read (resets unreadCount).

---

## Messages

### POST /messages
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "contactId": "clx_contact_123",
  "text": "Hello there! 👋",
  "idempotencyKey": "idemp-1234",
  "channel": "WHATSAPP"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_msg_123",
  "conversationId": "clx_conv_123",
  "contactId": "clx_contact_123",
  "direction": "OUTBOUND",
  "channel": "WHATSAPP",
  "type": "TEXT",
  "text": "Hello there! 👋",
  "status": "PENDING",
  "createdAt": "2025-01-01T00:00:00Z",
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid contactId/text
- `401 Unauthorized`
- `404 Not Found` - Contact not found

**Notes:** Sends outbound message. Creates conversation if needed. `idempotencyKey` prevents duplicate sends.

---

### GET /messages/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Message ID

**Response:** `200 OK`
```json
{
  "id": "clx_msg_123",
  "conversationId": "clx_conv_123",
  "direction": "OUTBOUND",
  "status": "DELIVERED",
  "text": "Hello there!",
  "sentAt": "2025-01-01T00:00:00Z",
  "deliveredAt": "2025-01-01T00:01:00Z",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### GET /messages/conversation/:conversationId
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `conversationId` (string) - Conversation ID

**Response:** `200 OK`
```json
[
  {
    "id": "clx_msg_123",
    "conversationId": "clx_conv_123",
    "direction": "OUTBOUND",
    "text": "Hello!",
    "status": "DELIVERED",
    ...
  },
  {
    "id": "clx_msg_124",
    "direction": "INBOUND",
    "text": "Hi there!",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists all messages in a conversation. **No pagination** - may return large lists.

---

### PUT /messages/:id/status
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Message ID

**Request Body:**
```json
{
  "status": "DELIVERED",
  "providerMessageId": "wamid.xxx",
  "errorCode": null,
  "errorMessage": null
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_msg_123",
  "status": "DELIVERED",
  "providerMessageId": "wamid.xxx",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Updates message delivery status. Typically called by webhooks, but available for manual updates.

**Status Values:** `PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`

---

## Campaigns

### POST /campaigns
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Holiday Promo 2025",
  "description": "Black Friday campaign",
  "channel": "WHATSAPP",
  "templateId": "clx_tpl_123",
  "templateVersion": 1,
  "audienceType": "CONTACTS",
  "contactIds": ["clx_contact_1", "clx_contact_2"],
  "scheduledAt": "2025-12-01T09:00:00Z",
  "timezone": "America/New_York",
  "chunkSize": 100,
  "throttlePerMin": 60
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_camp_123",
  "workspaceId": "clx_ws_123",
  "name": "Holiday Promo 2025",
  "channel": "WHATSAPP",
  "status": "DRAFT",
  "isActive": true,
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid data
- `401 Unauthorized`

**Notes:** Creates campaign. Status starts as `DRAFT`. Use `/campaigns/:id/start` to execute.

**Audience Types:** `ALL`, `CONTACTS`, `QUERY`

---

### GET /campaigns
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional, enum) - Filter by status: `DRAFT`, `SCHEDULED`, `RUNNING`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`
- `channel` (optional, enum) - Filter by channel
- `isActive` (optional, boolean) - Filter by active flag

**Response:** `200 OK`
```json
[
  {
    "id": "clx_camp_123",
    "name": "Holiday Promo 2025",
    "status": "RUNNING",
    "channel": "WHATSAPP",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists campaigns. **No pagination** - may return large lists.

---

### GET /campaigns/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
{
  "id": "clx_camp_123",
  "name": "Holiday Promo 2025",
  "status": "RUNNING",
  "channel": "WHATSAPP",
  "templateId": "clx_tpl_123",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /campaigns/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "scheduledAt": "2025-12-02T09:00:00Z",
  ...
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_camp_123",
  "name": "Updated Name",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

---

### DELETE /campaigns/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
{
  "message": "Campaign deleted"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /campaigns/:id/start
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `201 Created`
```json
{
  "runId": "clx_run_123",
  "message": "Campaign started"
}
```

**Errors:**
- `400 Bad Request` - Campaign not ready
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Starts campaign execution. Returns immediately. Use `/campaigns/:id/progress` to track progress.

---

### POST /campaigns/:id/pause
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
{
  "message": "Run paused"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Pauses running campaign.

---

### POST /campaigns/:id/resume
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
{
  "message": "Run resumed"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /campaigns/:id/cancel
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
{
  "message": "Run cancelled"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### GET /campaigns/:id/progress
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Query Parameters:**
- `runId` (optional, string) - Specific run ID (defaults to latest)

**Response:** `200 OK`
```json
{
  "runId": "clx_run_123",
  "runNumber": 1,
  "status": "RUNNING",
  "totalJobs": 100,
  "pendingJobs": 50,
  "processingJobs": 10,
  "completedJobs": 40,
  "failedJobs": 0,
  "skippedJobs": 0,
  "progressPercent": 40,
  "startedAt": "2025-01-01T00:00:00Z"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Returns campaign execution progress. Poll this endpoint to track campaign status.

**Run Status:** `PENDING`, `RUNNING`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`

---

### GET /campaigns/:id/runs
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
[
  {
    "id": "clx_run_123",
    "campaignId": "clx_camp_123",
    "runNumber": 1,
    "status": "COMPLETED",
    "totalJobs": 100,
    "completedJobs": 95,
    "failedJobs": 2,
    "skippedJobs": 3,
    "startedAt": "2025-01-01T00:00:00Z",
    "completedAt": "2025-01-01T01:00:00Z",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Lists all runs for a campaign.

---

## Templates

### POST /templates
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "welcome_message",
  "description": "First-time user greeting",
  "channel": "WHATSAPP",
  "category": "UTILITY"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_tpl_123",
  "workspaceId": "clx_ws_123",
  "name": "welcome_message",
  "channel": "WHATSAPP",
  "category": "UTILITY",
  "isActive": true,
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid data
- `401 Unauthorized`

**Notes:** Creates template. Must create versions separately.

**Categories:** `UTILITY`, `MARKETING`, `AUTHENTICATION`

---

### GET /templates
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `channel` (optional, enum) - Filter by channel
- `category` (optional, enum) - Filter by category
- `isActive` (optional, boolean) - Filter by active flag

**Response:** `200 OK`
```json
[
  {
    "id": "clx_tpl_123",
    "name": "welcome_message",
    "channel": "WHATSAPP",
    "category": "UTILITY",
    "isActive": true,
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists templates. **No pagination** - may return large lists.

---

### GET /templates/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID

**Response:** `200 OK`
```json
{
  "id": "clx_tpl_123",
  "name": "welcome_message",
  "channel": "WHATSAPP",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /templates/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID

**Request Body:**
```json
{
  "name": "updated_name",
  "description": "Updated description",
  ...
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_tpl_123",
  "name": "updated_name",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

---

### DELETE /templates/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID

**Response:** `200 OK`
```json
{
  "message": "Template deleted"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /templates/:id/versions
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID

**Request Body:**
```json
{
  "headerType": "IMAGE",
  "headerContent": "https://example.com/image.jpg",
  "body": "Hello {{1}}, welcome to {{2}}!",
  "footer": "Powered by MsgBuddy",
  "buttons": [],
  "variables": []
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_ver_123",
  "templateId": "clx_tpl_123",
  "version": 1,
  "body": "Hello {{1}}, welcome to {{2}}!",
  "status": "DRAFT",
  "isLocked": false,
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid template format
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Creates new template version. Status starts as `DRAFT`.

**Header Types:** `NONE`, `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`

**Version Status:** `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`

---

### GET /templates/:id/versions/:version
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID
- `version` (number) - Version number

**Response:** `200 OK`
```json
{
  "id": "clx_ver_123",
  "templateId": "clx_tpl_123",
  "version": 1,
  "body": "Hello {{1}}!",
  "status": "APPROVED",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### GET /templates/:id/versions/latest/approved
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID

**Response:** `200 OK`
```json
{
  "id": "clx_ver_123",
  "version": 2,
  "status": "APPROVED",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Returns latest approved version of template.

---

### PUT /templates/:id/versions/:version
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID
- `version` (number) - Version number

**Request Body:**
```json
{
  "body": "Updated body text",
  "footer": "Updated footer",
  ...
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_ver_123",
  "body": "Updated body text",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Updates version (only if status is `DRAFT`).

---

### POST /templates/:id/versions/:version/submit
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID
- `version` (number) - Version number

**Response:** `200 OK`
```json
{
  "id": "clx_ver_123",
  "status": "PENDING",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Submits version for approval (status → `PENDING`).

---

### POST /templates/:id/versions/:version/approve
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID
- `version` (number) - Version number

**Response:** `200 OK`
```json
{
  "id": "clx_ver_123",
  "status": "APPROVED",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Approves version (status → `APPROVED`).

---

### POST /templates/:id/versions/:version/reject
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID
- `version` (number) - Version number

**Request Body:**
```json
{
  "reason": "Template violates policy"
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_ver_123",
  "status": "REJECTED",
  ...
}
```

**Errors:**
- `400 Bad Request` - Missing reason
- `401 Unauthorized`
- `404 Not Found`

---

### POST /templates/:id/versions/:version/sync
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Template ID
- `version` (number) - Version number

**Response:** `200 OK`
```json
{
  "success": true,
  "providerTemplateId": "123456789",
  "providerVersionId": "v1"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Syncs template version to provider (WhatsApp/Telegram). Returns immediately, actual sync happens async.

---

## Media

### POST /media/upload
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:**
- `file` (file) - Media file (image, video, document)

**Response:** `201 Created`
```json
{
  "id": "clx_media_123",
  "workspaceId": "clx_ws_123",
  "url": "https://cdn.example.com/media/abc.jpg",
  "mimeType": "image/jpeg",
  "size": 1024,
  "providerMediaId": null,
  ...
}
```

**Errors:**
- `400 Bad Request` - No file provided or invalid file
- `401 Unauthorized`

**Notes:** Uploads media file. File is stored and URL is returned.

---

### GET /media
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (optional, number) - Items per page (default: 50)
- `cursor` (optional, string) - Cursor for pagination

**Response:** `200 OK`
```json
[
  {
    "id": "clx_media_123",
    "url": "https://cdn.example.com/media/abc.jpg",
    "mimeType": "image/jpeg",
    "size": 1024,
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists media files with pagination support.

---

### GET /media/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Media ID

**Response:** `200 OK`
```json
{
  "id": "clx_media_123",
  "url": "https://cdn.example.com/media/abc.jpg",
  "mimeType": "image/jpeg",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### DELETE /media/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Media ID

**Response:** `200 OK`
```json
{
  "message": "Media deleted"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Deletes media file and record.

---

### POST /media/:id/sync/:provider
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Media ID
- `provider` (enum) - `whatsapp` or `telegram`

**Response:** `200 OK`
```json
{
  "success": true,
  "providerMediaId": "media_123"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Syncs media to provider. Returns immediately, actual sync happens async.

---

### POST /media/retry-failed
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "Retry initiated"
}
```

**Errors:**
- `401 Unauthorized`

**Notes:** Retries failed provider syncs for workspace.

---

## Usage / Limits

### GET /usage
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "messagesSent": 1500,
  "messagesReceived": 800,
  "contactsCreated": 200,
  "periodStart": "2025-01-01T00:00:00Z",
  "periodEnd": "2025-01-31T23:59:59Z"
}
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns current usage summary (current billing period).

---

### GET /usage/limits
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "usage": {
    "messagesSent": 1500,
    "contactsCreated": 200
  },
  "limits": {
    "messages": 10000,
    "contacts": 1000
  },
  "remaining": {
    "messages": 8500,
    "contacts": 800
  }
}
```

**Errors:**
- `401 Unauthorized`

---

### GET /usage/check/messages
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "allowed": true,
  "remaining": 8500,
  "limit": 10000,
  "used": 1500
}
```

**Errors:**
- `401 Unauthorized`

**Notes:** Checks if workspace can send more messages.

---

### GET /usage/check/contacts
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "allowed": true,
  "remaining": 800,
  "limit": 1000,
  "used": 200
}
```

**Errors:**
- `401 Unauthorized`

---

### GET /usage/period
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (required, string) - Start date (ISO 8601): `2025-01-01`
- `end` (required, string) - End date (ISO 8601): `2025-01-31`

**Response:** `200 OK`
```json
{
  "messagesSent": 5000,
  "messagesReceived": 3000,
  "contactsCreated": 500,
  "periodStart": "2025-01-01T00:00:00Z",
  "periodEnd": "2025-01-31T23:59:59Z"
}
```

**Errors:**
- `401 Unauthorized`

---

### POST /usage/rebuild
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "Aggregates rebuilt successfully"
}
```

**Errors:**
- `401 Unauthorized`

**Notes:** Rebuilds usage aggregates (admin operation).

---

## Analytics

### GET /analytics/summary
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date (ISO 8601, defaults to 30 days ago)
- `end` (optional, string) - End date (ISO 8601, defaults to now)

**Response:** `200 OK`
```json
{
  "totalMessages": 5000,
  "messagesSent": 3000,
  "messagesReceived": 2000,
  "deliveryRate": 0.95,
  "readRate": 0.80,
  "totalConversations": 500,
  "activeConversations": 100,
  ...
}
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns full analytics summary for dashboard.

---

### GET /analytics/delivery
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date
- `end` (optional, string) - End date

**Response:** `200 OK`
```json
{
  "total": 3000,
  "sent": 3000,
  "delivered": 2850,
  "read": 2400,
  "failed": 150,
  "deliveryRate": 0.95,
  "readRate": 0.84
}
```

**Errors:**
- `401 Unauthorized`

---

### GET /analytics/channels
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date
- `end` (optional, string) - End date

**Response:** `200 OK`
```json
[
  {
    "channel": "WHATSAPP",
    "messagesSent": 2000,
    "messagesReceived": 1500,
    "deliveryRate": 0.96
  },
  {
    "channel": "TELEGRAM",
    "messagesSent": 1000,
    "messagesReceived": 500,
    "deliveryRate": 0.94
  }
]
```

**Errors:**
- `401 Unauthorized`

---

### GET /analytics/timeseries
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date
- `end` (optional, string) - End date
- `granularity` (optional, enum) - `hour`, `day`, `week` (default: `day`)

**Response:** `200 OK`
```json
[
  {
    "timestamp": "2025-01-01T00:00:00Z",
    "messagesSent": 100,
    "messagesReceived": 50,
    "conversationsCreated": 10
  },
  {
    "timestamp": "2025-01-02T00:00:00Z",
    "messagesSent": 120,
    "messagesReceived": 60,
    "conversationsCreated": 12
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns time series data for charts.

---

### GET /analytics/campaigns/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Campaign ID

**Response:** `200 OK`
```json
{
  "campaignId": "clx_camp_123",
  "name": "Holiday Promo 2025",
  "totalSent": 1000,
  "delivered": 950,
  "read": 800,
  "failed": 50,
  "deliveryRate": 0.95,
  "readRate": 0.84,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Returns campaign-specific analytics.

---

### GET /analytics/campaigns
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date
- `end` (optional, string) - End date
- `limit` (optional, number) - Number of campaigns (default: 5)

**Response:** `200 OK`
```json
[
  {
    "campaignId": "clx_camp_123",
    "name": "Holiday Promo 2025",
    "totalSent": 1000,
    "deliveryRate": 0.95,
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns top campaigns by performance.

---

### GET /analytics/conversations
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date
- `end` (optional, string) - End date

**Response:** `200 OK`
```json
{
  "total": 500,
  "open": 100,
  "closed": 300,
  "archived": 100,
  "averageResponseTime": 300,
  ...
}
```

**Errors:**
- `401 Unauthorized`

---

### GET /analytics/contacts
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `start` (optional, string) - Start date
- `end` (optional, string) - End date

**Response:** `200 OK`
```json
{
  "total": 1000,
  "new": 200,
  "growthRate": 0.25,
  ...
}
```

**Errors:**
- `401 Unauthorized`

**Notes:** Returns contact growth statistics.

---

## Internal Notes

### POST /internal/notes
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "targetType": "CONTACT",
  "targetId": "clx_contact_123",
  "content": "Customer requested callback tomorrow",
  "isPinned": false
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_note_123",
  "workspaceId": "clx_ws_123",
  "targetType": "CONTACT",
  "targetId": "clx_contact_123",
  "content": "Customer requested callback tomorrow",
  "isPinned": false,
  "createdBy": "clx_user_123",
  "createdAt": "2025-01-01T00:00:00Z",
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid targetType/targetId
- `401 Unauthorized`

**Notes:** Creates internal note on contact, conversation, or campaign.

**Target Types:** `CONTACT`, `CONVERSATION`, `CAMPAIGN`

---

### GET /internal/notes
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `targetType` (required, enum) - `CONTACT`, `CONVERSATION`, `CAMPAIGN`
- `targetId` (required, string) - Target ID

**Response:** `200 OK`
```json
[
  {
    "id": "clx_note_123",
    "targetType": "CONTACT",
    "targetId": "clx_contact_123",
    "content": "Customer requested callback",
    "isPinned": true,
    "createdBy": "clx_user_123",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

---

### GET /internal/notes/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Note ID

**Response:** `200 OK`
```json
{
  "id": "clx_note_123",
  "content": "Customer requested callback",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /internal/notes/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Note ID

**Request Body:**
```json
{
  "content": "Updated note content"
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_note_123",
  "content": "Updated note content",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

---

### DELETE /internal/notes/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Note ID

**Response:** `200 OK`
```json
{
  "message": "Note deleted"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /internal/notes/:id/toggle-pin
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Note ID

**Response:** `200 OK`
```json
{
  "id": "clx_note_123",
  "isPinned": true,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Toggles pin status of note.

---

### POST /internal/messages
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "conversationId": "clx_conv_123",
  "text": "Internal team note - follow up needed"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_int_msg_123",
  "conversationId": "clx_conv_123",
  "text": "Internal team note - follow up needed",
  "createdBy": "clx_user_123",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Creates internal message (team-only, not sent to provider).

---

### GET /internal/messages/:conversationId
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `conversationId` (string) - Conversation ID

**Response:** `200 OK`
```json
[
  {
    "id": "clx_int_msg_123",
    "conversationId": "clx_conv_123",
    "text": "Internal team note",
    "createdBy": "clx_user_123",
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

---

## Integrations / Channel Accounts

### POST /integrations
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Main WhatsApp",
  "provider": "WHATSAPP",
  "channel": "WHATSAPP",
  "credentials": {
    "accountSid": "ACxxx",
    "authToken": "xxx"
  },
  "externalAccountId": "123456789",
  "externalAccountName": "+15551234567",
  "isDefault": false
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_int_123",
  "workspaceId": "clx_ws_123",
  "name": "Main WhatsApp",
  "provider": "WHATSAPP",
  "channel": "WHATSAPP",
  "isActive": true,
  "isDefault": false,
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid credentials/provider
- `401 Unauthorized`

**Notes:** Creates integration. Credentials structure varies by provider.

**Providers:** `WHATSAPP`, `TELEGRAM`, `TWILIO`, `SENDGRID`, etc.

---

### GET /integrations
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `provider` (optional, enum) - Filter by provider
- `channel` (optional, enum) - Filter by channel
- `isActive` (optional, boolean) - Filter by active flag

**Response:** `200 OK`
```json
[
  {
    "id": "clx_int_123",
    "name": "Main WhatsApp",
    "provider": "WHATSAPP",
    "channel": "WHATSAPP",
    "isActive": true,
    "isDefault": true,
    ...
  }
]
```

**Errors:**
- `401 Unauthorized`

**Notes:** Lists integrations. **No pagination** - may return large lists.

---

### GET /integrations/default/:channel
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `channel` (enum) - Channel: `WHATSAPP`, `TELEGRAM`, `EMAIL`, `SMS`

**Response:** `200 OK`
```json
{
  "id": "clx_int_123",
  "name": "Main WhatsApp",
  "channel": "WHATSAPP",
  "isDefault": true,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found` - No default integration for channel

---

### GET /integrations/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Integration ID

**Response:** `200 OK`
```json
{
  "id": "clx_int_123",
  "name": "Main WhatsApp",
  "provider": "WHATSAPP",
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### PUT /integrations/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Integration ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "credentials": { ... },
  ...
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_int_123",
  "name": "Updated Name",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`

---

### DELETE /integrations/:id
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Integration ID

**Response:** `200 OK`
```json
{
  "message": "Integration deleted"
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /integrations/setup/whatsapp
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "WhatsApp Integration",
  "credentials": {
    "accountSid": "ACxxx",
    "authToken": "xxx",
    "phoneNumber": "+15551234567"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_int_123",
  "name": "WhatsApp Integration",
  "provider": "WHATSAPP",
  ...
}
```

**Errors:**
- `400 Bad Request` - Invalid credentials
- `401 Unauthorized`

**Notes:** Convenience endpoint for WhatsApp setup.

---

### POST /integrations/setup/telegram
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Telegram Integration",
  "credentials": {
    "botToken": "123456:ABC-DEF..."
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_int_123",
  "provider": "TELEGRAM",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`

---

### POST /integrations/setup/email
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Email Integration",
  "credentials": {
    "smtpHost": "smtp.sendgrid.net",
    "smtpPort": 587,
    "smtpUser": "apikey",
    "smtpPassword": "SG.xxx",
    "fromEmail": "noreply@example.com"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_int_123",
  "provider": "SENDGRID",
  "channel": "EMAIL",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`

---

### POST /integrations/setup/sms
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "SMS Integration",
  "credentials": {
    "accountSid": "ACxxx",
    "authToken": "xxx",
    "phoneNumber": "+15551234567"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "clx_int_123",
  "provider": "TWILIO",
  "channel": "SMS",
  ...
}
```

**Errors:**
- `400 Bad Request`
- `401 Unauthorized`

---

### POST /integrations/:id/set-default
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Integration ID

**Response:** `200 OK`
```json
{
  "id": "clx_int_123",
  "isDefault": true,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

**Notes:** Sets integration as default for its channel.

---

### POST /integrations/:id/activate
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Integration ID

**Response:** `200 OK`
```json
{
  "id": "clx_int_123",
  "isActive": true,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

### POST /integrations/:id/deactivate
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (string) - Integration ID

**Response:** `200 OK`
```json
{
  "id": "clx_int_123",
  "isActive": false,
  ...
}
```

**Errors:**
- `401 Unauthorized`
- `404 Not Found`

---

## Webhooks (System-to-System)

**⚠️ These endpoints are PUBLIC and do NOT require authentication. They are called by external providers (WhatsApp, Telegram, etc.).**

### GET /webhooks/whatsapp
**Auth Required:** No (Public Webhook)

**Query Parameters:**
- `hub.mode` (required) - Must be `subscribe`
- `hub.verify_token` (required) - Must match `WHATSAPP_VERIFY_TOKEN` env var
- `hub.challenge` (required) - Challenge string from WhatsApp

**Response:** `200 OK`
- Returns `hub.challenge` if token is valid

**Response:** `403 Forbidden`
- Returns `"Forbidden"` if token is invalid

**Notes:** WhatsApp webhook verification endpoint. Called by WhatsApp during webhook setup.

---

### POST /webhooks/whatsapp
**Auth Required:** No (Public Webhook)

**Request Body:**
- Raw WhatsApp webhook payload (varies by event type)

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

**Response:** `403 Forbidden`
- If webhook validation fails

**Notes:** Receives WhatsApp webhook events (message status updates, incoming messages, etc.). Backend validates and processes events.

---

## SSE (Server-Sent Events)

### GET /sse/workspace/:workspaceId
**Auth Required:** Yes

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `workspaceId` (string) - Workspace ID (must match token's workspace)

**Response:** `200 OK` (Event Stream)
- Content-Type: `text/event-stream`
- Stream of events:

```
data: {"type":"MESSAGE_CREATED","data":{"workspaceId":"clx_ws_123","messageId":"clx_msg_123",...}}

data: {"type":"CONVERSATION_UPDATED","data":{"workspaceId":"clx_ws_123","conversationId":"clx_conv_123",...}}

data: {"type":"CONTACT_UPDATED","data":{"workspaceId":"clx_ws_123","contactId":"clx_contact_123",...}}
```

**Errors:**
- `401 Unauthorized` - Invalid/missing token
- `403 Forbidden` - User doesn't have access to requested workspace

**Notes:** Real-time event stream. Client must maintain connection. Events are filtered by workspace.

**Event Types:**
- `MESSAGE_CREATED` - New message (inbound or outbound)
- `CONVERSATION_UPDATED` - Conversation status/content changed
- `CONTACT_UPDATED` - Contact data changed

---

## Important Integration Flows

### 1. Send Message Flow

```
1. POST /messages
   Body: { contactId, text, channel?, idempotencyKey? }
   → Returns message with status PENDING

2. Backend processes async:
   - Creates/updates conversation
   - Sends via provider integration
   - Updates message status (SENT → DELIVERED → READ)

3. Frontend can:
   - Poll GET /messages/:id to check status
   - Listen to SSE for MESSAGE_CREATED event
   - Check GET /messages/conversation/:conversationId for updates
```

---

### 2. List Conversations Flow

```
1. GET /conversations?status=OPEN&limit=50&cursor=<last_id>
   → Returns paginated list

2. For each conversation:
   - GET /messages/conversation/:conversationId
     → Get messages in conversation

3. Use SSE to listen for CONVERSATION_UPDATED events
```

---

### 3. Fetch Messages of Conversation

```
GET /messages/conversation/:conversationId
→ Returns all messages (no pagination)

Note: May return large lists. Consider pagination in future.
```

---

### 4. Create Campaign Flow

```
1. POST /campaigns
   Body: { name, channel, templateId, contactIds, ... }
   → Returns campaign with status DRAFT

2. POST /campaigns/:id/start
   → Returns runId, campaign starts executing

3. Poll GET /campaigns/:id/progress?runId=<runId>
   → Track progress (totalJobs, completedJobs, progressPercent)

4. Use GET /campaigns/:id/runs to see all runs
```

---

### 5. Campaign Status/Progress

```
GET /campaigns/:id/progress
→ Returns:
{
  runId, runNumber, status,
  totalJobs, pendingJobs, processingJobs,
  completedJobs, failedJobs, skippedJobs,
  progressPercent, startedAt
}

Status values: PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED
```

---

### 6. Template Creation & Listing

```
1. POST /templates
   Body: { name, channel, category }
   → Creates template

2. POST /templates/:id/versions
   Body: { body, headerType?, headerContent?, footer? }
   → Creates version (status: DRAFT)

3. POST /templates/:id/versions/:version/submit
   → Status → PENDING

4. POST /templates/:id/versions/:version/approve
   → Status → APPROVED

5. POST /templates/:id/versions/:version/sync
   → Syncs to provider (WhatsApp/Telegram)

6. GET /templates/:id/versions/latest/approved
   → Get latest approved version for use in campaigns
```

---

### 7. Contact Import/Export

**Import:**
- Currently no bulk import endpoint
- Use `POST /contacts` in a loop (or batch in future)

**Export:**
- Currently no export endpoint
- Use `GET /contacts` to fetch all contacts (no pagination)

**Note:** Both features may need to be added for production use.

---

## Inconsistencies & Notes

### Missing Pagination

The following endpoints return all items without pagination:
- `GET /contacts` - May return large lists
- `GET /campaigns` - May return large lists
- `GET /templates` - May return large lists
- `GET /integrations` - May return large lists
- `GET /messages/conversation/:conversationId` - May return large lists

**Recommendation:** Add cursor-based pagination to these endpoints.

---

### Missing Filtering

Some list endpoints lack filtering options:
- `GET /contacts` - No search/filter by name/phone/email
- `GET /media` - No filter by mimeType/size
- `GET /templates` - Has filtering, but no search by name

**Recommendation:** Add search/filter parameters.

---

### Non-Standard Response Formats

- Most endpoints return arrays directly, but some may benefit from pagination metadata:
  ```json
  {
    "data": [...],
    "pagination": {
      "hasMore": true,
      "nextCursor": "..."
    }
  }
  ```

- Error responses may vary - some return `{ message: "..." }`, others return `{ error: "..." }`

**Recommendation:** Standardize error response format.

---

### Workspace Scoping

✅ **All endpoints properly scope to workspace** - No inconsistencies found.

All endpoints:
- Use `req.workspace.id` from `WorkspacesGuard`
- Filter queries by `workspaceId`
- Validate workspace membership

---

### Missing Features

1. **Contact Import/Export:** No bulk import/export endpoints
2. **Search:** No full-text search endpoints
3. **Workspace Switching:** Requires re-login (no workspace switch endpoint)
4. **File Downloads:** Media endpoints return URLs but no direct download endpoint
5. **Webhook Management:** No CRUD endpoints for managing webhook configurations

---

## Summary

**Total Endpoints:** ~100+

**Modules:**
- Auth: 2 endpoints
- App/Workspace Context: 3 endpoints
- Workspaces: 11 endpoints
- Contacts: 6 endpoints
- Conversations: 8 endpoints
- Messages: 4 endpoints
- Campaigns: 11 endpoints
- Templates: 13 endpoints
- Media: 6 endpoints
- Usage: 6 endpoints
- Analytics: 8 endpoints
- Internal Notes: 8 endpoints
- Integrations: 15 endpoints
- Webhooks: 2 endpoints (public)
- SSE: 1 endpoint

**Authentication:** JWT Bearer token with workspace context

**Pagination:** Cursor-based (where implemented)

**Real-Time:** SSE for MESSAGE_CREATED, CONVERSATION_UPDATED, CONTACT_UPDATED

**Async Operations:** Campaigns, template/media sync

---

**Document Generated:** February 4, 2026  
**Backend Version:** MsgBuddy v2 (NestJS)
