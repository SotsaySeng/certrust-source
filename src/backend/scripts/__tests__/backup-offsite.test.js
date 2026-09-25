const fs = require('fs')
const path = require('path')
const { offsiteBackup } = require('../backup-offsite')

const ENV = {
  BACKUP_S3_BUCKET: 'certrust-backups',
  S3_BUCKET: 'certrust-files',
}

function fakeS3({ source = [], mirrored = [] } = {}) {
  const calls = []
  const send = async command => {
    const name = command.constructor.name
    calls.push({ name, input: command.input })
    if (name === 'ListObjectsV2Command') {
      const list = command.input.Bucket === 'certrust-files' ? source : mirrored
      return { Contents: list, IsTruncated: false }
    }
    return {}
  }
  return { send, calls }
}

const fakeDump = (_connection, outDir) => {
  const file = path.join(outDir, 'db.dump')
  fs.writeFileSync(file, 'PGDMP-fake')
  return file
}

describe('offsiteBackup', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    process.env.DATABASE_CLIENT = 'postgres'
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it('uploads the dump under its label and mirrors only new or changed uploads', async () => {
    const { send, calls } = fakeS3({
      source: [
        { Key: 'logo.svg', Size: 10, ETag: '"a"' },
        { Key: 'badge.png', Size: 20, ETag: '"b"' },
        { Key: 'changed.png', Size: 30, ETag: '"new"' },
      ],
      mirrored: [
        { Key: 'uploads/logo.svg', Size: 10, ETag: '"a"' },
        { Key: 'uploads/changed.png', Size: 30, ETag: '"old"' },
      ],
    })

    const result = await offsiteBackup({
      label: 'predeploy',
      env: ENV,
      now: new Date('2026-10-14T03:00:00Z'),
      send,
      dump: fakeDump,
    })

    const puts = calls.filter(c => c.name === 'PutObjectCommand')
    expect(puts).toHaveLength(1)
    expect(puts[0].input.Bucket).toBe('certrust-backups')
    expect(puts[0].input.Key).toMatch(/^db\/predeploy\/2026-10-14T03-00-00-000Z\.dump$/)
    expect(String(puts[0].input.Body)).toBe('PGDMP-fake')

    const copies = calls.filter(c => c.name === 'CopyObjectCommand').map(c => c.input)
    expect(copies).toEqual([
      { Bucket: 'certrust-backups', Key: 'uploads/badge.png', CopySource: 'certrust-files/badge.png' },
      { Bucket: 'certrust-backups', Key: 'uploads/changed.png', CopySource: 'certrust-files/changed.png' },
    ])
    expect(result.uploads).toEqual({ copied: 2, unchanged: 1 })
  })

  it('keeps an extra monthly copy from the first daily run of a month', async () => {
    const { send, calls } = fakeS3()

    await offsiteBackup({ label: 'daily', env: ENV, now: new Date('2026-11-01T02:00:00Z'), send, dump: fakeDump })

    const keys = calls.filter(c => c.name === 'PutObjectCommand').map(c => c.input.Key)
    expect(keys).toEqual([expect.stringMatching(/^db\/daily\//), 'db/monthly/2026-11.dump'])
  })

  it('refuses to run against a non-postgres database', async () => {
    process.env.DATABASE_CLIENT = 'sqlite'
    const { send } = fakeS3()
    await expect(offsiteBackup({ env: ENV, send, dump: fakeDump })).rejects.toThrow(/DATABASE_CLIENT=postgres/)
  })

  it('requires a backup bucket', async () => {
    const { send } = fakeS3()
    await expect(offsiteBackup({ env: {}, send, dump: fakeDump })).rejects.toThrow(/BACKUP_S3_BUCKET/)
  })
})
