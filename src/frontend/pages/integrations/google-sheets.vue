<script setup lang="ts">
const SCRIPT_URL = '/downloads/certrust-google-sheets.gs'

const pageDescription = ref('Connect a Google Sheet to Certrust: add a row with a name and an email, and that person is issued a verifiable certificate. Step-by-step setup.')

useSeoMeta({
  title: 'Google Sheets Connector',
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/integrations/google-sheets`
})

useHead({
  title: 'Google Sheets Connector',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/integrations/google-sheets` }]
})

const copyState = ref<'idle' | 'copied' | 'failed'>('idle')

async function copyScript() {
  try {
    const text = await (await fetch(SCRIPT_URL)).text()
    await navigator.clipboard.writeText(text)
    copyState.value = 'copied'
  }
  catch {
    copyState.value = 'failed'
  }
}

const columns = [
  { name: 'Name', needed: 'Required', note: 'Also recognised: Full name, Recipient, Recipient name.' },
  { name: 'Email', needed: 'Required', note: 'Also recognised: E-mail, Email address, Recipient email.' },
  { name: 'Expiry date', needed: 'Optional', note: 'A date in the future. Leave empty for a certificate that does not expire.' },
  { name: 'Your custom attributes', needed: 'If you use them', note: 'One column per custom attribute from the Design Studio, with the attribute\'s name as the heading, for example Training Date.' },
  { name: 'Certrust status', needed: 'Added for you', note: 'Filled in by Certrust. Don\'t type here, except to clear a row you want issued again.' },
  { name: 'Certificate link', needed: 'Added for you', note: 'The link to the person\'s certificate.' },
]

const statuses = [
  { text: 'Issued 2026-10-04', meaning: 'The certificate was issued that day and emailed to the person.' },
  { text: 'Already issued', meaning: 'This person already holds this certificate, so nothing new was sent.' },
  { text: 'Waiting: add a name', meaning: 'The row has an email but no name. It is issued as soon as you add one.' },
  { text: 'Error: …', meaning: 'Something is wrong with this row, and the message says what. Fix it, then choose Certrust → Retry rows with errors.' },
]
</script>

