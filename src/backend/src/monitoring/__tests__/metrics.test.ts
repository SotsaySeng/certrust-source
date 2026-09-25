import {
  register,
  credentialsIssuedTotal,
  credentialsRevokedTotal,
  credentialsVerifiedTotal,
  achievementsCreatedTotal,
} from '../metrics'

describe('monitoring metrics', () => {
  beforeEach(() => {
    register.resetMetrics()
  })

  it('serializes in Prometheus text exposition format', async () => {
    const text = await register.metrics()
    expect(text).toContain('# HELP certrust_credentials_issued_total')
    expect(text).toContain('# TYPE certrust_credentials_issued_total counter')
  })

  it('increments credentialsIssuedTotal', async () => {
    credentialsIssuedTotal.inc()
    credentialsIssuedTotal.inc()
    const text = await register.metrics()
    expect(text).toMatch(/certrust_credentials_issued_total 2/)
  })

  it('increments credentialsRevokedTotal', async () => {
    credentialsRevokedTotal.inc()
    const text = await register.metrics()
    expect(text).toMatch(/certrust_credentials_revoked_total 1/)
  })

  it('increments achievementsCreatedTotal', async () => {
    achievementsCreatedTotal.inc()
    const text = await register.metrics()
    expect(text).toMatch(/certrust_achievements_created_total 1/)
  })

  it('tracks credentialsVerifiedTotal by result label', async () => {
    credentialsVerifiedTotal.inc({ result: 'valid' })
    credentialsVerifiedTotal.inc({ result: 'invalid' })
    credentialsVerifiedTotal.inc({ result: 'invalid' })
    const text = await register.metrics()
    expect(text).toMatch(/certrust_credentials_verified_total{result="valid"} 1/)
    expect(text).toMatch(/certrust_credentials_verified_total{result="invalid"} 2/)
  })

  it('includes default process metrics', async () => {
    const text = await register.metrics()
    expect(text).toContain('certrust_process_cpu_user_seconds_total')
  })
})
