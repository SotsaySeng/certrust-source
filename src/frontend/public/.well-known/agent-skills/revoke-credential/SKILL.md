# Revoke Credential

Revoke an issued credential, rendering it invalid for future verification.

## API

```
POST /api/credentials/{id}/revoke
Authorization: Bearer {crt_api-key}
Content-Type: application/json

{ "reason": "Employee left the organization" }
```

## Response

```json
{ "success": true, "credential": { "id": 42, "revoked": true } }
```

## MCP Tool

`revoke_credential` — available via `@certrust/mcp`

```json
{
  "credential_id": 42,
  "reason": "Employee left the organization"
}
```

## Notes

- Requires an organization API key with the `revoke` permission (Manage → API keys)
- Revocation is reflected immediately — verification returns `not_revoked: error`
- `reason` is optional but recommended for audit trail purposes
- Only the issuer of the credential can revoke it