<template>
  <IntegrationManual section="Google Sheets" title="Add a row, issue a certificate">
    <p class="lead">
      Keep your list of participants in Google Sheets as you do today. Each new row with a name and an email gets a verifiable certificate, and the sheet shows the result and the certificate link next to it. Setup takes about ten minutes and needs no technical knowledge.
    </p>

    <div class="note mt-8">
      <strong>Before you start</strong> you need a Certrust Pro or Enterprise plan, at least one achievement created in Certrust, and a Google account.
    </div>

    <section>
      <h2>1. Create an API key in Certrust</h2>
      <ol>
        <li>Sign in to Certrust and go to <strong>Manage → API keys</strong>.</li>
        <li>Name the key "Google Sheets" and keep the <strong>Read</strong> and <strong>Issue</strong> permissions ticked.</li>
        <li>Select <strong>Create key</strong> and copy the key. It starts with <code>crt_</code> and is shown only once.</li>
      </ol>
    </section>

    <section>
      <h2>2. Add the Certrust script to your sheet</h2>
      <ol>
        <li>Open your Google Sheet, or create a new one.</li>
        <li>In the menu, choose <strong>Extensions → Apps Script</strong>. A new browser tab opens.</li>
        <li>Delete the few lines of code that are there.</li>
        <li>
          Copy the Certrust script and paste it in:
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" class="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-[#28A745] text-black hover:bg-[#28A745]/90 transition-colors" data-testid="copy-script" @click="copyScript">
              <span class="i-lucide-copy w-4 h-4" />
              {{ copyState === 'copied' ? 'Copied' : 'Copy the script' }}
            </button>
            <a :href="SCRIPT_URL" download="certrust-google-sheets.gs" class="text-sm">or download it</a>
          </div>
          <p v-if="copyState === 'failed'" class="mt-2 text-sm text-red-700">
            Your browser did not allow copying. Use the download link and copy the file's contents instead.
          </p>
        </li>
        <li>Select the <strong>Save</strong> icon (the disk), then close that browser tab.</li>
        <li>Back in your sheet, reload the page. A <strong>Certrust</strong> menu appears after a few seconds.</li>
      </ol>
    </section>

    <section>
      <h2>3. Connect the sheet</h2>
      <ol>
        <li>Choose <strong>Certrust → Connect this tab…</strong></li>
        <li>
          The first time, Google asks for permission. Choose your account. If Google shows "Google hasn't verified this app", select <strong>Advanced</strong>, then <strong>Go to … (unsafe)</strong>. Then select <strong>Allow</strong>.
        </li>
        <li>Choose <strong>Certrust → Connect this tab…</strong> again, paste your API key and select <strong>Connect</strong>.</li>
        <li>Pick the achievement this tab should issue and select <strong>Save</strong>.</li>
      </ol>
      <div class="note">
        <strong>Why the Google warning?</strong> The script is a copy that belongs to you and runs only in your Google account, so Google has not reviewed it. It asks for three things: to edit this spreadsheet, to connect to Certrust, and to run on a timer. It is open for anyone to read at the download link above.
      </div>
    </section>

    <section>
      <h2>4. Issue certificates</h2>
      <ol>
        <li>Add people under <strong>Name</strong> and <strong>Email</strong>, one per row. An empty tab gets these headings for you.</li>
        <li>Choose <strong>Certrust → Issue new rows now</strong>.</li>
        <li>Each row gets a status and a certificate link. The person receives their certificate by email.</li>
      </ol>
      <p>To issue without clicking, choose <strong>Certrust → Turn on automatic issuing</strong>. New rows are then issued every 5 minutes, even when the sheet is closed.</p>
      <p>Collecting names with a form? See <a href="/integrations/google-forms">Google Forms</a>: each person who submits the form gets their certificate straight away.</p>
    </section>

    <section>
      <h2>Columns</h2>
      <p>Columns are found by their heading in row 1 and can be in any order. Your other columns are left alone.</p>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>Heading</th><th /><th>Notes</th></tr></thead>
          <tbody>
            <tr v-for="c in columns" :key="c.name">
              <td class="font-medium whitespace-nowrap">
                {{ c.name }}
              </td>
              <td class="whitespace-nowrap">
                {{ c.needed }}
              </td>
              <td>{{ c.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>What the status means</h2>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr v-for="s in statuses" :key="s.text">
              <td class="font-medium whitespace-nowrap">
                {{ s.text }}
              </td>
              <td>{{ s.meaning }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Good to know</h2>
      <ul>
        <li><strong>Nobody is issued twice.</strong> A row is issued once. If the same person appears again for the same achievement, the row says "Already issued".</li>
        <li><strong>One achievement per tab.</strong> For another course or event, add a tab and choose <strong>Connect this tab…</strong> there.</li>
        <li><strong>Your key stays private.</strong> It is stored for your Google account only. Other people who can edit the sheet can't see it, and they need their own key to issue.</li>
        <li><strong>Large lists.</strong> Up to 200 rows are issued per run; the rest follow on the next run.</li>
        <li><strong>To stop,</strong> choose <strong>Certrust → Disconnect</strong>. To block the key completely, revoke it in Certrust under Manage → API keys.</li>
        <li><strong>Using Excel?</strong> Save the list as CSV and upload it on the <a href="/issue">Issue</a> page.</li>
      </ul>
    </section>

    <section>
      <h2>If something doesn't work</h2>
      <ul>
        <li><strong>No Certrust menu:</strong> reload the sheet and wait a few seconds. Check that the script was saved in Extensions → Apps Script.</li>
        <li><strong>"That API key is not valid":</strong> the key was mistyped, revoked or has expired. Create a new one and connect again.</li>
        <li><strong>"This key needs both the Read and the Issue permission":</strong> create a new key with both ticked.</li>
        <li><strong>No achievements listed:</strong> the list shows achievements created by the person who made the key. Create one in Certrust first.</li>
        <li><strong>A row says "… is required":</strong> your organisation has a required custom attribute. Add a column with that attribute's name and fill it in, then choose Retry rows with errors.</li>
      </ul>
      <p>Connecting another system instead? See the <a href="/integrations/guide">setup guide for developers</a>.</p>
    </section>
  </IntegrationManual>
</template>
