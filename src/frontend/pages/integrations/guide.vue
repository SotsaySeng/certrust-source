<script setup lang="ts">
const config = useRuntimeConfig()
const api = computed(() => String(config.public.apiUrl || 'https://api.certrust.app').replace(/\/$/, ''))
const sourceCodeUrl = LEGAL.sourceCodeUrl

const pageDescription = ref('Step-by-step guide to connecting your systems to Certrust with API keys: creating a key, choosing permissions, issuing credentials over the API and retrying safely.')

useSeoMeta({
  title: 'Integration Setup Guide',
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/integrations/guide`
})

useHead({
  title: 'Integration Setup Guide',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/integrations/guide` }]
})

const toc = [
  { id: 'admins', label: 'Part 1: For organisation admins' },
  { id: 'plan', label: '1. Check your plan', sub: true },
  { id: 'create', label: '2. Create a key', sub: true },
  { id: 'share', label: '3. Hand the key to your IT team', sub: true },
  { id: 'manage', label: '4. Look after your keys', sub: true },
  { id: 'developers', label: 'Part 2: For developers' },
  { id: 'auth', label: 'Authentication', sub: true },
  { id: 'achievements', label: 'Find the achievement ID', sub: true },
  { id: 'issue', label: 'Issue a credential', sub: true },
  { id: 'batch', label: 'Issue to a whole group', sub: true },
  { id: 'revoke', label: 'Revoke a credential', sub: true },
  { id: 'retries', label: 'Safe retries', sub: true },
  { id: 'errors', label: 'Errors', sub: true },
  { id: 'endpoints', label: 'Endpoints by permission', sub: true },
  { id: 'tools', label: 'SDK and AI assistants', sub: true },
]

const permissions = [
  { name: 'Read', use: 'Checking what has been issued, listing achievements and events.', pick: 'Reporting or dashboards' },
  { name: 'Issue', use: 'Issuing credentials one by one or in groups, scheduling and renewing them.', pick: 'Student records, learning platforms, event tools' },
  { name: 'Revoke', use: 'Revoking credentials, for example when a certification lapses.', pick: 'HR and compliance systems' },
  { name: 'Manage', use: 'Creating and editing achievements and events.', pick: 'Only if your system creates courses or events itself' },
]

const errors = [
  { code: '400', meaning: 'Something in the request is missing or invalid, such as a required custom field. The message says what.' },
  { code: '401', meaning: 'The key is wrong, revoked or expired, its creator has left the organisation, or your plan no longer includes API access.' },
  { code: '403', meaning: 'The key doesn\'t have the permission for this action, or keys can\'t use this endpoint at all.' },
  { code: '409', meaning: 'A request with the same Idempotency-Key is still running. Wait a moment and retry.' },
  { code: '422', meaning: 'This Idempotency-Key was already used for a different request. Use a new key for a new operation.' },
]

const endpoints = [
  { scope: 'Any key', routes: ['GET /api/api-keys/me'] },
  { scope: 'Read', routes: ['GET /api/credentials', 'GET /api/achievements/creator/{issuerProfileId}', 'GET /api/achievements/{id}/credentials', 'GET /api/events', 'GET /api/events/{id}', 'GET /api/scheduled-issuances', 'GET /api/profiles/me', 'GET /api/profiles/{id}/issued-credentials', 'GET /api/custom-attributes'] },
  { scope: 'Issue', routes: ['POST /api/credentials/issue', 'POST /api/credentials/batch-issue', 'POST /api/credentials/{id}/renew', 'POST /api/scheduled-issuances', 'POST /api/scheduled-issuances/{id}/cancel'] },
  { scope: 'Revoke', routes: ['POST /api/credentials/{id}/revoke'] },
  { scope: 'Manage', routes: ['POST /api/achievements/create', 'PUT /api/achievements/{id}', 'POST /api/events', 'PUT /api/events/{id}'] },
]

const codeWhoami = computed(() => `curl ${api.value}/api/api-keys/me \\
  -H "Authorization: Bearer $CERTRUST_API_KEY"`)

const codeAchievements = computed(() => `curl ${api.value}/api/achievements/creator/{issuerProfileId} \\
  -H "Authorization: Bearer $CERTRUST_API_KEY"`)

const codeIssue = computed(() => `curl -X POST ${api.value}/api/credentials/issue \\
  -H "Authorization: Bearer $CERTRUST_API_KEY" \\
  -H "Idempotency-Key: student-1042-course-7" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "achievementId": 12,
      "recipient": { "name": "Ada Lovelace", "email": "ada@example.edu" },
      "expirationDate": "2028-06-30",
      "customFields": { "training_date": "2026-10-01" }
    }
  }'`)

