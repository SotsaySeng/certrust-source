import knexFactory from 'knex'
import { revocationListExtension } from '../revocation-list'

const TABLE = 'revocation_lists'
const open: Array<{ destroy: () => Promise<void> }> = []
afterEach(async () => {
  await Promise.all(open.splice(0).map(k => k.destroy()))
})

/**
 * A fake `strapi` over a real in-memory SQLite table, so the in-place
 * index/revocation SQL actually runs.
 */
async function createFakeStrapi() {
  const knex = knexFactory({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
  open.push(knex)
  await knex.schema.createTable(TABLE, (t) => {
    t.increments('id')
    t.string('document_id')
    t.integer('issuer')
    t.string('status_list_credential')
    t.string('status_purpose')
    t.text('encoded_list')
    t.integer('next_index')
    t.datetime('last_updated')
    t.datetime('published_at')
  })
  const profiles = new Map<number, any>([[1, { id: 1, name: 'Test Issuer' }]])
  const toEntity = (row: any) => row && {
    id: row.id,
    documentId: row.document_id,
    issuer: row.issuer,
    statusListCredential: row.status_list_credential,
    statusPurpose: row.status_purpose,
    encodedList: row.encoded_list,
    nextIndex: row.next_index,
  }
  let creates = 0

  const strapi = {
    db: {
      connection: knex,
      metadata: { get: () => ({ tableName: TABLE }) },
      getSchemaName: () => undefined,
      config: { connection: { client: 'sqlite' } },
    },
    documents: () => ({
      create: async ({ data }: any) => {
        creates++
        const documentId = `doc-${creates}`
        const row = {
          document_id: documentId,
          issuer: data.issuer,
          status_list_credential: data.statusListCredential,
          status_purpose: data.statusPurpose,
          encoded_list: data.encodedList,
          next_index: data.nextIndex,
        }
        // Let concurrent callers interleave, as a real database round trip would.
        await new Promise(resolve => setTimeout(resolve, 5))
        const [id] = await knex(TABLE).insert({ ...row, published_at: new Date() })
        return toEntity(await knex(TABLE).where({ id }).first())
      },
    }),
    entityService: {
      findOne: async (contentType: string, id: number) => {
        if (contentType === 'api::profile.profile') return profiles.get(id) || null
        if (contentType === 'api::revocation-list.revocation-list') return toEntity(await knex(TABLE).where({ id }).first()) || null
        throw new Error(`Unexpected content type: ${contentType}`)
      },
      findMany: async (contentType: string, { filters }: any) => {
        if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
        const rows = await knex(TABLE)
          .where({ issuer: filters.issuer?.id, status_purpose: filters.statusPurpose })
          .whereNotNull('published_at')
          .orderBy('id')
        return rows.map(toEntity)
      },
    },
  }

  const published = async () => (await knex(TABLE).whereNotNull('published_at')).map(toEntity)
  return { strapi, knex, published, allRows: () => knex(TABLE).orderBy('id') }
}

describe('revocation-list service', () => {
  it('creates an empty status list for an issuer', async () => {
    const { strapi } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)

    const list = await service.createStatusListCredential(1)

    expect(list.issuer).toBe(1)
    expect(list.nextIndex).toBe(0)
    expect(list.statusListCredential).toMatch(/^urn:uuid:/)
  })

  it('getOrCreateActiveListForIssuer reuses an existing list', async () => {
    const { strapi, published } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)

    const first = await service.getOrCreateActiveListForIssuer(1)
    const second = await service.getOrCreateActiveListForIssuer(1)

    expect(second.id).toBe(first.id)
    expect(await published()).toHaveLength(1)
  })

  it('getOrCreateActiveListForIssuer creates one list for concurrent first calls', async () => {
    const { strapi, published } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)

    const lists = await Promise.all(Array.from({ length: 10 }, () => service.getOrCreateActiveListForIssuer(1)))

    expect(new Set(lists.map(l => l.id)).size).toBe(1)
    expect(await published()).toHaveLength(1)
  })

  it('assignNextIndex hands out sequential, non-repeating indices', async () => {
    const { strapi } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    const first = await service.assignNextIndex(list)
    const second = await service.assignNextIndex(list.id)

    expect(first).toBe(0)
    expect(second).toBe(1)
  })

  it('assignNextIndex gives concurrent callers distinct indices without moving the row', async () => {
    const { strapi, allRows } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    const indices = await Promise.all(Array.from({ length: 25 }, () => service.assignNextIndex(list)))

    expect(new Set(indices).size).toBe(25)
    expect(Math.max(...indices)).toBe(24)
    // Same row, same id, counter at 25.
    const rows = await allRows()
    expect(rows.map(r => r.id)).toEqual([1])
    expect(rows.map(r => r.next_index)).toEqual([25])
  })

  it('checkStatusInList is false for an empty list', async () => {
    const { strapi } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    expect(await service.checkStatusInList(list, 0)).toBe(false)
  })

  it('revokeCredentialInStatusList flips the bit, checkStatusInList sees it', async () => {
    const { strapi } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)
    const index = await service.assignNextIndex(list)

    await service.revokeCredentialInStatusList(list.id, index)
    const updatedList = await strapi.entityService.findOne('api::revocation-list.revocation-list', list.id)

    expect(await service.checkStatusInList(updatedList, index)).toBe(true)
    expect(await service.checkStatusInList(updatedList, index + 1)).toBe(false)
  })

  it('revokeCredentialInStatusList is idempotent (revoking twice keeps one entry)', async () => {
    const { strapi } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    await service.revokeCredentialInStatusList(list.id, 5)
    await service.revokeCredentialInStatusList(list.id, 5)
    const updatedList = await strapi.entityService.findOne('api::revocation-list.revocation-list', list.id)

    expect(updatedList.encodedList).toBe('5')
  })

  it('revokeCredentialInStatusList keeps every index when revocations overlap', async () => {
    const { strapi } = await createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    await Promise.all([3, 1, 2].map(i => service.revokeCredentialInStatusList(list.id, i)))
    const updatedList = await strapi.entityService.findOne('api::revocation-list.revocation-list', list.id)

    expect(updatedList.encodedList).toBe('1,2,3')
  })
})
