<script setup lang="ts">
const config = useRuntimeConfig()
const api = computed(() => String(config.public.apiUrl || 'https://api.certrust.app').replace(/\/$/, ''))
const SCRIPT_URL = '/downloads/certrust-sync-example.py'

const pageDescription = ref('How a university or college connects its student records system to Certrust: issue certificates and diplomas automatically from your own records, without moving student data.')

useSeoMeta({
  title: 'Student Records Integration',
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/integrations/student-records`
})

useHead({
  title: 'Student Records Integration',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/integrations/student-records` }]
})

const mapping = [
  { yours: 'Programme, course or award', certrust: 'Achievement', note: 'Create one achievement per award in Certrust and note its numeric ID.' },
  { yours: 'Student name and email', certrust: 'Recipient', note: 'The only personal details Certrust needs.' },
  { yours: 'Completion or conferral date, campus, and similar', certrust: 'Custom attributes', note: 'Optional. Only what you choose to print on the certificate.' },
  { yours: 'Your record ID for the award', certrust: 'Idempotency-Key', note: 'Stays in your system. It makes a repeated request harmless.' },
  { yours: 'Where you keep the result', certrust: 'Credential ID and link', note: 'Returned for every student, to store against their record.' },
]

const patterns = [
  { when: 'A result is confirmed for one student', use: 'Issue a credential', endpoint: 'POST /api/credentials/issue', note: 'One request per student, as it happens.' },
  { when: 'A class or cohort finishes', use: 'Batch issue', endpoint: 'POST /api/credentials/batch-issue', note: 'Up to 200 students per request.' },
  { when: 'Graduation, or a first import', use: 'Issuance job', endpoint: 'POST /api/issuance-jobs', note: 'Up to 2,000 students, processed in the background.' },
  { when: 'A nightly catch-up', use: 'Issuance job with skipExisting', endpoint: 'POST /api/issuance-jobs', note: 'Send everyone who qualifies; those already issued are skipped.' },
  { when: 'An award is withdrawn', use: 'Revoke', endpoint: 'POST /api/credentials/{id}/revoke', note: 'Needs a key with the Revoke permission.' },
]

const codeCsv = `student_id,name,email,expiry_date,training_date
S1042,Ada Lovelace,ada@example.edu,,2026-10-01
S1043,Alan Turing,alan@example.edu,,2026-10-01`

const codeRun = computed(() => `export CERTRUST_API_KEY=crt_...
python3 certrust-sync-example.py --achievement 12 --input graduates.csv --output results.csv`)

const codeOutput = `Example University: 2 students to process
  0/2 processed
Done: 2 issued, 0 already issued, 0 failed. Results in results.csv`

const codeResults = `student_id,name,email,outcome,credential_id,certificate_url,error
S1042,Ada Lovelace,ada@example.edu,issued,urn:uuid:351dc622-…,https://certrust.app/credentials/urn%3Auuid%3A351dc622-…,
S1043,Alan Turing,alan@example.edu,already_issued,urn:uuid:4d7b1747-…,https://certrust.app/credentials/urn%3Auuid%3A4d7b1747-…,`

const codeSingle = computed(() => `curl -X POST ${api.value}/api/credentials/issue \\
  -H "Authorization: Bearer $CERTRUST_API_KEY" \\
  -H "Idempotency-Key: award-2026-S1042-BSC-CS" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "achievementId": 12,
      "recipient": { "name": "Ada Lovelace", "email": "ada@example.edu" }
    }
  }'`)

const codeCron = `# Every night at 01:30: export, then issue
30 1 * * *  /opt/sis/export-awards.sh > /var/certrust/awards.csv && \\
            python3 /opt/certrust/certrust-sync-example.py --achievement 12 \\
              --input /var/certrust/awards.csv --output /var/certrust/results.csv`
</script>

