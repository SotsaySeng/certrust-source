<script setup lang="ts">
// Screenshots: ai-1-consent.jpg and ai-2-connected-app.jpg are the real
// consent screen and API keys page (Aroha Academy demo organisation);
// re-take them when those screens change.
const config = useRuntimeConfig()
const mcpUrl = computed(() => `${String(config.public.apiUrl || 'https://api.certrust.app').replace(/\/$/, '')}/mcp`)
const pageDescription = 'Connect Claude, ChatGPT or another AI assistant to Certrust, so it can issue, look up and verify your certificates for you. No technical setup.'

useSeoMeta({
  title: 'Connect an AI assistant',
  description: pageDescription,
  ogDescription: pageDescription,
  ogUrl: `${WEBSITE_URL}/guide/connect-ai-assistant`,
  ogImage: `${WEBSITE_URL}/guide/ai-1-consent.jpg`
})

useHead({
  title: 'Connect an AI assistant',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/guide/connect-ai-assistant` }]
})

const steps = [
  { id: 'what', title: 'What your assistant can do' },
  { id: 'before', title: 'Before you start' },
  { id: 'claude', title: 'Connect Claude' },
  { id: 'other', title: 'Connect ChatGPT or another assistant' },
  { id: 'permissions', title: 'Choose what it may do' },
  { id: 'use', title: 'Start using it' },
  { id: 'manage', title: 'See and disconnect it' },
  { id: 'help', title: 'If something goes wrong' },
]

const permissions = [
  { name: 'Read', does: 'Look up your achievements, events and the certificates you have issued.', when: 'Always. The assistant needs it to find things.' },
  { name: 'Issue', does: 'Issue certificates to one person or a whole list, and renew them.', when: 'When you want it to send certificates for you.' },
  { name: 'Revoke', does: 'Cancel a certificate so it no longer verifies. This can\'t be undone.', when: 'Only if you really need it.' },
  { name: 'Manage', does: 'Create and edit achievements and events.', when: 'Rarely. Most people set these up on the website.' },
]

const prompts = [
  'Which achievements can we issue?',
  'Here is the attendee list from Friday\'s workshop. Issue everyone the "First Aid Basics" certificate.',
  'Who received the Safety Induction badge this month?',
  'Is this certificate genuine? urn:uuid:…',
  'Renew Mere Tane\'s certificate until the end of next year.',
  'How many certificates have we issued for the Leadership course, and are any expired?',
]
</script>

<template>
  <IntegrationManual crumb="Get started" crumb-to="/get-started" section="Guide" title="Connect an AI assistant">
    <p class="lead">
      Connect Certrust to the AI assistant you already use, such as Claude or ChatGPT, and ask it in plain words to issue, find or check your certificates. Setting it up takes about two minutes and needs no technical knowledge.
    </p>

    <video
      class="tutorial mt-8"
      src="/guide/integrations/claude-tutorial.mp4"
      poster="/guide/integrations/claude-7d-issued.jpg"
      controls
      preload="none"
      playsinline
      data-testid="guide-video"
    />

    <nav class="steps mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5" aria-label="Steps">
      <p class="font-semibold text-gray-900">
        On this page
      </p>
      <ol class="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2" style="list-style: none; padding-left: 0">
        <li v-for="(s, i) in steps" :key="s.id">
          <a :href="`#${s.id}`" class="text-[#1f7a34] hover:underline">{{ i + 1 }}. {{ s.title }}</a>
        </li>
      </ol>
    </nav>

    <section id="what">
      <h2>1. What your assistant can do</h2>
      <p>Once connected, your assistant works with your organisation's Certrust account. You can ask it to:</p>
      <ul>
        <li><strong>Issue certificates</strong> to one person, or to everyone on a list you paste or attach (up to 2,000 at a time).</li>
        <li><strong>Find</strong> who received which certificate, and which ones have expired or been revoked.</li>
        <li><strong>Check</strong> whether any certificate is genuine.</li>
        <li><strong>Renew</strong> a certificate with a new expiry date, or <strong>revoke</strong> one if you allow it.</li>
      </ul>
      <p>The assistant only does what you allow when you connect it, and only for your organisation.</p>
    </section>

    <section id="before">
      <h2>2. Before you start</h2>
      <ul>
        <li>
          <strong>Your Certrust plan:</strong> connecting AI assistants is included in the <NuxtLink to="/billing">
            Pro and Enterprise plans
          </NuxtLink>.
        </li>
        <li><strong>Your Certrust account:</strong> you need to be able to sign in to your organisation on Certrust.</li>
        <li><strong>Your assistant:</strong> it must support <em>custom connectors</em> (also called MCP servers). Claude and ChatGPT do on many of their plans; check your assistant's settings.</li>
        <li><strong>The address</strong> you will paste into your assistant: <code>{{ mcpUrl }}</code></li>
      </ul>
    </section>

    <section id="claude">
      <h2>3. Connect Claude</h2>
      <ol>
        <li>On <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a> or in the Claude app, open <strong>Customize</strong>, then <strong>Connectors</strong>. Select <strong>+ Add</strong>, then <strong>Add custom connector</strong>.</li>
      </ol>
      <img class="shot" src="/guide/integrations/claude-1-connectors.jpg" alt="Claude's Connectors list with the + Add button" loading="lazy">
      <ol start="2">
        <li>Name it <strong>Certrust</strong>, paste the address <code>{{ mcpUrl }}</code> and select <strong>Continue</strong>.</li>
      </ol>
      <img class="shot" src="/guide/integrations/claude-2-add-custom-connector.jpg" alt="Claude's Add custom connector window with the name Certrust and the address filled in" loading="lazy">
      <ol start="3">
        <li>Claude checks Certrust and picks the sign-in settings for you: <strong>Sign in now</strong> and <strong>Register automatically</strong>, both marked "Detected". Leave them as they are, scroll down and select <strong>Add</strong>.</li>
      </ol>
      <img class="shot" src="/guide/integrations/claude-3-auth-detected.jpg" alt="Claude's connector settings with Sign in now and Register automatically marked Detected" loading="lazy">
      <ol start="4">
        <li>Select <strong>Connect</strong>. A Certrust page opens. Sign in if asked.</li>
      </ol>
      <img class="shot" src="/guide/integrations/claude-4-not-connected-yet.jpg" alt="The new Certrust connector in Claude with a Connect button" loading="lazy">
      <ol start="5">
        <li>Choose what Claude may do (see <a href="#permissions">step 5</a>) and select <strong>Allow Claude</strong>.</li>
        <li>You are taken back to Claude, which now lists the Certrust tools. By default Claude asks you before it uses each one.</li>
      </ol>
      <img class="shot" src="/guide/integrations/claude-6-connected-tools.jpg" alt="Certrust connected in Claude, listing read-only and write tools, each set to Needs approval" loading="lazy">
      <img class="narrow" src="/guide/ai-1-consent.jpg" alt="The Certrust page asking to connect Claude to Aroha Academy, with Read and Issue ticked" loading="lazy">
      <div class="note">
        Check the line <strong>You will be sent back to …</strong> before you click Allow. For Claude it says <strong>claude.ai</strong>. If it shows a website you don't recognise, click <strong>Cancel</strong>.
      </div>
    </section>

    <section id="other">
      <h2>4. Connect ChatGPT or another assistant</h2>
      <p>The steps are the same in any assistant that supports custom connectors:</p>
      <ol>
        <li>In your assistant's settings, find <strong>Connectors</strong>, <strong>Apps</strong> or <strong>MCP servers</strong> and add a new one. Some plans ask you to turn on <em>developer mode</em> first.</li>
        <li>Paste the address <code>{{ mcpUrl }}</code>. If it asks how to sign in, choose <strong>OAuth</strong>.</li>
        <li>Click <strong>Connect</strong>, sign in to Certrust, choose the permissions and click <strong>Allow</strong>.</li>
      </ol>
      <p>
        Using a desktop app that is set up with a settings file instead (Claude Desktop, Cursor, VS Code)? Ask whoever manages your computers to follow the
        <NuxtLink to="/integrations/guide#ai-developer">
          developer instructions
        </NuxtLink>; they use an API key instead.
      </p>
    </section>

    <section id="permissions">
      <h2>5. Choose what it may do</h2>
      <p>On the Certrust page you tick what the assistant may do. Start small: you can disconnect and connect again with more later.</p>
      <div class="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Permission</th>
              <th>Lets the assistant</th>
              <th>Tick it</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in permissions" :key="p.name">
              <td class="font-medium whitespace-nowrap align-top">
                {{ p.name }}
              </td>
              <td class="align-top">
                {{ p.does }}
              </td>
              <td class="align-top">
                {{ p.when }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>The assistant acts as <strong>you</strong>: it can never do more than you can in your organisation, even with every box ticked.</p>
    </section>

    <section id="use">
      <h2>6. Start using it</h2>
      <p>In a new chat, make sure Certrust is switched on (in Claude, in the tools or connectors menu under the message box), then just ask. For example:</p>
      <ul>
        <li v-for="p in prompts" :key="p">
          <em>"{{ p }}"</em>
        </li>
      </ul>
      <p>When Claude wants to issue, it shows exactly who will receive what and waits for you:</p>
      <img class="shot" src="/guide/integrations/claude-7c-issue-approval.jpg" alt="Claude asking for approval to issue a credential, showing the achievement, recipient email and name, with Allow once and Decline" loading="lazy">
      <p>Select <strong>Allow once</strong>, and it confirms with a link to the certificate:</p>
      <img class="shot" src="/guide/integrations/claude-7d-issued.jpg" alt="Claude confirming it issued the certificate to Ana Ruiz, with the credential ID and a link" loading="lazy">
      <div class="note">
        <strong>Issuing is real.</strong> Every certificate is emailed to the recipient straight away and counts towards your credential allowance. Before it issues, the assistant should show you who will receive what. Read it, and only say yes when it is right. If you ask twice by mistake, the same person won't get the same certificate twice within 24 hours.
      </div>
      <p>
        The assistant uses the achievements and events you have already set up in Certrust. Need a new course or certificate design? Create it on the website first (see <NuxtLink to="/guide/issue-your-first-certificate">
          Issue your first certificate
        </NuxtLink>).
      </p>
    </section>

    <section id="manage">
      <h2>7. See and disconnect it</h2>
      <p>Every connected assistant is listed under <strong>Manage &gt; API keys</strong> as a <strong>Connected app</strong>, with its permissions, who connected it and when it was last used.</p>
      <img src="/guide/ai-2-connected-app.jpg" alt="The API keys page listing Claude as a connected app with Read and Issue permissions, and a Disconnect button" loading="lazy">
      <ul>
        <li>Click <strong>Disconnect</strong> to cut it off straight away. To use it again, connect again from your assistant.</li>
        <li>A connection also stops if the assistant isn't used for 30 days, or if the person who connected it leaves your organisation.</li>
        <li>Everything the assistant does is recorded in Certrust's audit log under the app's name.</li>
      </ul>
    </section>

    <section id="help">
      <h2>8. If something goes wrong</h2>
      <ul>
        <li>
          <strong>"Connecting AI apps is included in the Pro and Enterprise plans":</strong> your organisation is on the Free plan. <NuxtLink to="/billing">
            Upgrade
          </NuxtLink>, then connect again.
        </li>
        <li><strong>"The app sent an unexpected return address" or "not registered":</strong> start the connection again from your assistant. If it keeps happening, remove the connector in your assistant and add it again.</li>
        <li><strong>The assistant says it can't do something:</strong> it probably wasn't given that permission. Disconnect it, connect again and tick the permission.</li>
        <li><strong>It stopped working:</strong> it may have been disconnected, unused for 30 days, or your plan changed. Connect again from your assistant.</li>
        <li><strong>Too many keys:</strong> an organisation can have up to 20 API keys and connected apps. Disconnect ones you no longer use.</li>
        <li>Still stuck? Write to <a href="mailto:support@certrust.app">support@certrust.app</a>.</li>
      </ul>
    </section>
  </IntegrationManual>
</template>

<style scoped>
/* Step links jump here; keep the heading clear of the sticky header. */
section {
  scroll-margin-top: 6rem;
}
/* The step list is a grid: no stacked-list spacing between items. */
nav.steps li + li {
  margin-top: 0;
}
section img {
  margin-top: 1rem;
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}
section img.narrow {
  max-width: 28rem;
}
</style>
