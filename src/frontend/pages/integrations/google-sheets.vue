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

    <video
      class="tutorial mt-8"
      src="/guide/integrations/sheets-tutorial.mp4"
      poster="/guide/integrations/sheets-4c-issued.jpg"
      controls
      preload="none"
      playsinline
      data-testid="guide-video"
    />

    <div class="note mt-8">
      <strong>Before you start</strong> you need a Certrust Pro or Enterprise plan, at least one achievement created in Certrust, and a Google account.
    </div>

    <section>
      <h2>1. Create an API key in Certrust</h2>
      <ol>
        <li>Sign in to Certrust and go to <strong>Manage → API keys</strong>.</li>
        <li>Name the key "Google Sheets" and keep the <strong>Read</strong> and <strong>Issue</strong> permissions ticked.</li>
        <li>Select <strong>Create key</strong>.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-1a-create-key.jpg" alt="The API keys page with a new key named Google Sheets, Read and Issue ticked" loading="lazy">
      <p>Copy the key straight away. It starts with <code>crt_</code> and is shown only once. Keep it somewhere safe until step 3.</p>
      <img class="shot" src="/guide/integrations/sheets-1b-key-created.jpg" alt="Your new API key, with a Copy button (the key is blurred here)" loading="lazy">
    </section>

    <section>
      <h2>2. Add the Certrust script to your sheet</h2>
      <ol>
        <li>Open your Google Sheet, or create a new one.</li>
        <li>In the menu, choose <strong>Extensions → Apps Script</strong>. A new browser tab opens.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-2a-extensions-menu.jpg" alt="The Extensions menu in Google Sheets with Apps Script highlighted" loading="lazy">
      <ol start="3">
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
        <li>Select the <strong>Save</strong> icon (the disk). It says "Saved to Drive". Then close that browser tab.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-2c-script-saved.jpg" alt="The Certrust script pasted into the Apps Script editor and saved" loading="lazy">
      <ol start="6">
        <li>Back in your sheet, reload the page. A <strong>Certrust</strong> menu appears next to Help after a few seconds.</li>
      </ol>
    </section>

    <section>
      <h2>3. Connect the sheet</h2>
      <ol>
        <li>Choose <strong>Certrust → Connect this tab…</strong></li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-3a-certrust-menu.jpg" alt="The Certrust menu in the sheet, with Connect this tab… at the top" loading="lazy">
      <ol start="2">
        <li>
          The first time, Google asks for permission. Click <strong>OK</strong> and choose your account. If Google shows "Google hasn't verified this app", select <strong>Advanced</strong>, then <strong>Go to … (unsafe)</strong>. Then select <strong>Allow</strong>.
        </li>
      </ol>
      <img class="shot narrow" src="/guide/integrations/sheets-3b-google-permission.jpg" alt="Google's permission screen listing what the script may do, with Allow and Deny buttons" loading="lazy">
      <div class="note">
        <strong>Why the Google warning?</strong> The script is a copy that belongs to you and runs only in your Google account, so Google has not reviewed it. Google lists four permissions: to see and edit your spreadsheets (the script only reads and writes the tabs you connect), to connect to an external service (Certrust), to run when you are not present (for automatic issuing), and to show the Connect window inside Sheets. The script is open for anyone to read at the download link above.
      </div>
      <ol start="3">
        <li>Choose <strong>Certrust → Connect this tab…</strong> again, paste your API key and select <strong>Connect</strong>. It says "Checking…" for a few seconds.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-3c-connect-dialog.jpg" alt="The Connect to Certrust window with an API key box and a Connect button" loading="lazy">
      <ol start="4">
        <li>Pick the achievement this tab should issue and select <strong>Save</strong>. An empty tab gets the column headings for you.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-3d-connected-choose-achievement.jpg" alt="Connected to the organisation, with the achievement Introduction to Data Analytics selected and a Save button" loading="lazy">
    </section>

    <section>
      <h2>4. Issue certificates</h2>
      <ol>
        <li>Add people under <strong>Name</strong> and <strong>Email</strong>, one per row.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-4a-rows-added.jpg" alt="Three people added to the sheet with their names and email addresses" loading="lazy">
      <ol start="2">
        <li>Choose <strong>Certrust → Issue new rows now</strong>.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-4b-issue-menu.jpg" alt="The Certrust menu with Issue new rows now highlighted" loading="lazy">
      <ol start="3">
        <li>Each row gets a status and a certificate link.</li>
      </ol>
      <img class="shot" src="/guide/integrations/sheets-4c-issued.jpg" alt="Each row now says Issued with today's date and has a certificate link" loading="lazy">
      <p>Each person receives their certificate by email, from your organisation, with a button to view it:</p>
      <img class="shot" src="/guide/integrations/sheets-5-email.jpg" alt="The certificate email in the recipient's inbox, with a View your credential button" loading="lazy">
      <h3>Issue automatically</h3>
      <p>To issue without clicking, choose <strong>Certrust → Turn on automatic issuing</strong>. New rows are then issued every 5 minutes, even when the sheet is closed. Choose <strong>Turn off automatic issuing</strong> to stop.</p>
      <img class="shot" src="/guide/integrations/sheets-6-automatic-menu.jpg" alt="The Certrust menu with Turn on automatic issuing highlighted" loading="lazy">
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
        <li>
          <strong>"An error occurred" when you click OK on Google's permission request:</strong> Google's sign-in window was blocked. This happens in some embedded browsers and when you are signed in to several Google accounts. Open the sheet in a normal Chrome, Edge or Safari window, signed in only to the account that owns the sheet, and choose <strong>Certrust → Connect this tab…</strong> again. You only need to do this once.
          <img class="shot narrow" src="/guide/integrations/sheets-3b-authorization-required.jpg" alt="Google's An error occurred message with a Reload link" loading="lazy">
        </li>
        <li><strong>A red "Cannot call SpreadsheetApp.getUi()" message in the Apps Script editor:</strong> you pressed Run in the editor. That's harmless. Use the <strong>Certrust</strong> menu in the sheet instead.</li>
        <li><strong>"That API key is not valid":</strong> the key was mistyped, revoked or has expired. Create a new one and connect again.</li>
        <li><strong>"This key needs both the Read and the Issue permission":</strong> create a new key with both ticked.</li>
        <li><strong>No achievements listed:</strong> the list shows achievements created by the person who made the key. Create one in Certrust first.</li>
        <li><strong>A row says "… is required":</strong> your organisation has a required custom attribute. Add a column with that attribute's name and fill it in, then choose Retry rows with errors.</li>
      </ul>
      <p>Connecting another system instead? See the <a href="/integrations/guide">setup guide for developers</a>.</p>
    </section>
  </IntegrationManual>
</template>
