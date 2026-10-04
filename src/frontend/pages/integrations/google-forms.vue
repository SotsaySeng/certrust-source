<script setup lang="ts">
const pageDescription = ref('Issue a certificate to everyone who submits a Google Form: attendance, course completion or registration. Uses the Certrust Google Sheets connector. Step-by-step setup.')

useSeoMeta({
  title: 'Google Forms',
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/integrations/google-forms`
})

useHead({
  title: 'Google Forms',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/integrations/google-forms` }]
})

const uses = [
  { title: 'Attendance', body: 'Show a QR code to the form at the end of a session. Everyone who fills it in gets their certificate of attendance.' },
  { title: 'Course completion', body: 'Make the form the last step of a course, for example a final quiz or feedback form.' },
  { title: 'Registration lists', body: 'Collect names with a form before an event, then issue to everyone who came once it is over.' },
]
</script>

<template>
  <IntegrationManual section="Google Forms" title="Submit a form, receive a certificate">
    <p class="lead">
      Every answer to a Google Form lands as a new row in a Google Sheet. With the Certrust Google Sheets connector on that sheet, each person who submits the form is issued a certificate, usually within a minute.
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      <div v-for="u in uses" :key="u.title" class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <p class="font-bold text-gray-900">
          {{ u.title }}
        </p>
        <p class="mt-1 text-sm text-gray-600 leading-relaxed">
          {{ u.body }}
        </p>
      </div>
    </div>

    <div class="note">
      <strong>Before you start</strong> you need a Certrust Pro or Enterprise plan, an achievement created in Certrust, an API key with the Read and Issue permissions, and a Google account.
    </div>

    <section>
      <h2>1. Build the form</h2>
      <ol>
        <li>In Google Forms, create your form.</li>
        <li>Add a short-answer question titled <strong>Name</strong> and mark it as required. This is the name printed on the certificate.</li>
        <li>
          Collect the email address in one of two ways:
          <ul>
            <li>in <strong>Settings → Responses</strong>, turn on <strong>Collect email addresses</strong>, or</li>
            <li>add a short-answer question titled <strong>Email</strong> and mark it as required.</li>
          </ul>
        </li>
        <li>Add any other questions you like. Certrust ignores them.</li>
      </ol>
      <p>If your organisation uses custom attributes on its certificates, such as Training Date, add a question with exactly that attribute's name and its answer is printed on the certificate.</p>
    </section>

    <section>
      <h2>2. Send the answers to a Google Sheet</h2>
      <ol>
        <li>In your form, open the <strong>Responses</strong> tab.</li>
        <li>Select <strong>Link to Sheets</strong> and create a new spreadsheet.</li>
        <li>The spreadsheet opens with a tab called "Form Responses 1". Each submission becomes a new row there.</li>
      </ol>
    </section>

    <section>
      <h2>3. Connect that sheet to Certrust</h2>
      <p>
        Follow steps 2 and 3 of the <a href="/integrations/google-sheets">Google Sheets guide</a> in the spreadsheet you just created: add the Certrust script, then choose <strong>Certrust → Connect this tab…</strong> while the "Form Responses 1" tab is open, and pick the achievement.
      </p>
      <p>Certrust adds two columns at the end of the tab, "Certrust status" and "Certificate link", and leaves the form's own columns as they are.</p>
    </section>

    <section>
      <h2>4. Choose when certificates go out</h2>
      <h3>Straight away</h3>
      <p>Choose <strong>Certrust → Turn on automatic issuing</strong>. From then on, each submission is issued as soon as it arrives, and the sheet is checked again every 5 minutes for anything that was missed.</p>
      <h3>After you have checked the list</h3>
      <p>Leave automatic issuing off. When you have looked through the answers, removed any that should not get a certificate, and are ready, choose <strong>Certrust → Issue new rows now</strong>.</p>
    </section>

    <section>
      <h2>Who gets a certificate</h2>
      <p>With automatic issuing on, <strong>everyone who submits the form gets a certificate</strong>. Keep that in mind when you share the link:</p>
      <ul>
        <li>Share the form only with the people who should receive the certificate, for example on a slide in the room.</li>
        <li>Stop accepting answers when the event is over: in the form's <strong>Responses</strong> tab, switch off <strong>Accepting responses</strong>.</li>
        <li>If attendance needs checking first, use "After you have checked the list" above.</li>
        <li>Someone who submits twice gets one certificate. The second row says "Already issued".</li>
        <li>A mistyped email address sends the certificate to the wrong inbox or nowhere. Turning on Collect email addresses with verified addresses avoids typing mistakes.</li>
      </ul>
    </section>

    <section>
      <h2>If something doesn't work</h2>
      <ul>
        <li><strong>A row says "Waiting: add a name":</strong> the form has no question titled Name, or the person left it empty. Type the name into the row and it is issued on the next run.</li>
        <li><strong>Nothing happens after a submission:</strong> check that automatic issuing is on, and that you connected the "Form Responses 1" tab, not another tab.</li>
        <li><strong>A row says "… is required":</strong> your organisation has a required custom attribute. Add a question with that attribute's name to the form, fill in the missing value in the row, and choose <strong>Certrust → Retry rows with errors</strong>.</li>
      </ul>
      <p>More in the <a href="/integrations/google-sheets">Google Sheets guide</a>, which covers the columns, the status messages and the Google permission screen.</p>
    </section>
  </IntegrationManual>
</template>
