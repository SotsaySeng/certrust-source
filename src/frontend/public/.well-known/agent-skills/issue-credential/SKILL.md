# Issue Credential

Issue an Open Badges 3.0 credential to a recipient via Certrust.

## API

```
POST /api/credentials/issue
Authorization: Bearer {crt_api-key}
Idempotency-Key: {unique-id-for-this-issuance}
Content-Type: application/json

{
  "data": {
    "achievementId": 1,
    "recipient": { "email": "alice@example.com", "name": "Alice" },
    "expirationDate": "2027-12-31"
  }
}
```

## Response

```json
{
  "credential": { "id": 42, "documentId": "abc123...", "credentialId": "urn:uuid:abc-123" },
  "openBadge": { "...": "the signed Open Badges 3.0 credential" },
  "notification": { "...": "email delivery details" }
}
```

## MCP Tool

`issue_credential` — available via `@certrust/mcp`

```json
{
  "achievement_id": 1,
  "recipient_email": "alice@example.com",
  "recipient_name": "Alice",
  "expiration_date": "2027-12-31"
}
```

## Prerequisites

1. An organization API key with the `issue` permission (Manage → API keys; paid plans)
2. An existing achievement/badge definition (`achievementId`, its numeric id)

## Notes

- The recipient receives an email notification after issuance
- `expirationDate` is optional; omit for non-expiring credentials
- Use `POST /api/credentials/batch-issue` for issuing to multiple recipients at once
- Send an `Idempotency-Key` header so a retried request never issues twice: the same key with the same request returns the first response (kept 24 hours); the same key with a different request is refused with 422
- `GET /api/api-keys/me` shows which organization and permissions the key has
