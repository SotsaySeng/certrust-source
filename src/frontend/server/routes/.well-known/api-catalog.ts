/**
 * GET /.well-known/api-catalog
 *
 * RFC 9727 API Catalog — machine-readable discovery of Certrust's REST API.
 * Content-Type: application/linkset+json
 * https://www.rfc-editor.org/rfc/rfc9727
 */
export default defineEventHandler((event) => {
  const { api } = publicUrls(event)
  setResponseHeader(event, 'Content-Type', 'application/linkset+json')
  return {
    linkset: [
      {
        'anchor': `${api}/api`,
        // No 'service-desc': the backend's documentation plugin embeds the
        // OpenAPI spec in the Swagger UI page and serves no standalone JSON.
        'service-doc': [
          {
            href: `${api}/documentation`,
            type: 'text/html',
            title: 'Certrust API documentation (Swagger UI)',
          },
        ],
        'status': [
          {
            href: `${api}/api/health`,
            type: 'application/json',
            title: 'Health check endpoint',
          },
        ],
        // Prometheus metrics
        'https://www.iana.org/assignments/link-relations/monitoring': [
          {
            href: `${api}/api/metrics`,
            type: 'text/plain',
            title: 'Prometheus metrics endpoint',
          },
        ],
      },
    ],
  }
})
