/**
 * Refuse to start a production instance whose data or uploads would live on
 * the container's own disk.
 *
 * On Cloudflare Containers (and most container hosts) that disk is wiped on
 * every sleep, redeploy and rebuild. A single missing env var - DATABASE_CLIENT
 * falling back to its sqlite default, or UPLOAD_PROVIDER unset so uploads go
 * to public/uploads - would not fail at all: the app would run normally and
 * quietly lose every credential or image at the next restart. Failing the
 * boot instead turns that into an obvious deploy error.
 *
 * Hosts that do give the container a persistent volume (e.g. the
 * docker-compose setup, which mounts uploads-data) can opt out with
 * ALLOW_LOCAL_STORAGE=true.
 */

export interface StorageProblem {
  setting: string
  value: string
  fix: string
}

export function findStorageProblems(env: NodeJS.ProcessEnv): StorageProblem[] {
  if (env.NODE_ENV !== 'production') return []
  if (String(env.ALLOW_LOCAL_STORAGE).toLowerCase() === 'true') return []

  const problems: StorageProblem[] = []

  const dbClient = env.DATABASE_CLIENT || 'sqlite'
  if (dbClient !== 'postgres') {
    problems.push({
      setting: 'DATABASE_CLIENT',
      value: dbClient,
      fix: 'set DATABASE_CLIENT=postgres and point DATABASE_* at the managed database',
    })
  }

  const uploadProvider = env.UPLOAD_PROVIDER || 'local'
  if (uploadProvider !== 's3') {
    problems.push({
      setting: 'UPLOAD_PROVIDER',
      value: uploadProvider,
      fix: 'set UPLOAD_PROVIDER=s3 with the S3_* settings for the object storage bucket',
    })
  }

  return problems
}

export function assertPersistentStorage(env: NodeJS.ProcessEnv = process.env): void {
  const problems = findStorageProblems(env)
  if (problems.length === 0) return

  const details = problems.map(p => `  - ${p.setting}=${p.value}: ${p.fix}`).join('\n')
  throw new Error(
    `[PersistenceGuard] Refusing to start: in production this data would be stored on the ` +
      `container's own disk, which is wiped on every restart/redeploy.\n${details}\n` +
      `(Set ALLOW_LOCAL_STORAGE=true only if this host has a persistent volume.)`
  )
}
