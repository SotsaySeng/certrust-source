<script setup lang="ts">
// Screenshots and video come from e2e/demo-recording.spec.ts; re-record them
// with docs/demo-video/README.md whenever these screens change.
const pageDescription = ref('Step-by-step guide: create your Certrust account, design a certificate, and issue verifiable digital certificates to your recipients by email. With a 2-minute video.')

useSeoMeta({
  title: 'Issue your first certificate',
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/guide/issue-your-first-certificate`,
  ogImage: `${WEBSITE_URL}/guide/step-7-certificate.jpg`
})

useHead({
  title: 'Issue your first certificate',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/guide/issue-your-first-certificate` }]
})

const steps = [
  { id: 'account', title: 'Create your account' },
  { id: 'confirm', title: 'Confirm your email and sign in' },
  { id: 'design', title: 'Design your certificate' },
  { id: 'achievement', title: 'Create an achievement' },
  { id: 'issue', title: 'Issue to your recipients' },
  { id: 'email', title: 'Your recipients get an email' },
  { id: 'certificate', title: 'The verified certificate' },
  { id: 'share', title: 'Sharing and downloading' },
  { id: 'dashboard', title: 'Your dashboard' },
]
</script>

<template>
  <IntegrationManual crumb="Get started" crumb-to="/get-started" section="Guide" title="Issue your first certificate">
    <p class="lead">
      This guide takes you from a new account to a verified certificate in your recipient's inbox. It takes about ten minutes. Watch the video, or follow the steps below.
    </p>

    <video
      class="mt-8 w-full rounded-xl border border-gray-200 shadow-sm"
      src="/guide/certrust-tutorial.mp4"
      poster="/guide/step-7-certificate.jpg"
      controls
      preload="none"
      playsinline
      data-testid="guide-video"
    />

    <nav class="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5" aria-label="Steps">
      <p class="font-semibold text-gray-900">
        Steps
      </p>
      <ol class="mt-2 grid gap-x-6 sm:grid-cols-2">
        <li v-for="(s, i) in steps" :key="s.id">
          <a :href="`#${s.id}`" class="text-[#1f7a34] hover:underline">{{ i + 1 }}. {{ s.title }}</a>
        </li>
      </ol>
    </nav>

    <section id="account">
      <h2>1. Create your account</h2>
      <ol>
        <li>
          Go to <NuxtLink to="/register">
            Get started
          </NuxtLink> (top right of every page).
        </li>
        <li>Fill in a username, your work email, your organisation's name and type, and a password.</li>
        <li>Tick the box to accept the terms, then click <strong>Sign Up</strong>.</li>
      </ol>
      <img src="/guide/step-1-register.jpg" alt="The Create your account form, filled in for Aroha Academy" loading="lazy">
      <p>Your organisation name is printed on every certificate and in every email you send, so use the name your recipients know you by.</p>
    </section>

    <section id="confirm">
      <h2>2. Confirm your email and sign in</h2>
      <ol>
        <li>Open the email from Certrust and click the confirmation link.</li>
        <li>Sign in with your email and password. You land on your dashboard.</li>
      </ol>
      <img src="/guide/step-2-dashboard.jpg" alt="The dashboard of a new organisation" loading="lazy">
      <div class="note">
        <strong>No email?</strong> Check your spam folder. Messages come from Certrust. You can ask for a new link from the sign-in page.
      </div>
    </section>

    <section id="design">
      <h2>3. Design your certificate</h2>
      <ol>
        <li>Open <strong>Manage → Design Templates</strong> and click <strong>New design</strong>.</li>
        <li>Choose <strong>Certificate</strong> (or <strong>Badge</strong>), then pick a layout from the library. Templates marked <em>Premium</em> need a paid plan.</li>
        <li>Add your logo and colours on the <strong>Brand</strong> step, or skip it for now. Give the design a name and click <strong>Create</strong>.</li>
      </ol>
      <img src="/guide/step-3a-choose-layout.jpg" alt="Choosing a layout from the template library" loading="lazy">
      <p>The Design Studio opens. Change anything you like:</p>
      <ul>
        <li>Click a piece of text on the page, or in the <strong>Layers</strong> panel, and type the new wording in the <strong>Text</strong> box on the right. Signature names and job titles are a good place to start.</li>
        <li>Add text, images and QR codes from the panels on the left. Drag things to move them.</li>
        <li>Words in square brackets, such as <code>[recipient.name]</code>, are filled in for each person when you issue. Tick <strong>Sample data</strong> to preview them.</li>
      </ul>
      <img src="/guide/step-3b-design-studio.jpg" alt="Editing the signature names in the Design Studio" loading="lazy">
      <p>Click <strong>Save</strong> when you are done.</p>
    </section>

    <section id="achievement">
      <h2>4. Create an achievement</h2>
      <p>An achievement is what you are awarding: a course, a workshop, a qualification. You create it once and issue it to as many people as you like.</p>
      <ol>
        <li>Open <strong>Manage → Issue Badges</strong> and click <strong>New achievement</strong>.</li>
        <li>Enter a name and a short description. Both appear on every certificate.</li>
        <li>Choose the type, and optionally the criteria: what someone had to do to earn it.</li>
        <li>Your newest certificate design is already selected. Change it here if you need to, then click <strong>Create achievement</strong>.</li>
      </ol>
      <img src="/guide/step-4-achievement.jpg" alt="The New achievement form" loading="lazy">
    </section>

    <section id="issue">
      <h2>5. Issue to your recipients</h2>
      <p>You are taken back to <strong>Issue</strong> with your new achievement selected. Add the people to award it to, either way:</p>
      <ul>
        <li><strong>One at a time:</strong> type a name and email address.</li>
        <li><strong>Many at once:</strong> click <strong>Upload CSV</strong>. A CSV is a spreadsheet saved as "CSV" from Excel or Google Sheets, with a <code>name</code> and an <code>email</code> column. Use the <strong>CSV template</strong> link to start from one that is already set up.</li>
      </ul>
      <img src="/guide/step-5a-recipients.jpg" alt="Three recipients loaded from a CSV file" loading="lazy">
      <p>Check the list and click <strong>Issue Certificates</strong>. The results table shows each person, and whether their email was sent.</p>
      <img src="/guide/step-5b-issued.jpg" alt="Certificates issued successfully, with a row per recipient" loading="lazy">
      <div class="note">
        Leave <strong>Skip people who already have this credential</strong> ticked. If you upload the same list twice, nobody gets a second copy.
      </div>
    </section>

    <section id="email">
      <h2>6. Your recipients get an email</h2>
      <p>Each person receives an email from your organisation with a <strong>View your credential</strong> button. They do not need an account or anything installed.</p>
      <img src="/guide/step-6-email.jpg" alt="The email a recipient receives" loading="lazy">
    </section>

    <section id="certificate">
      <h2>7. The verified certificate</h2>
      <p>The button opens the certificate page. Certrust checks the certificate every time someone opens it:</p>
      <ul>
        <li><strong>Valid signature:</strong> it was issued by your organisation and has not been changed.</li>
        <li><strong>Not revoked</strong> and <strong>not expired.</strong></li>
      </ul>
      <img src="/guide/step-7-certificate.jpg" alt="A verified certificate for Mere Tane" loading="lazy">
    </section>

    <section id="share">
      <h2>8. Sharing and downloading</h2>
      <p>From the certificate page, your recipient can:</p>
      <ul>
        <li>add it to their <strong>LinkedIn</strong> profile in one click, or share it on Facebook or WhatsApp;</li>
        <li>download it as a <strong>PNG</strong> image or a <strong>PDF</strong>;</li>
        <li>share the link or the <strong>QR code</strong>. Anyone who opens it sees the same verification.</li>
      </ul>
      <img src="/guide/step-8-share.jpg" alt="Certificate details, QR code and link" loading="lazy">
    </section>

    <section id="dashboard">
      <h2>9. Your dashboard</h2>
      <p>Your dashboard lists every certificate you have issued. Search by name, email or achievement, filter by status, and open, copy the link to, or download any certificate.</p>
      <img src="/guide/step-9-dashboard.jpg" alt="The dashboard listing three issued certificates" loading="lazy">
    </section>

    <section>
      <h2>Next steps</h2>
      <ul>
        <li>
          Issuing straight from a spreadsheet or a sign-up form? See <NuxtLink to="/integrations/google-sheets">
            Google Sheets
          </NuxtLink> and <NuxtLink to="/integrations/google-forms">
            Google Forms
          </NuxtLink>.
        </li>
        <li>Running a course or event? Create an <strong>Event</strong> on the Issue page, and its name, dates and location are shown on each certificate page.</li>
        <li>Questions? Write to <a href="mailto:support@certrust.app">support@certrust.app</a>.</li>
      </ul>
    </section>
  </IntegrationManual>
</template>

<style scoped>
/* Step links jump here; keep the heading clear of the sticky header. */
section {
  scroll-margin-top: 6rem;
}
section img {
  margin-top: 1rem;
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}
</style>
