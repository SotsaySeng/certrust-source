/**
 * GET /robots.txt
 *
 * A route rather than public/robots.txt so the Sitemap line uses the real
 * site URL (the static file shipped "http://localhost:3000/sitemap.xml").
 *
 * One group for everyone: a crawler that matches a named group ignores the
 * `*` group entirely, so per-bot groups silently re-opened the private pages.
 * /credentials/ stays crawlable for search engines, which need to fetch the
 * page to see its noindex header, but AI agents only honour robots.txt, and
 * those pages carry people's names (Privacy Policy s.4).
 */
const PRIVATE_PATHS = [
  '/admin', '/dashboard', '/billing', '/profile', '/issue', '/scheduled',
  '/api-keys', '/achievements', '/design-templates', '/events', '/report',
  '/auth/', '/oauth/', '/reset-password', '/forgot-password',
]

const AI_AGENTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User',
  'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent',
]

export default defineEventHandler((event) => {
  const { site } = publicUrls(event)
  const disallow = PRIVATE_PATHS.map(p => `Disallow: ${p}`).join('\n')
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return `# Content Signals: https://contentsignals.org/
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
${disallow}

${AI_AGENTS.map(a => `User-agent: ${a}`).join('\n')}
Content-Signal: search=yes, ai-input=yes, ai-train=no
${disallow}
Disallow: /credentials/

Sitemap: ${site}/sitemap.xml
`
})