<template>
  <IntegrationManual section="Universities and colleges" title="Connect your student records system">
    <p class="lead">
      For the IT team of a university, college or school. Your student records system stays the source of truth: when a student earns an award, your system tells Certrust, and Certrust issues the verifiable certificate and gives you back its link.
    </p>

    <div class="note">
      <strong>What leaves your system:</strong> the student's name and email, which award they earned, and any details you choose to print on the certificate. Student numbers, grades and everything else stay with you.
    </div>

    <section>
      <h2>How your records map to Certrust</h2>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>In your system</th><th>In Certrust</th><th>Notes</th></tr></thead>
          <tbody>
            <tr v-for="m in mapping" :key="m.yours">
              <td>{{ m.yours }}</td>
              <td class="font-medium whitespace-nowrap">
                {{ m.certrust }}
              </td>
              <td>{{ m.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>1. Prepare Certrust</h2>
      <ol>
        <li>Create an achievement for each award you will issue, and choose its certificate design.</li>
        <li>Find each achievement's numeric ID: open it on the Issue page, and the number after <code>?achievement=</code> in the address is the ID.</li>
        <li>Create an API key under <strong>Manage → API keys</strong> with the <strong>Read</strong> and <strong>Issue</strong> permissions. Add <strong>Revoke</strong> only if your system will withdraw awards.</li>
        <li>Store the key in your server's secret settings, never in code or in the export files.</li>
      </ol>
      <p>The <a href="/integrations/guide">API guide</a> explains keys and permissions in full.</p>
    </section>

    <section>
      <h2>2. Choose how to send awards</h2>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>When</th><th>Use</th><th>Notes</th></tr></thead>
          <tbody>
            <tr v-for="p in patterns" :key="p.when">
              <td>{{ p.when }}</td>
              <td>
                <span class="font-medium">{{ p.use }}</span>
                <code class="block mt-1 whitespace-nowrap">{{ p.endpoint }}</code>
              </td>
              <td>{{ p.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Most institutions start with a nightly catch-up, because it needs only an export your records system can already produce. It is covered in the next step.</p>
    </section>

    <section>
      <h2>3. A working example: issue from an export</h2>
      <p>This example script reads a CSV export, issues through an issuance job, waits for it to finish and writes a results file. It needs Python 3.8 or later and nothing else.</p>
      <p>
        <a :href="SCRIPT_URL" download="certrust-sync-example.py" class="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-[#28A745] !text-black !no-underline hover:bg-[#28A745]/90 transition-colors" data-testid="download-sync-example">
          <span class="i-lucide-download w-4 h-4" />
          Download certrust-sync-example.py
        </a>
      </p>
      <h3>The export</h3>
      <p>One row per student who has earned the award. <code>name</code> and <code>email</code> are required. <code>student_id</code> is never sent to Certrust; it is copied into the results so you can match them to your records. A column named after one of your Certrust custom attributes (here <code>training_date</code>) is printed on the certificate. Any other column is ignored and stays on your server.</p>
      <pre><code>{{ codeCsv }}</code></pre>
      <h3>Run it</h3>
      <pre><code>{{ codeRun }}</code></pre>
      <pre><code>{{ codeOutput }}</code></pre>
      <h3>The results</h3>
      <p>One row per student, in the same order, with the outcome (<code>issued</code>, <code>already_issued</code> or <code>failed</code>), the credential ID and the certificate link. Load these back into your records system. The command exits with an error status if any student failed, so a scheduler can alert you.</p>
      <pre><code>{{ codeResults }}</code></pre>
      <div class="note">
        <strong>Safe to repeat.</strong> Running the same export again issues nothing twice: students who already hold the award come back as <code>already_issued</code>, with their existing link. That is what makes a nightly "send everyone who qualifies" job safe.
      </div>
    </section>

    <section>
      <h2>4. Issue as results are confirmed</h2>
      <p>If your system can call an API when a result is confirmed, issue one credential at a time instead. Use your own record ID for the award as the Idempotency-Key, so a retry after a timeout never issues twice:</p>
      <pre><code>{{ codeSingle }}</code></pre>
      <p>The response contains <code>credential.id</code> (use it to revoke) and <code>credential.credentialId</code> (the public ID in the certificate link).</p>
    </section>

    <section>
      <h2>5. Run it on a schedule</h2>
      <p>On a Linux server, a cron entry is enough. On Windows, use Task Scheduler with the same command.</p>
      <pre><code>{{ codeCron }}</code></pre>
      <ul>
        <li>Keep the API key in the environment of the scheduled job, readable only by the account that runs it.</li>
        <li>Have the scheduler alert someone when the command fails, and review the <code>failed</code> rows in the results.</li>
        <li>Delete export and results files once they have been loaded back, as you would any file with student data.</li>
      </ul>
    </section>

    <section>
      <h2>Before you go live</h2>
      <ul>
        <li><strong>Test with a small group first.</strong> Issue one award to a few staff email addresses and check the certificate, the email and the verification page.</li>
        <li><strong>Check student emails.</strong> The certificate goes to the address you send. Prefer an address the student keeps after they leave.</li>
        <li><strong>Agree who owns the key.</strong> A key works with the permissions of the staff member who created it and stops if they leave your Certrust organisation. Create it from a shared or role account.</li>
        <li><strong>Plan for withdrawals.</strong> Decide who may revoke an award and give only that system the Revoke permission.</li>
        <li><strong>Know the limits.</strong> 120 requests a minute per key, 2,000 students per job and 3 jobs at once. A job counts as one request.</li>
      </ul>
      <p>Full reference for every request, error and limit: the <a href="/integrations/guide">API guide</a>.</p>
    </section>
  </IntegrationManual>
</template>
