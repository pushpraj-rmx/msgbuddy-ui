# MsgBuddy API - Bruno Collection

This Bruno collection contains all API routes for the MsgBuddy v2 application.

## Setup

1. Open Bruno and import this collection folder
2. Update the `.env` file with your:
   - `baseUrl`: Your API server URL (default: `http://localhost:3456`)
   - `token`: Your access token (obtain from `Login` or `Register`; use as `Bearer <token>` or set `token = Bearer <accessToken>`)
   - `refreshToken`: (optional) Refresh token from login/register; used by `Refresh` and `Logout` requests

## Collection Structure

- **01-Auth**: Authentication and user management
- **02-Workspaces**: Workspace CRUD and member management
- **03-Contacts**: Contact management
- **04-Conversations**: Conversation management
- **05-Messages**: Message sending and status updates
- **06-Campaigns**: Campaign creation and execution
- **07-Templates**: Template management and versioning
- **08-Integrations**: Integration setup and management
- **09-Media**: Media file upload and sync
- **10-Internal**: Internal notes and team messages
- **11-Webhooks**: Webhook endpoints (public)
- **12-SSE**: Server-Sent Events for real-time updates
- **13-Analytics**: Analytics and reporting
- **14-Usage**: Usage tracking and limits

## Authentication

Auth uses short-lived **access tokens** (15 min) and long-lived **refresh tokens** (30 days). Most endpoints require the access token in the `Authorization: Bearer <accessToken>` header.

Public auth endpoints (marked with `auth: none`) include:
- Health check
- Register, Login, Refresh, Logout (Logout All requires a valid access token)

## Interactive API docs (Swagger)

With the server running, open [http://localhost:3456/docs](http://localhost:3456/docs) for Swagger UI.

## Getting Started

1. Call `Register` or `Login` to get `accessToken`, `refreshToken`, and `expiresIn`
2. Set `token = Bearer <accessToken>` in `.env` (or use Bruno's auth) so requests use the access token
3. Optionally set `refreshToken` in `.env` for the `Refresh` and `Logout` requests
4. When the access token expires, use `Refresh` (body: `{ "refreshToken": "..." }`) to get new tokens, then update `token` and `refreshToken`
5. Use `Logout` to revoke the current refresh token, or `Logout All` (with access token) to revoke all sessions

## Notes

- Replace placeholder IDs (e.g., `clx_ws_123`) with actual IDs from your workspace
- Query parameters are optional unless marked as required
- Some endpoints support pagination with `limit` and `cursor` parameters
- Date ranges in analytics endpoints default to last 30 days if not specified
