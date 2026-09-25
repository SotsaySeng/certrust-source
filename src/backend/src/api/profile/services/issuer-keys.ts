/**
 * Per-issuer signing keypairs.
 *
 * Each issuer profile gets its own Ed25519 keypair the first time it's
 * needed (find-or-create, mirroring credential.ts's findOrCreateUser). The
 * private key is encrypted at rest in the issuer-key content type (which has
 * no REST routes at all - see its schema.json), and the issuer-key record is
 * the authoritative home of the public key too.
 *
 * It deliberately does NOT write the public key back onto the issuer's
 * profile. It used to (mirrorPublicKeyOntoProfile, removed), and that one
 * write broke the first issuance of every new organization:
 *
 *   `profile` is a draftAndPublish content type, and entityService.update()
 *   on a published entry delegates to documents().update({status:'published'})
 *   (verified in @strapi/core's entity-service compat layer), which
 *   re-publishes by DELETING the published row and cloning the draft into a
 *   new one - with a new numeric id. Every relation that pointed at the old
 *   published profile row is dropped with it.
 *
 * Since key creation happens lazily on the first signature, that republish
 * landed in the middle of the first batch issuance, with two consequences:
 * the other recipients in the same batch (batchIssue runs them through
 * Promise.all) were still holding the now-deleted numeric profile id, so
 * their issuer_keys_profile_lnk inserts died on a FOREIGN KEY constraint and
 * createStatusListCredential reported "Issuer not found"; and the
 * achievement's own `creator` link - which pointed at that published profile
 * row - was silently deleted, permanently breaking the achievement with
 * "Achievement creator not found" on every later attempt.
 *
 * Signing must not mutate the issuer's identity record. Readers that want the
 * public key on a profile now resolve it from here instead - see
 * api::profile.profile's getPublicKeys/getJWKS/getIssuer, which merge this
 * record in, and verification.ts, which already preferred it.
 */

import type { CryptoKey, JWK } from 'jose'
import { encrypt, decrypt } from '../../../utils/key-encryption'

interface KeyPairResult {
  privateKey: CryptoKey
  publicKeyJwk: JWK
}

/**
 * In-flight getOrCreateKeyPair calls, keyed by profile id.
 *
 * Without this, find-or-create is a plain read-then-write race, and
 * credential.batchIssue runs its recipients through Promise.all - so a first
 * batch of N certificates for a brand-new issuer had all N calls miss the
 * lookup and create N *different* keypairs for the same profile. Each
 * certificate was then signed with whichever key its own call generated,
 * while getPublicKey() (and therefore verification) only ever returns the one
 * row findOne picks. The result was silent and nasty: the credentials issued
 * fine, were emailed out, and then failed verification with "Signature
 * verification failed" for every recipient whose key was not the one that
 * happened to win the lookup.
 *
 * Module scope, so it is shared by every caller in this process - the same
 * shape as the auth store's init() promise on the frontend.
 */
const inFlightKeyPairs = new Map<string, Promise<KeyPairResult>>()

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Returns the issuer's signing keypair, generating and persisting one on
   * first use.
   */
  async getOrCreateKeyPair(profileId: number | string): Promise<KeyPairResult> {
    const cacheKey = String(profileId)

    // Concurrent callers (a batch issuance, in practice) share one call
    // instead of each racing to create their own keypair - see
    // inFlightKeyPairs' comment.
    const pending = inFlightKeyPairs.get(cacheKey)
    if (pending) {
      return pending
    }

    const promise = this.resolveKeyPair(profileId).finally(() => {
      inFlightKeyPairs.delete(cacheKey)
    })
    inFlightKeyPairs.set(cacheKey, promise)
    return promise
  },

  /** The real find-or-create; always reached through getOrCreateKeyPair. */
  async resolveKeyPair(profileId: number | string): Promise<KeyPairResult> {
    const { importPKCS8 } = await import('jose')
    const query = strapi.db.query('api::issuer-key.issuer-key')

    const loadFrom = async (record: any): Promise<KeyPairResult> => {
      const pkcs8 = decrypt(record.privateKeyEncrypted)
      return { privateKey: await importPKCS8(pkcs8, 'EdDSA'), publicKeyJwk: record.publicKeyJwk }
    }

    const existing = await query.findOne({ where: { profile: profileId } })
    if (existing) {
      return loadFrom(existing)
    }

    const { generateKeyPair, exportJWK, exportPKCS8 } = await import('jose')
    const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
      crv: 'Ed25519',
      extractable: true,
    })

    const publicKeyJwk = await exportJWK(publicKey)
    const pkcs8 = await exportPKCS8(privateKey)

    const created = await query.create({
      data: {
        profile: profileId,
        algorithm: 'Ed25519',
        publicKeyJwk,
        privateKeyEncrypted: encrypt(pkcs8),
      },
    })

    // The in-flight map only covers this process. If a second one (another
    // instance, or a worker) created a key for the same profile at the same
    // moment, sign with whichever row the lookup settles on, because that is
    // the one getPublicKey() will hand verifiers later. Signing with our own
    // losing row would produce a credential nothing could verify.
    const canonical = await query.findOne({ where: { profile: profileId } })
    if (canonical && canonical.id !== created.id) {
      strapi.log.warn(`[issuer-keys] Concurrent keypair creation for profile ${profileId}; using key ${canonical.id} and discarding ${created.id}.`)
      await query.delete({ where: { id: created.id } })
      return loadFrom(canonical)
    }

    return { privateKey, publicKeyJwk }
  },

  /**
   * Returns the issuer's public key (for verification), or null if the
   * issuer has never signed anything yet.
   */
  async getPublicKey(profileId: number | string) {
    const record = await strapi.db.query('api::issuer-key.issuer-key').findOne({
      where: { profile: profileId },
    })
    if (!record) return null

    const { importJWK } = await import('jose')
    return importJWK(record.publicKeyJwk, 'EdDSA')
  },

  /**
   * The issuer's public key shaped like a badge.public-key component entry,
   * so profile read paths can present it exactly as the mirrored component
   * used to look, without anything having to be written to the profile.
   * Returns null when this profile has never signed anything.
   */
  async getPublicKeyEntry(profileId: number | string) {
    const record = await strapi.db.query('api::issuer-key.issuer-key').findOne({
      where: { profile: profileId },
    })
    if (!record) return null

    const baseUrl = strapi.config.get('server.url', 'http://localhost:1337')
    return {
      id: `${profileId}-issuer-key`,
      identifier: `${baseUrl}/api/profiles/${profileId}/keys`,
      type: 'Ed25519VerificationKey2020',
      controller: `${baseUrl}/api/profiles/${profileId}/issuer`,
      publicKeyJwk: record.publicKeyJwk,
    }
  },

  /**
   * A profile's public keys: whatever is stored on the profile itself (older
   * profiles that were mirrored onto before that was removed, or externally
   * supplied keys) plus this issuer's own key. Deduplicated on the JWK's `x`
   * so a profile that still carries a mirrored copy doesn't list it twice.
   */
  async publicKeysForProfile(profile: any) {
    const stored = Array.isArray(profile?.publicKey) ? profile.publicKey : []
    const own = await this.getPublicKeyEntry(profile?.id)
    if (!own) return stored

    const alreadyListed = stored.some((key: any) => key?.publicKeyJwk?.x && key.publicKeyJwk.x === (own.publicKeyJwk as any)?.x)
    return alreadyListed ? stored : [...stored, own]
  },
})
