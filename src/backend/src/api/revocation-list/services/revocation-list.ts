/**
 * revocation-list service
 */

import { factories } from '@strapi/strapi'
import { errors } from '@strapi/utils'
import crypto from 'crypto'
const { ApplicationError } = errors

interface RevocationList {
  id: any
  issuer: any
  statusListCredential: string
  statusPurpose: string
  encodedList: string
  lastUpdated: Date
}

// Concurrent first-time lookups per issuer share one find-or-create
// (single backend instance, so in-process is enough - same approach as
// profile/services/issuer-keys.ts).
const listsInFlight = new Map<string, Promise<any>>()

/**
 * Run `fn` in a transaction holding a lock on the rows of the status list
 * document that row `id` belongs to.
 * SQLite needs no row lock: it allows one writer at a time.
 */
async function withListRowsLocked<T>(
  strapi: any,
  id: number | string,
  fn: (rows: any[], updateAll: (data: Record<string, unknown>) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  const table = strapi.db.metadata.get('api::revocation-list.revocation-list').tableName
  const schema = strapi.db.getSchemaName?.()
  const isPostgres = strapi.db.config?.connection?.client === 'postgres'
  return strapi.db.connection.transaction(async (trx: any) => {
    const from = () => (schema ? trx(table).withSchema(schema) : trx(table))
    const row = await from().select('document_id').where({ id }).first()
    if (!row) {
      throw new ApplicationError('Status list not found')
    }
    let query = from().select('id', 'next_index', 'encoded_list').where({ document_id: row.document_id }).orderBy('id')
    if (isPostgres) query = query.forUpdate()
    const rows = await query
    return fn(rows, data => from().where({ document_id: row.document_id }).update(data))
  })
}

// Exported separately (not just inline in createCoreService below) so unit
// tests can call it directly against a lightweight fake `strapi` without
// going through Strapi's core service factory, which needs a real app
// instance (strapi.contentType(), etc.) to construct the base CRUD methods.
export const revocationListExtension = ({ strapi }: { strapi: any }) => ({
  /**
   * Check if a credential has been revoked in any revocation list
   */
  async checkCredentialStatus(credentialId: string) {
    try {
      // Find the credential to get the issuer
      const credential = await strapi.db.query('api::credential.credential').findOne({
        where: { credentialId },
        populate: ['issuer']
      })
      
      if (!credential) {
        throw new ApplicationError('Credential not found')
      }
      
      // If the credential is directly marked as revoked
      if (credential.revoked) {
        return {
          revoked: true,
          reason: credential.revocationReason || 'Credential has been revoked'
        }
      }
      
      return { revoked: false }
    } catch (error) {
      console.error('Error checking credential status:', error)
      throw new ApplicationError(`Error checking credential status: ${error.message}`)
    }
  },
  
  /**
   * Check if a credential is revoked in a specific status list.
   *
   * Known simplification: encodedList is a comma-separated list of revoked
   * indices, not a real StatusList2021 GZIP+base64 bitstring. Fine as an
   * internal representation for a single-instance deployment; a real
   * bitstring encoding (for publishing a standards-compliant status list
   * credential externally) is a separate, larger task.
   */
  async checkStatusInList(statusList: RevocationList, statusListIndex: number) {
    try {
      const encodedList = statusList.encodedList
      if (!encodedList) return false

      const revokedIndices = encodedList.split(',').map(i => parseInt(i.trim(), 10))
      return revokedIndices.includes(statusListIndex)
    } catch (error) {
      console.error('Error checking status in list:', error)
      return false
    }
  },

  /**
   * Create a new status list credential for an issuer
   */
  async createStatusListCredential(issuerId: number | string, purpose = 'revocation') {
    try {
      // Find the issuer
      const issuer = await strapi.entityService.findOne('api::profile.profile', issuerId)

      if (!issuer) {
        throw new ApplicationError('Issuer not found')
      }

      // Create a unique ID for the status list credential
      const statusListId = `urn:uuid:${crypto.randomUUID()}`

      // Create an empty status list.
      const statusList = await strapi.documents('api::revocation-list.revocation-list').create({
        data: {
          issuer: issuerId,
          statusListCredential: statusListId,
          statusPurpose: purpose,
          encodedList: '', // Empty list to start
          nextIndex: 0,
          lastUpdated: new Date()
        },
      })

      return statusList
    } catch (error) {
      console.error('Error creating status list credential:', error)
      throw new ApplicationError(`Error creating status list credential: ${error.message}`)
    }
  },

  /**
   * Find the issuer's active revocation list, creating one if this is
   * their first credential.
   *
   * Batch issuance calls this once per recipient, concurrently. A plain
   * find-or-create there gave every recipient of an issuer's first batch
   * a list of its own (40 lists for 40 recipients, each handing out
   * index 0). Concurrent first calls now share one creation, and the
   * oldest list always wins so issuers already holding duplicates keep
   * using the same one.
   */
  async getOrCreateActiveListForIssuer(issuerId: number | string) {
    const key = String(issuerId)
    const pending = listsInFlight.get(key)
    if (pending) return pending
    const work = (async () => {
      const existing = await strapi.entityService.findMany('api::revocation-list.revocation-list', {
        filters: { issuer: { id: issuerId }, statusPurpose: 'revocation' },
        sort: { id: 'asc' },
      })
      if (existing && existing.length > 0) return existing[0]
      return this.createStatusListCredential(issuerId)
    })()
    listsInFlight.set(key, work)
    try {
      return await work
    }
    finally {
      listsInFlight.delete(key)
    }
  },

  /**
   * Reserve the next available index in a status list for a new credential.
   *
   * An atomic in-place increment under a row lock. Concurrent issuances in
   * a batch used to read the same counter and share an index, so revoking
   * one credential would have revoked the others.
   *
   * @param statusList the list (or its numeric id) from
   *   getOrCreateActiveListForIssuer
   */
  async assignNextIndex(statusList: number | string | { id: number | string, documentId?: string }) {
    const id = typeof statusList === 'object' ? statusList.id : statusList
    return withListRowsLocked(strapi, id, async (rows, updateAll) => {
      // A list document used to have a draft row too; taking the highest
      // is still correct with the single row it has now.
      const index = Math.max(0, ...rows.map(r => Number(r.next_index) || 0))
      await updateAll({ next_index: index + 1 })
      return index
    })
  },

  /**
   * Update a status list to revoke a credential. In place and under a row
   * lock, for the same reasons as assignNextIndex (two revocations at once
   * used to keep only one of the two indices).
   */
  async revokeCredentialInStatusList(statusListId: number | string, statusListIndex: number) {
    try {
      await withListRowsLocked(strapi, statusListId, async (rows, updateAll) => {
        const indices = new Set<number>()
        for (const row of rows) {
          for (const part of String(row.encoded_list || '').split(',')) {
            const n = parseInt(part.trim(), 10)
            if (!Number.isNaN(n)) indices.add(n)
          }
        }
        indices.add(statusListIndex)
        await updateAll({
          encoded_list: [...indices].sort((a, b) => a - b).join(','),
          last_updated: new Date(),
        })
      })
      return true
    } catch (error) {
      console.error('Error revoking credential in status list:', error)
      throw new ApplicationError(`Error revoking credential in status list: ${error.message}`)
    }
  }
})

export default factories.createCoreService('api::revocation-list.revocation-list', revocationListExtension)
