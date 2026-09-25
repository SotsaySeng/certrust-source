const L = LEGAL

export function usePrivacyContent() {
  const privacyContent: LegalDocument = {
    title: 'Privacy Policy',
    summary: `How ${L.company} collects, uses, shares and protects personal data when you use ${L.product}, and the rights you have wherever you live.`,
    lastUpdated: L.effectiveDate,
    sections: [
      {
        id: 'who-we-are',
        title: '1. Who we are and our role',
        paragraphs: [
          `${L.product} is operated by <strong>${L.company}</strong>, ${L.address} ("<strong>we</strong>", "<strong>us</strong>"). You can contact our Data Protection Officer at ${mailto(L.privacyEmail)}.`,
          'Our role depends on whose data it is:',
        ],
        items: [
          '<strong>We are the controller</strong> for data about our own customers\' account holders, website visitors, people who contact us, and people who use our report page.',
          '<strong>We are a processor (service provider)</strong> for the personal data in credentials. The organisation that issued your credential (the "<strong>Issuer</strong>") decides what data is collected and why, and is the controller. We process that data only on the Issuer\'s instructions, under our ' + link('/data-processing-agreement', 'Data Processing Agreement') + '.',
        ],
        after: [
          'If you received a credential and want to access, correct or delete it, please contact the Issuer first. If you cannot reach them, write to us and we will pass your request on and help where we can.',
        ],
      },
      {
        id: 'data-we-collect',
        title: '2. The personal data we handle',
        items: [
          '<strong>Account holders:</strong> name, username, email address, organisation name and type, encrypted password (we store only a one-way hash), account settings, and an audit log of actions in the account.',
          '<strong>Billing:</strong> billing email, plan, invoices and payment status. Card details are collected and held by Stripe. We never receive full card numbers.',
          '<strong>Recipients</strong> (provided by the Issuer): name, email address, the credential\'s content (achievement, dates, evidence and any description), whether it was issued to a minor, and its visibility setting. If a Recipient sets a password, we also hold their account data as above.',
          '<strong>Verifiers and website visitors:</strong> IP address, browser and device information, pages and credentials viewed, and the time of the request, kept in security and server logs.',
          '<strong>Communications:</strong> emails you send us, reports submitted through our report page, and records of what we did about them.',
          '<strong>Cookies and local storage:</strong> see section 7.',
        ],
        after: [
          'We do not seek, and ask Issuers not to include, sensitive data such as health information, religious beliefs, biometric data or government identity numbers.',
        ],
      },
      {
        id: 'purposes',
        title: '3. Why we use personal data, and our legal bases',
        paragraphs: ['Where laws such as the EU or UK GDPR require a legal basis, we rely on the following:'],
        items: [
          '<strong>To provide the Service</strong>: create and secure accounts, issue, deliver, display and verify credentials, and give support. Basis: performance of our contract with you, or with the Issuer (for Recipient data we process as a processor, the Issuer\'s basis applies).',
          '<strong>To bill</strong> and keep accounting records. Basis: contract and legal obligation.',
          '<strong>To keep the Service secure</strong>, prevent fraud and impersonation, investigate reports and enforce our Terms. Basis: our legitimate interest in a trustworthy service, and legal obligation.',
          '<strong>To send service messages</strong>, such as confirmations, credential notifications, expiry reminders, trial and billing notices, and legal notices. Basis: contract and legitimate interest. These are not marketing.',
          '<strong>To understand usage of our public website</strong>, only if analytics is enabled and only with your consent (see section 7). Basis: consent.',
          '<strong>To comply with law</strong> and respond to lawful requests. Basis: legal obligation.',
        ],
        after: [
          'We do not use personal data for advertising, we do not sell it, and we do not use Recipients\' data for our own purposes. We do not make decisions based solely on automated processing that have legal or similarly significant effects on you. If we introduce AI-assisted features, we will describe them here before they go live.',
        ],
      },
      {
        id: 'public-credentials',
        title: '4. Public verification pages, private credentials and minors',
        items: [
          'Every credential has a verification page. By default, anyone who has its link can see the Recipient\'s name, the credential details, the Issuer, and whether it is valid.',
          'Verification pages are marked <strong>noindex</strong> and are not listed in our sitemap, so search engines are asked not to index them. Credential links use random, unguessable identifiers.',
          '<strong>Private credentials.</strong> A Recipient (or the Issuer) can make a credential private at any time. A private credential\'s page shows only that a valid credential was issued by the named Issuer on a date, not the Recipient\'s name or the credential details. The holder can still prove it by sharing the signed file.',
          '<strong>Minors.</strong> Credentials that the Issuer marks as issued to a minor are private by default. Account holders must be at least 16; Recipients may be younger, and the Issuer is responsible for any parental or guardian consent the law requires.',
          '<strong>Copies we cannot recall.</strong> Credential data (Open Badges metadata) is embedded in downloaded images and credential files, and appears in anything the Recipient shares, for example a LinkedIn post. If a credential is later revoked or deleted, it stops verifying on our pages, but copies already downloaded or shared stay wherever they were put.',
        ],
      },
      {
        id: 'issuer-exit',
        title: '5. When an Issuer leaves',
        paragraphs: [
          'So that Recipients do not lose proof of what they earned, credentials an Issuer has already issued continue to verify, read-only, after the Issuer cancels or closes its account; their page then shows "Issuer account inactive". Recipients can always download their signed credential. A Recipient who wants their credential removed can ask the Issuer or, if the Issuer is inactive, ask us.',
        ],
      },
      {
        id: 'sharing',
        title: '6. Who we share personal data with',
        items: [
          `<strong>Service providers (sub-processors)</strong> who host and run the Service for us under contracts that protect the data: Cloudflare (hosting, content delivery, file storage, email sending and routing), Neon (database, Singapore region), Stripe (payments), and Google (our support mailbox, and website analytics only if enabled with your consent). The current list, with locations, is on our ${link('/subprocessors', 'sub-processors page')}.`,
          '<strong>The Issuer</strong>, for credentials it issued, and <strong>anyone the credential\'s holder shares it with</strong>.',
          '<strong>Authorities</strong>, if the law requires it, or to protect the rights, safety or property of people or of the Service. We push back on requests that are not legally valid.',
          '<strong>A successor</strong>, if our business or assets are merged, sold or transferred; we will notify you and this policy will continue to apply.',
        ],
        after: [
          '<strong>We do not sell personal data and we do not "share" it for cross-context behavioural advertising</strong>, as those terms are used in US state privacy laws.',
        ],
      },
      {
        id: 'cookies',
        title: '7. Cookies and similar technologies',
        items: [
          '<strong>Session cookie</strong> (strictly necessary): keeps you signed in. It is marked HttpOnly and Secure, cannot be read by page scripts, and expires after 7 days or when you sign out.',
          '<strong>Language preference</strong> (<code>certrust_locale</code>, functional): remembers the language you chose, for up to 1 year.',
          '<strong>Sign-in hint</strong> (<code>certrust_signed_in</code> in local storage, functional): notes that this browser has signed in, so pages know whether to check for a session. It contains no credentials and is removed when you sign out.',
          '<strong>Consent record</strong> (<code>certrust_analytics_consent</code> in local storage, functional): remembers your analytics choice.',
          '<strong>Google Analytics 4</strong> (analytics, optional): only if we have enabled it, only after you accept it in the cookie banner, and never on credential verification pages. It uses Google\'s Consent Mode, so no analytics cookies are set without consent. You can withdraw consent at any time from the "Cookie settings" link in the footer.',
        ],
        after: [
          'We do not use advertising or cross-site tracking cookies.',
        ],
      },
      {
        id: 'international-transfers',
        title: '8. Where your data is stored, and international transfers',
        paragraphs: [
          'Our database is hosted in <strong>Singapore</strong>. Our application and files are served through Cloudflare\'s global network, so data may be processed in the country nearest to you. We are based in Laos, and our service providers are based in the United States and elsewhere. So your data will usually be transferred outside your country.',
          'Where the law requires safeguards for such transfers, we use them: for the EU and UK, the European Commission\'s Standard Contractual Clauses and the UK International Data Transfer Addendum, or an adequacy decision; for Singapore, Thailand, Vietnam, Australia and New Zealand, contractual protections comparable to those laws, and any assessments or filings those laws require.',
          '<strong>New Zealand (IPP 12):</strong> we disclose personal information to our service providers overseas only where they are required to protect it in a way that, overall, provides comparable safeguards to the New Zealand Privacy Act 2020, or with your authorisation after telling you that it may not be protected in that way.',
        ],
      },
      {
        id: 'retention',
        title: '9. How long we keep data',
        items: [
          '<strong>Accounts:</strong> while the account is open. When you delete your account we erase or anonymise your personal data within 30 days, except where we must keep it (for example invoices, which tax law may require us to keep for up to 10 years).',
          '<strong>Credentials:</strong> for as long as the Issuer keeps them, including after the Issuer leaves (section 5), until the Issuer or the Recipient asks for deletion.',
          '<strong>Security and server logs:</strong> up to 90 days, unless needed to investigate an incident.',
          '<strong>Reports and support emails:</strong> up to 2 years after the matter is closed.',
          `<strong>Backups:</strong> deleted data can remain in our encrypted backups for up to <strong>${L.backupRetentionDays} days</strong>, until those backups rotate out. Backups are used only to recover from a disaster; data deleted before a restore is not brought back into use.`,
        ],
      },
      {
        id: 'security',
        title: '10. Security',
        paragraphs: [
          'We protect personal data with measures appropriate to the risk, including: encryption in transit (TLS) and of stored backups; one-way hashing of passwords; HttpOnly, Secure session cookies; digitally signed credentials so tampering is detectable; per-organisation access controls; least-privilege access for our staff; and encrypted, off-site backups. No system is perfectly secure. Please use a strong, unique password.',
          `<strong>Breaches.</strong> If a personal data breach affects your data, we will act quickly to contain it. Where we are controller, we will notify the relevant regulator and affected people as the law requires (for example within 72 hours under the GDPR, or within 3 calendar days of assessing a notifiable breach under Singapore's PDPA). Where we are a processor, we notify the Issuer without undue delay and in any case within ${L.breachNoticeHours} hours of becoming aware of the breach, and help it meet its own obligations.`,
        ],
      },
      {
        id: 'your-rights',
        title: '11. Your rights',
        paragraphs: ['Depending on where you live, you may have the right to:'],
        items: [
          'access the personal data we hold about you, and get a copy;',
          'correct inaccurate data;',
          'delete your data, or ask us to stop using it;',
          'restrict or object to our use of it, including where we rely on legitimate interests;',
          'receive your data in a portable format;',
          'withdraw consent at any time, where we rely on consent;',
          'complain to a data protection authority (see section 12).',
        ],
        after: [
          `To exercise a right, email ${mailto(L.privacyEmail)} or use the tools in your account (profile, data export and account deletion). We may need to verify your identity. We respond within 30 days, or sooner if your local law requires it. We will not treat you differently for exercising your rights. For credential data we process for an Issuer, see section 1.`,
        ],
      },
      {
        id: 'regional',
        title: '12. Additional information for your region',
        items: [
          '<strong>European Union / United Kingdom:</strong> the legal bases are in section 3 and transfer safeguards in section 8. You may complain to your local supervisory authority (in the UK, the Information Commissioner\'s Office). If the law requires us to appoint a representative in the EU or UK, we will name them here.',
          '<strong>United States:</strong> we do not sell or share personal information, and we do not use or disclose sensitive personal information for purposes that require an opt-out. Residents of states with comprehensive privacy laws (such as California) may exercise the rights in section 11, including through an authorised agent, and may appeal a refusal by replying to our decision.',
          `<strong>Singapore (PDPA):</strong> you may withdraw consent, and request access to or correction of your personal data. Our Data Protection Officer can be reached at ${mailto(L.privacyEmail)}. You may also contact the Personal Data Protection Commission.`,
          '<strong>Lao PDR:</strong> we handle personal data in line with the Law on Electronic Data Protection (2017), including your rights to access, correct and delete your data, and we take appropriate measures to protect it when it is stored outside Laos.',
          '<strong>Thailand (PDPA):</strong> you have the rights in section 11. You may complain to the Personal Data Protection Committee.',
          '<strong>Vietnam:</strong> we handle personal data in line with the Law on Personal Data Protection (No. 91/2025/QH15) and Decree 356/2025/ND-CP, including their requirements for cross-border transfers and impact assessments.',
          '<strong>Australia:</strong> we handle personal information in line with the Australian Privacy Principles. You may complain to us first, and then to the Office of the Australian Information Commissioner.',
          '<strong>New Zealand:</strong> we comply with the Privacy Act 2020, including the Information Privacy Principles. You may complain to us first, and then to the Office of the Privacy Commissioner.',
        ],
      },
      {
        id: 'children',
        title: '13. Children',
        paragraphs: [
          `Accounts are for people aged 16 and over. Issuers may issue credentials to younger people only with any parental or guardian consent the law requires, and must mark those credentials as issued to a minor so they are private by default. If you believe we hold a child's data without proper consent, contact ${mailto(L.privacyEmail)} and we will act promptly.`,
        ],
      },
      {
        id: 'changes',
        title: '14. Changes to this policy',
        paragraphs: [
          `We will post any change here and update the date at the top. If a change is material, we will tell account holders by email at least ${L.noticeDays} days before it takes effect, unless it is required sooner by law.`,
        ],
      },
      {
        id: 'contact',
        title: '15. Contact',
        paragraphs: [
          `Data Protection Officer, ${L.company}, ${L.address}.<br>Email: ${mailto(L.privacyEmail)}`,
        ],
      },
    ],
  }

  return {
    privacyContent: readonly(privacyContent),
  }
}