const codeIssueJs = computed(() => `const res = await fetch('${api.value}/api/credentials/issue', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.CERTRUST_API_KEY}\`,
    'Idempotency-Key': \`student-\${student.id}-course-\${course.id}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      achievementId: 12,
      recipient: { name: student.name, email: student.email },
    },
  }),
})
if (!res.ok) throw new Error((await res.json()).error?.message)
const { credential } = await res.json()
console.log(credential.credentialId) // urn:uuid:…`)

const codeIssuePy = computed(() => `import os, requests

res = requests.post(
    "${api.value}/api/credentials/issue",
    headers={
        "Authorization": f"Bearer {os.environ['CERTRUST_API_KEY']}",
        "Idempotency-Key": f"student-{student_id}-course-{course_id}",
    },
    json={"data": {
        "achievementId": 12,
        "recipient": {"name": name, "email": email},
    }},
    timeout=30,
)
res.raise_for_status()
print(res.json()["credential"]["credentialId"])`)

const codeIssueResponse = `{
  "credential": {
    "id": 201,
    "documentId": "mosfeiitve177d1bpztvbfej",
    "credentialId": "urn:uuid:1713ee84-87c0-4564-84b1-d615b20a5e59",
    "name": "Data Skills Workshop",
    "issuanceDate": "2026-10-03T04:12:09.000Z",
    "revoked": false
  },
  "openBadge": { "…": "the signed Open Badges 3.0 credential" },
  "notification": { "…": "email delivery details" }
}`

const codeBatch = computed(() => `curl -X POST ${api.value}/api/credentials/batch-issue \\
  -H "Authorization: Bearer $CERTRUST_API_KEY" \\
  -H "Idempotency-Key: graduation-2026-batch-3" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "achievementId": 12,
      "skipExisting": true,
      "recipients": [
        { "name": "Ada Lovelace", "email": "ada@example.edu" },
        { "name": "Alan Turing", "email": "alan@example.edu" }
      ]
    }
  }'`)

const codeBatchResponse = `{
  "results": [
    { "success": true, "recipient": "ada@example.edu", "data": { "…": "the credential" } },
    { "success": true, "skipped": true, "recipient": "alan@example.edu", "note": "Already has this credential" }
  ]
}`

const codeRevoke = computed(() => `curl -X POST ${api.value}/api/credentials/201/revoke \\
  -H "Authorization: Bearer $CERTRUST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "reason": "Certification lapsed" }'`)
</script>

