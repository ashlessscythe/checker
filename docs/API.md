# Public API (v1)

A read-only HTTP API for pulling users and punches (check-ins/check-outs) out of Checker.

- **Base path:** `/api/v1`
- **Format:** JSON responses, `GET` only (other methods return `405` with `Allow: GET`)
- **Rate limit:** 60 requests per minute per API key (per server process)

## Authentication

Create a key in the Admin panel (API keys section). The full secret (`chk_` + 64 hex characters) is shown **once** at creation; only a hash is stored. Send it as a bearer token:

```bash
curl -H "Authorization: Bearer chk_<64 hex chars>" "https://your-host/api/v1/users"
```

Keys can be revoked from the admin panel; revoked keys are rejected immediately.

## Errors

All errors are `{ "error": "message" }`.

| Status | Meaning |
| ------ | ------- |
| 400 | Invalid query parameter (message explains which) |
| 401 | Missing, malformed, unknown, or revoked key (`Invalid API key`) |
| 405 | Method not allowed |
| 429 | Rate limit exceeded; includes `Retry-After: 60` |
| 500 | Server error |

## `GET /api/v1/users`

Lists users, sorted by name (case-insensitive).

| Param | Required | Description |
| ----- | -------- | ----------- |
| `name` | no | Exact match, case-insensitive |
| `email` | no | Exact match, case-insensitive |
| `dept` | no | Matches department name **or** department ID, case-insensitive |
| `limit` | no | Positive integer. Default 100, max 500 (larger values are capped) |

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "department": { "id": "uuid", "name": "Shipping", "departmentId": "SHP" }
    }
  ],
  "meta": { "count": 1, "limit": 100 }
}
```

`department` is `null` if the user has none.

## `GET /api/v1/punches`

Lists punches in a time range, newest first.

| Param | Required | Description |
| ----- | -------- | ----------- |
| `from` | **yes** | ISO-8601 start (inclusive) |
| `to` | **yes** | ISO-8601 end (inclusive). Must be ≥ `from`; range may not exceed 366 days |
| `userId` | no | Exact user ID |
| `name` | no | Exact user name, case-insensitive |
| `email` | no | Exact user email, case-insensitive |
| `type` | no | Punch type, exact match (e.g. `in` / `out`) |
| `limit` | no | Positive integer. Default 100, max 500 |

User filters (`userId`, `name`, `email`) combine with AND. If they match no user, the result is empty.

```bash
curl -H "Authorization: Bearer $CHECKER_KEY" \
  "https://your-host/api/v1/punches?from=2026-11-01T00:00:00Z&to=2026-11-23T23:59:59Z&limit=50"
```

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "in",
      "timestamp": "2026-11-23T13:02:11.000Z",
      "user": {
        "id": "uuid",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "department": { "id": "uuid", "name": "Shipping", "departmentId": "SHP" }
      }
    }
  ],
  "meta": { "count": 1, "limit": 50 }
}
```

`user` is `null` if the punch's user no longer exists.

## Key management (admin only)

These require a signed-in admin session, not an API key.

| Endpoint | Description |
| -------- | ----------- |
| `GET /api/admin/api-keys` | List keys (never includes secrets) |
| `POST /api/admin/api-keys` | Body `{ "name": "..." }` (max 80 chars). Returns the key including its one-time `secret` |
| `DELETE /api/admin/api-keys/:id` | Revoke a key (idempotent) |
