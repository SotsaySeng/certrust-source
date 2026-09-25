import { assertPersistentStorage, findStorageProblems } from '../persistence-guard'

const PROD_OK = { NODE_ENV: 'production', DATABASE_CLIENT: 'postgres', UPLOAD_PROVIDER: 's3' }

describe('persistence guard', () => {
  it('allows production with postgres and s3 uploads', () => {
    expect(findStorageProblems(PROD_OK)).toEqual([])
    expect(() => assertPersistentStorage(PROD_OK)).not.toThrow()
  })

  it('refuses production when uploads would go to local disk', () => {
    const env = { ...PROD_OK, UPLOAD_PROVIDER: undefined }
    expect(findStorageProblems(env).map(p => p.setting)).toEqual(['UPLOAD_PROVIDER'])
    expect(() => assertPersistentStorage(env)).toThrow(/UPLOAD_PROVIDER=local/)
  })

  it('refuses production when the database would be a local sqlite file', () => {
    const env = { ...PROD_OK, DATABASE_CLIENT: undefined }
    expect(() => assertPersistentStorage(env)).toThrow(/DATABASE_CLIENT=sqlite/)
  })

  it('reports both problems at once', () => {
    expect(findStorageProblems({ NODE_ENV: 'production' })).toHaveLength(2)
  })

  it('never blocks development', () => {
    expect(findStorageProblems({ NODE_ENV: 'development' })).toEqual([])
    expect(findStorageProblems({})).toEqual([])
  })

  it('can be opted out of on hosts with persistent volumes', () => {
    expect(findStorageProblems({ NODE_ENV: 'production', ALLOW_LOCAL_STORAGE: 'true' })).toEqual([])
  })
})