<template>
  <div class="min-h-screen">
    <section class="py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-3xl">
          <p class="text-sm font-medium uppercase tracking-wide text-[#1f7a34] mb-3">
            <NuxtLink to="/integrations" class="hover:underline">
              Integrations
            </NuxtLink>
            · Setup guide
          </p>
          <h1 class="text-4xl font-bold text-gray-900 mb-4">
            Connect your systems to Certrust
          </h1>
          <p class="text-lg text-gray-600 leading-relaxed">
            Part 1 is for the person who manages your organisation in Certrust: creating a key and keeping it safe. Part 2 is for whoever connects your system, such as your IT team or software provider.
          </p>
        </div>

        <div class="mt-12 grid lg:grid-cols-[16rem_1fr] gap-12">
          <!-- Contents -->
          <nav class="hidden lg:block" aria-label="Contents">
            <div class="sticky top-24 space-y-1 text-sm">
              <a
                v-for="item in toc"
                :key="item.id"
                :href="`#${item.id}`"
                class="block py-1 text-text-secondary hover:text-text-primary"
                :class="item.sub ? 'pl-4' : 'font-medium text-text-primary mt-3'"
              >{{ item.label }}</a>
            </div>
          </nav>

          <div class="min-w-0 max-w-3xl space-y-14 guide">
            <!-- PART 1 -->
            <div id="admins" class="scroll-mt-24">
              <h2 class="text-3xl font-bold text-gray-900">
                Part 1: For organisation admins
              </h2>
              <p class="mt-3 text-gray-600">
                No technical knowledge needed. You will create a key, choose what it may do, and pass it on safely.
              </p>
            </div>

            <section id="plan" class="scroll-mt-24">
              <h3>1. Check your plan</h3>
              <p>
                API keys are part of the Pro and Enterprise plans, including while you are on a trial of one. Sign in and open <strong>Manage → API keys</strong>. If you see "API keys are part of the paid plans", go to <a href="/billing">Billing</a> to upgrade first.
              </p>
            </section>

            <section id="create" class="scroll-mt-24">
              <h3>2. Create a key</h3>
              <ol>
                <li>Go to <strong>Manage → API keys</strong>.</li>
                <li>Give the key a name that says where it will be used, such as "Student records system" or "Moodle". You will see this name in the list and in the audit log.</li>
                <li>Choose the permissions. Give a key only what its system needs:</li>
              </ol>
              <div class="overflow-x-auto mt-4">
                <table>
                  <thead>
                    <tr><th>Permission</th><th>Lets the system</th><th>Typical for</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in permissions" :key="p.name">
                      <td class="font-medium whitespace-nowrap">
                        {{ p.name }}
                      </td><td>{{ p.use }}</td><td>{{ p.pick }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ol start="4">
                <li>Optionally set an expiry date. Leave it empty for a key that works until you revoke it.</li>
                <li>Select <strong>Create key</strong>.</li>
              </ol>
              <div class="note">
                <strong>The key works with your permissions.</strong> It can only act for your organisation, and it stops working if you leave the organisation. If you are about to hand over your role, have your successor create new keys.
              </div>
            </section>

            <section id="share" class="scroll-mt-24">
              <h3>3. Hand the key to your IT team</h3>
              <p>The key starts with <code>crt_</code> and is shown <strong>only once</strong>. Copy it straight away.</p>
              <ul>
                <li>Send it through a password manager or your organisation's secure file sharing. Don't paste it into email or chat.</li>
                <li>Ask your IT team to store it in their system's secret settings, not in code or documents.</li>
                <li>Send them this guide too: Part 2 has everything they need.</li>
              </ul>
              <p>If you lose the key, you can't see it again. Revoke it and create a new one.</p>
            </section>

            <section id="manage" class="scroll-mt-24">
              <h3>4. Look after your keys</h3>
              <ul>
                <li><strong>Check activity.</strong> The API keys page shows when each key was last used. A key nobody uses any more should be revoked.</li>
                <li><strong>Revoke straight away</strong> if a key may have been exposed, or a system or supplier is retired. Anything using it stops working immediately.</li>
                <li><strong>Replace keys regularly.</strong> Create the new key, have your IT team switch over, then revoke the old one.</li>
                <li><strong>Paused keys.</strong> If your plan no longer includes API access, keys show as paused and stop working until you upgrade again.</li>
                <li><strong>Audit trail.</strong> Every credential issued or revoked with a key is recorded against that key's name.</li>
              </ul>
            </section>

            <!-- PART 2 -->
            <div id="developers" class="scroll-mt-24 pt-6 border-t border-gray-200">
              <h2 class="text-3xl font-bold text-gray-900">
                Part 2: For developers
              </h2>
              <p class="mt-3 text-gray-600">
                A JSON API over HTTPS. Base URL: <code>{{ api }}</code>
              </p>
            </div>

            <section id="auth" class="scroll-mt-24">
              <h3>Authentication</h3>
              <p>Send the key as a Bearer token on every request. Check it works, and see its organisation, permissions and the endpoints it may call:</p>
              <pre><code>{{ codeWhoami }}</code></pre>
              <p>The response includes <code>issuerProfileId</code>, which you need in the next step. Keep the key on your server; never put it in a website or mobile app.</p>
            </section>

            <section id="achievements" class="scroll-mt-24">
              <h3>Find the achievement ID</h3>
              <p>Every credential is issued for an achievement (the course, programme or event someone completed). Create the achievement in Certrust first. To find its numeric ID, either:</p>
              <ul>
                <li>open it on the <strong>Issue</strong> page in Certrust: the number after <code>?achievement=</code> in the address is the ID, or</li>
                <li>list the achievements the key's owner created:</li>
              </ul>
              <pre><code>{{ codeAchievements }}</code></pre>
            </section>

            <section id="issue" class="scroll-mt-24">
              <h3>Issue a credential</h3>
              <p>The recipient gets an email with a link to their credential. <code>expirationDate</code> and <code>customFields</code> are optional. <code>customFields</code> are only needed if your organisation has set up custom attributes in the Design Studio. Send them by key; required ones must be included, and keys that don't exist are ignored.</p>
              <pre><code>{{ codeIssue }}</code></pre>
              <p>The same request in JavaScript (Node.js 18+):</p>
              <pre><code>{{ codeIssueJs }}</code></pre>
              <p>And in Python:</p>
              <pre><code>{{ codeIssuePy }}</code></pre>
              <p>Response. Keep <code>credential.id</code> if you may need to revoke later:</p>
              <pre><code>{{ codeIssueResponse }}</code></pre>
            </section>

            <section id="batch" class="scroll-mt-24">
              <h3>Issue to a whole group</h3>
              <p>Send a whole class or cohort in one request. Each recipient gets their own result, so one bad email doesn't stop the rest. With <code>"skipExisting": true</code>, people who already hold this credential are skipped. That makes it safe to send the full list again, for example from a nightly sync.</p>
              <pre><code>{{ codeBatch }}</code></pre>
              <pre><code>{{ codeBatchResponse }}</code></pre>
              <p>Send up to 50 recipients per request, and send the next batch when the previous one has returned. Long requests are more likely to be cut off part-way. If one is, resend the same batch with the same Idempotency-Key.</p>
            </section>

            <section id="revoke" class="scroll-mt-24">
              <h3>Revoke a credential</h3>
              <p>Needs the Revoke permission. Use the numeric <code>credential.id</code> from the issue response. Verification shows the credential as revoked straight away.</p>
              <pre><code>{{ codeRevoke }}</code></pre>
            </section>

            <section id="retries" class="scroll-mt-24">
              <h3>Safe retries</h3>
              <p>Networks fail. If a request times out you can't tell whether the credential was issued, and sending it again might issue it twice. Add an <code>Idempotency-Key</code> header to every write request to prevent that:</p>
              <ul>
                <li>Use a value that names the operation, such as <code>student-1042-course-7</code>, up to 255 characters.</li>
                <li>Sending the same key with the same request again returns the first response instead of running it again, with the header <code>Idempotent-Replayed: true</code>. Responses are kept for 24 hours.</li>
                <li>Sending the same key with a different request is refused (422), so one key can't be reused by mistake.</li>
                <li>A retry that arrives while the first request is still running gets 409. Wait a moment and retry.</li>
                <li>Server errors (5xx) are not kept, so retrying after one runs the request again.</li>
              </ul>
            </section>

            <section id="errors" class="scroll-mt-24">
              <h3>Errors</h3>
              <p>Errors come back as JSON with a readable message in <code>error.message</code>.</p>
              <div class="overflow-x-auto">
                <table>
                  <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                  <tbody>
                    <tr v-for="e in errors" :key="e.code">
                      <td class="font-mono">
                        {{ e.code }}
                      </td><td>{{ e.meaning }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="endpoints" class="scroll-mt-24">
              <h3>Endpoints by permission</h3>
              <p>A key can only call the endpoints its permissions allow. Everything else, including billing, account settings and key management, returns 403.</p>
              <div class="overflow-x-auto">
                <table>
                  <thead><tr><th>Permission</th><th>Endpoints</th></tr></thead>
                  <tbody>
                    <tr v-for="e in endpoints" :key="e.scope">
                      <td class="font-medium whitespace-nowrap align-top">
                        {{ e.scope }}
                      </td>
                      <td>
                        <code v-for="r in e.routes" :key="r" class="block my-0.5 whitespace-nowrap">{{ r }}</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="tools" class="scroll-mt-24">
              <h3>SDK and AI assistants</h3>
              <p>
                A JavaScript/TypeScript SDK (with <code>apiKey</code> and <code>idempotencyKey</code> options) and an MCP server for AI assistants such as Claude are in the
                <a :href="sourceCodeUrl" target="_blank" rel="noopener">open-source repository</a>,
                in the <code>sdk/</code> and <code>mcp/</code> folders. For the MCP server, set <code>CERTRUST_API_KEY</code> to your key.
              </p>
              <p>Questions? Contact us from the details at the bottom of this page.</p>
            </section>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.guide h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.75rem;
}
.guide p,
.guide li {
  color: #4b5563;
  line-height: 1.7;
}
.guide p + p,
.guide p + pre,
.guide pre + p,
.guide pre + pre,
.guide ul + p,
.guide p + ul,
.guide ol + div,
.guide div + ol {
  margin-top: 0.75rem;
}
.guide ol {
  list-style: decimal;
  padding-left: 1.5rem;
  margin-top: 0.75rem;
}
.guide ul {
  list-style: disc;
  padding-left: 1.5rem;
  margin-top: 0.75rem;
}
.guide li + li {
  margin-top: 0.4rem;
}
.guide a {
  color: #1f7a34;
  text-decoration: underline;
}
.guide code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875em;
  background: #f3f4f6;
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}
.guide pre {
  overflow-x: auto;
  background: #111827;
  color: #f3f4f6;
  border-radius: 0.75rem;
  padding: 1rem;
  font-size: 0.8rem;
  line-height: 1.6;
}
.guide pre code {
  background: transparent;
  padding: 0;
  font-size: inherit;
}
.guide table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.guide th {
  text-align: left;
  font-weight: 600;
  color: #111827;
  border-bottom: 2px solid #e5e7eb;
  padding: 0.5rem 0.75rem 0.5rem 0;
}
.guide td {
  border-bottom: 1px solid #f3f4f6;
  padding: 0.6rem 0.75rem 0.6rem 0;
  color: #4b5563;
  vertical-align: top;
}
.guide .note {
  margin-top: 1rem;
  border-left: 4px solid #28a745;
  background: rgba(217, 242, 222, 0.4);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: #374151;
}
</style>
