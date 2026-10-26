# Open Badges Implementation

## Spec version

Explicitly **Open Badges 3.0** (IMS Global), layered on **W3C Verifiable
Credentials v2**. Confirmed by the `@context` array used everywhere a credential
is serialized:

```json
[
  "https://www.w3.org/ns/credentials/v2",
  "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
]
```

There is no OBv2 support (no "badge baking" into PNG metadata — see
[strapi-and-credentials.md](./strapi-and-credentials.md#certificates)).

## Where it's implemented

Everything lives in
`src/backend/src/api/credential/services/open-badge.ts`, plus signing helpers
duplicated in `credential.ts` (see below).

### `serializeCredential(credentialId)`

Builds the full OBv3 `VerifiableCredential` / `OpenBadgeCredential` object from
a stored `credential` row:

- `@context`, `id` (= the stored `credentialId`, a `urn:uuid:...` string), `type: ['VerifiableCredential', 'OpenBadgeCredential']`
- `issuer`: `{ id: '<baseUrl>/api/profiles/<issuerId>/issuer', type: ['Profile'], name, url }`
- `issuanceDate` / `validFrom`
- `credentialSubject.id` = `mailto:<recipient email>` (if the recipient has an email)
- `credentialSubject.achievement`: `id`, `type: ['Achievement']`, `name`, `description`, `image`, `criteria.narrative`, and `alignments[]` (mapped from the `alignment` component) if present
- `credentialSubject.achievement.evidence[]` if the credential has evidence
- `credentialStatus` (StatusList2021Entry) if the credential has a slot in an
  issuer revocation list — see [strapi-and-credentials.md](./strapi-and-credentials.md#revocation)
- `expirationDate` if set
- `proof`: reuses the credential's stored proof if present; **otherwise signs
  the object on the fly** right here (see "Signing" below) — meaning
  `serializeCredential` can itself produce a new signature at read time, not
  just at issuance time, if the DB row somehow lacks a `proof`.

### `validateExternalCredential(credential)` / `validateCredentialFormat(credential)`

Used when someone submits an external OBv3 credential for verification/import.
Checks: has `id`, has `type` including both `VerifiableCredential` and
`OpenBadgeCredential`, has `issuer`, has `credentialSubject`, has
`issuanceDate`. Issuer verification: DIDs are auto-accepted
(`issuerVerified = true`, explicitly a placeholder), HTTP(S) issuer URLs are
checked against `findIssuerByUrl` (looks for a matching local `profile` by
numeric ID parsed out of a `/api/profiles/:id` URL — so this only recognizes
issuers that are also profiles in *this* Strapi instance). **Proof verification
here is a hardcoded `const proofVerified = true`** — explicitly a placeholder in
the code, not a real check.

### `importCredential(vcData)`

The reverse direction: takes an external OBv3 VC JSON and find-or-creates local
`profile` (issuer, keyed by `did`), `achievement` (keyed by
`achievementId`), `credential`, and `evidence` rows from it. This is the closest
thing in the codebase to an interoperability/import feature.

## Signing

- **Algorithm**: Ed25519 (`EdDSA`), via the `jose` npm package's `SignJWT`,
  producing a compact JWS string stored as `proof.jws`.
- **Proof shape**: `{ type: 'Ed25519Signature2020', created, verificationMethod, proofPurpose: 'assertionMethod', jws }`.
- **Key: per-issuer, generated on first use.** `src/backend/src/api/profile/services/issuer-keys.ts`'s
  `getOrCreateKeyPair(profileId)` is the single place a signing key is
  loaded from — both `credential.ts`'s `generateProof()` and
  `open-badge.ts`'s on-the-fly signing branch in `serializeCredential()`
  call it. On an issuer's first credential, it generates an Ed25519
  keypair (`jose.generateKeyPair('EdDSA', { crv: 'Ed25519' })`), encrypts
  the private key (AES-256-GCM, keyed by `ENCRYPTION_KEY` — see
  `utils/key-encryption.ts`) into a new `issuer-key` row (see
  [backend.md](./backend.md#content-types) — this content type has **no
  REST routes at all**, so it's unreachable except from server-side code),
  and mirrors the public JWK onto `profile.publicKey` so it's discoverable
  the normal Open Badges way. Every issuer now has its own key; the
  previous single-shared-key design is gone.
- **The old single-shared-key env var, `ED25519_PRIVATE_KEY_PKCS8`, is no
  longer read anywhere.** It's left defined (with a comment marking it
  legacy) in `docker-compose.yml` only so old container envs referencing it
  don't error.
- A real dev private/public keypair is still committed to the repo root
  (`ed25519-private.pem`, `ed25519-public.pem`) from the old design — it's
  unused now, just not yet deleted.

## Verification

`src/backend/src/api/credential/services/verification.ts`'s
`verifyCredential()` → `processCredentialResult()` checks, in order:

1. `credential.revoked` boolean.
2. `credential.expirationDate` vs now.
3. `verifyProof(credential)`.

**`verifyProof()` now performs real cryptographic verification** for
credentials issued by this instance: after the existing structural checks
(proof has all required fields, a `jws` or `proofValue`, a valid
`proofPurpose`, isn't absurdly old), it fetches the issuer's public key via
`issuer-keys.ts`'s `getPublicKey(issuerId)` and calls `jose.jwtVerify(proof.jws, publicKey)`,
returning `{ valid: false, ... }` on any signature mismatch, missing key, or
malformed JWS. A `proofValue`-only proof (no `jws`) is now explicitly
rejected as non-verifiable, rather than silently passing — see
[known-issues-and-dev-notes.md](./known-issues-and-dev-notes.md) item 1.

**This does not extend to external, third-party-issued credentials.**
`validateExternalCredential()`'s proof check (used when validating/importing
an OBv3 credential from *another* system) is still a hardcoded
`const proofVerified = true` placeholder — verifying an arbitrary external
issuer's signature needs DID resolution or fetching a remote key, which is a
separate, larger interoperability feature (not part of per-issuer key
management for *our own* issuers). Don't conflate the two: local credentials
are now really verified; externally-submitted ones are not yet.

## Endorsements

The `endorsement` content type mirrors the OBv3 Endorsement Credential shape
(`endorser`, `endorsedObject`, `claim`, `proof`) and has a controller `verify`
route (`endorsement-verify.ts`), but no dedicated serialization/signing service
comparable to `open-badge.ts` — it's less built out than `credential`.

## Wallets

The credential page offers two "keep it in a wallet" buttons next to
LinkedIn/Facebook/WhatsApp (`pages/credentials/[id]/index.vue`):

- **Open Badge file** - `GET /api/credentials/:id/open-badge` returns the
  signed OBv3 credential above as a `.json` download, for badge wallets
  (Credly, Canvas Credentials, Learner Credential Wallet). Issuer or
  recipient only (signed in), public or private: the signed
  `credentialSubject.id` is the recipient's email and cannot be removed
  without breaking the proof.
- **Google Wallet** - `GET /api/credentials/:id/google-wallet` returns
  `{ url }`, a `pay.google.com/gp/v/save/<jwt>` link. The JWT
  (`services/google-wallet.ts`) carries a Generic pass: issuer name, credential
  name, recipient name, dates, the Certrust logo and a QR code to the
  credential page. No certificate picture: Google rejects the whole pass
  ("Image cannot be loaded") when an image loads slowly, and the rendered
  certificate/badge images take ~3 s. Google's save page only says
  "Something went wrong" - to see the real error, insert the object with the
  Wallet REST API using the same service account. Same audience as the LinkedIn button;
  not offered for revoked credentials. A saved pass does not change when the
  credential is revoked later - its QR opens the live page, which says so.

Apple Wallet is not supported (it needs a paid Apple Developer account and a
Pass Type ID certificate to sign `.pkpass` files).

### Google Wallet setup (once)

1. [Google Pay & Wallet Console](https://pay.google.com/business/console) -
   create the issuer account; note the **Issuer ID**.
2. Google Cloud console - enable the **Google Wallet API**, create a service
   account, and download a JSON key for it.
3. Back in the Wallet Console - **Users**: add the service account's email.
   Then request **publishing access**; until Google approves it, only the
   test accounts listed in the console can save passes.
4. Set `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`
   (`client_email`) and `GOOGLE_WALLET_PRIVATE_KEY` (`private_key`) on the API
   and restart it. The button appears once all three are set. On Cloudflare:
   add them to `src/backend/.env.production` (see
   `deploy/cloudflare/env.production.example`), run
   `deploy/cloudflare/push-secrets.sh`, then `deploy/cloudflare/restart-api.sh`
   (the running container keeps its old settings until restarted, and only
   receives keys listed in `deploy/cloudflare/api/src/index.ts`).
