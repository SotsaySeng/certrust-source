const L = LEGAL

export function useTermsContent() {
  const termsContent: LegalDocument = {
    title: 'Terms and Conditions',
    summary: `These Terms govern your use of ${L.product}. Please read them carefully: they limit our liability, set out how disputes are resolved, and explain your responsibilities as an issuer of credentials.`,
    lastUpdated: L.effectiveDate,
    sections: [
      {
        id: 'agreement',
        title: '1. Agreement and who we are',
        paragraphs: [
          `${L.product} (the "<strong>Service</strong>") is operated by <strong>${L.company}</strong>, a company registered in the Lao People's Democratic Republic (${L.address}) ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>").`,
          `These Terms and Conditions (the "<strong>Terms</strong>"), together with our ${link('/privacy-policy', 'Privacy Policy')}, our ${link('/data-processing-agreement', 'Data Processing Agreement')} (the "<strong>DPA</strong>") and any order form you sign with us, form a binding agreement between you and us. You accept these Terms by creating an account, by ticking the acceptance box, or by using the Service.`,
          'If you accept these Terms on behalf of an organisation, you confirm that you have authority to bind that organisation, and "you" means that organisation. If you do not agree, do not use the Service.',
        ],
      },
      {
        id: 'definitions',
        title: '2. Definitions',
        items: [
          '<strong>Issuer</strong> or <strong>Customer</strong>: an organisation or person with an account that designs, issues, revokes or manages credentials through the Service.',
          '<strong>Recipient</strong>: a person to whom an Issuer awards a credential. A Recipient does not need an account.',
          '<strong>Verifier</strong>: anyone who views a credential or checks it through the Service, for example an employer.',
          '<strong>Credential</strong>: a digital certificate or badge, including its Open Badges 3.0 / Verifiable Credential data, image and verification page.',
          '<strong>Customer Content</strong>: all data, text, images, templates and personal data that an Issuer or its users submit to the Service, including Recipient data.',
          '<strong>Order Form</strong>: a written order or agreement, signed by both parties, that refers to these Terms.',
        ],
      },
      {
        id: 'order-of-precedence',
        title: '3. Order of precedence',
        paragraphs: [
          'If documents conflict, the following order applies, highest first: (a) an Order Form; (b) the DPA, for anything about personal data; (c) these Terms; (d) any other policy or documentation. Negotiated terms, service levels or a master services agreement apply only if they are set out in an Order Form signed by us. Terms printed on your purchase orders do not apply.',
        ],
      },
      {
        id: 'eligibility',
        title: '4. Eligibility and accounts',
        items: [
          'You must be at least 16 years old, and old enough to form a binding contract where you live, to create an account.',
          'You must give accurate registration information and keep it up to date.',
          'You are responsible for keeping your login credentials secret and for everything done through your account. Tell us promptly at ' + mailto(L.supportEmail) + ' if you suspect unauthorised access.',
          'Each login is for one individual. Do not share accounts.',
          'Recipients may be of any age. Credentials for minors may only be issued as described in section 6.',
        ],
      },
      {
        id: 'the-service',
        title: '5. What the Service is, and is not',
        paragraphs: [
          `${L.product} is a software tool that lets Issuers design, issue, send and revoke digitally signed credentials, and lets anyone check them. <strong>We are not the issuer of any credential.</strong> Each Issuer alone decides who receives a credential and what it says, and is solely responsible for its accuracy, truth and legal validity.`,
          '<strong>What verification confirms.</strong> A successful check means only that the credential was issued through the Service by the named Issuer account, and has not been altered, revoked or expired since. It does <strong>not</strong> confirm that the Recipient actually earned the qualification, that the Issuer has authority to award it, or that it is recognised by any institution, employer or regulator. Verifiers should contact the Issuer to confirm anything that matters to them. The same notice appears on every verification page.',
          'Unless an Issuer has passed our issuer-verification process, and the "Verified issuer" mark is shown, we have not checked who the Issuer is.',
        ],
      },
      {
        id: 'issuer-obligations',
        title: '6. Issuer obligations and warranties',
        paragraphs: ['If you issue credentials, you warrant and agree that:'],
        items: [
          '<strong>Authority.</strong> You are entitled to award each credential in the name shown on it. If it names an institution, you are that institution or are authorised by it in writing.',
          '<strong>Accuracy.</strong> Every credential is truthful, is awarded only to someone who met its criteria, and is not false, misleading or deceptive.',
          '<strong>Lawful basis and notice.</strong> You have a lawful basis to give us each Recipient\'s personal data and to have the credential issued. You have told Recipients, or will tell them when you collect their data, who you are, why their data is collected, that it will be processed and stored by us on your behalf (including outside their country), and how they can access and correct it. This covers, for example, Articles 13 and 14 of the GDPR and Information Privacy Principle 3A of the New Zealand Privacy Act 2020. Our credential email includes a short notice to help you, but the duty remains yours.',
          '<strong>Minors.</strong> Before you issue a credential to anyone under 16 (or a higher age of digital consent where they live), you have obtained verifiable consent from a parent or guardian where the law requires it, and you mark the credential as "issued to a minor" so that it is private by default.',
          '<strong>Sensitive data.</strong> You will not put special-category or sensitive personal data (for example health, religion, biometric data or government identity numbers) into credentials or evidence unless the law allows it and it is necessary.',
          '<strong>Revocation.</strong> You will promptly revoke any credential that was issued in error or should no longer be relied on.',
        ],
      },
      {
        id: 'issuer-verification',
        title: '7. Issuer verification, impersonation and takedown',
        items: [
          'We may, at any time, require you to prove your identity or your authority to issue in a particular name, for example by verifying control of an official email domain or by providing official documents. We may restrict issuing until you do.',
          'We may grant, withhold or withdraw the "Verified issuer" mark at our reasonable discretion.',
          `Anyone can report a credential or account through our ${link('/report', 'report page')} or at ${mailto(L.privacyEmail)}. We aim to acknowledge reports within 2 business days and to decide on them within 5 business days.`,
          'If we reasonably believe an account is impersonating an institution, issuing false credentials, or breaching these Terms, we may suspend it, hide its credentials behind a "suspended pending review" notice, revoke credentials, or close the account. Where the law and the circumstances allow, we will tell you first and give you a chance to respond.',
        ],
      },
      {
        id: 'acceptable-use',
        title: '8. Acceptable use',
        paragraphs: ['You must not, and must not let anyone else:'],
        items: [
          'issue forged, fraudulent or misleading credentials, or impersonate any person, institution or organisation;',
          'use the Service for anything unlawful, or to infringe anyone\'s intellectual property, privacy or other rights;',
          'send spam or unsolicited bulk email, or upload recipient lists you have no right to use;',
          'upload malware, or content that is defamatory, obscene, hateful or harassing;',
          'probe, scan or test the vulnerability of the Service, or bypass its security or usage limits, except under a written security-testing agreement with us;',
          'scrape, harvest or bulk-download other people\'s data, or overload the Service;',
          'resell or white-label the Service without our written agreement;',
          'use the Service in breach of sanctions or export-control laws.',
        ],
      },
      {
        id: 'customer-content',
        title: '9. Customer Content',
        items: [
          'You keep all rights in your Customer Content. You grant us a worldwide, non-exclusive, royalty-free licence to host, copy, process, transmit and display it only as needed to provide, secure and support the Service, and as the law requires.',
          '<strong>Public by design.</strong> Unless a credential is set to private, its verification page is reachable by anyone who has its link, and shows the Recipient\'s name, the credential details and the Issuer. Verification pages are not submitted to search engines and ask them not to index the page, but we cannot control what third parties do with a link or copy they already have.',
          'Recipients can make their own credential private. You instruct us, through the DPA, to honour that choice.',
          'Credential data is also embedded in downloaded images and files and in shared copies (for example LinkedIn). Revoking or deleting a credential stops it verifying, but cannot recall copies already downloaded or shared.',
          'You are responsible for keeping your own copies of Customer Content. The Service is not an archive of record.',
          'If you send us feedback or suggestions, we may use them freely without obligation to you.',
        ],
      },
      {
        id: 'intellectual-property',
        title: '10. Intellectual property and open source',
        paragraphs: [
          `${L.product} is built on <strong>Certo</strong>, an open-source project licensed under the <strong>GNU Affero General Public License, version 3</strong> (AGPL-3.0), as modified by us. The source code of the version we run, including our modifications, is available at ${link(L.sourceCodeUrl, L.sourceCodeUrl.replace('https://', ''))} under the AGPL-3.0. Nothing in these Terms restricts the rights the AGPL-3.0 gives you in that code.`,
          `We (or our licensors) own the ${L.product} name, logos and brand; the website text, documentation and design; any components we wrote separately that are not part of the AGPL-licensed code; and the hosted Service. Except for your rights under the AGPL-3.0 and your right to use the Service under these Terms, you get no rights in them, and you may not use our name or logos without written permission.`,
        ],
      },
      {
        id: 'fees',
        title: '11. Plans, fees and billing',
        items: [
          'Paid plans are billed in advance, monthly or yearly, through our payment processor Stripe, and renew automatically until cancelled. We never see or store your full card number.',
          'Free trials convert to the free plan, or to a paid plan only if you chose one, when they end.',
          'You can cancel at any time in your billing settings. Cancellation takes effect at the end of the current billing period.',
          'Fees exclude taxes. You pay any applicable sales, use, goods-and-services or withholding taxes, except taxes on our income.',
          `We may change prices with at least ${L.noticeDays} days' notice by email. A change applies from your next renewal after the notice period. If you do not accept it, you may cancel before it applies and we will refund any prepaid fees for the unused period after the change takes effect.`,
          'Fees already paid are not refundable, except as stated in these Terms or where the law requires a refund.',
          'If a payment fails, we may downgrade your account to the free plan after notice. Existing credentials keep verifying (see section 14).',
        ],
      },
      {
        id: 'free-and-education',
        title: '12. Free plan, education access and beta features',
        items: [
          'The free plan, free education access and any beta or preview features are provided without any service commitment and may have usage limits.',
          `We may change or end free education access with at least ${L.noticeDays} days' notice. You will have at least that long to export your data, and credentials already issued keep verifying.`,
          'Beta features may change or be withdrawn at any time.',
        ],
      },
      {
        id: 'availability',
        title: '13. Availability, support and changes to the Service',
        paragraphs: [
          'We work to keep the Service available, secure and backed up, but we do not promise uninterrupted or error-free operation, and no service level applies unless an Order Form says so. We may change or improve the Service. If a change materially reduces the core functionality of a paid plan, you may cancel and receive a pro-rata refund of prepaid fees for the unused period. Support is provided by email at ' + mailto(L.supportEmail) + '.',
        ],
      },
      {
        id: 'credential-continuity',
        title: '14. What happens to credentials if an Issuer leaves',
        items: [
          'If an Issuer cancels, downgrades, stops paying or closes its account, credentials it has already issued <strong>continue to verify, read-only, for as long as we operate the Service</strong>. Once the account is closed, their verification page shows "Issuer account inactive".',
          'Recipients can always download their signed credential file from its verification page (unless the Issuer revoked or deleted it) and keep it independently.',
          '<strong>Revoked</strong> means the credential still exists but is marked as no longer valid; its page says so, with the date and any reason the Issuer gave. <strong>Deleted</strong> means the credential has been removed; its link shows "not found or removed by the issuer".',
          `If we ever stop operating the Service, we will give at least 90 days' notice so that Issuers and Recipients can export their credentials.`,
        ],
      },
      {
        id: 'third-parties',
        title: '15. Third-party services',
        paragraphs: [
          `The Service relies on third-party providers (listed on our ${link('/subprocessors', 'sub-processors page')}) and lets you share to third-party sites such as LinkedIn. We are not responsible for third-party sites or services you choose to use, and your use of them is governed by their own terms.`,
        ],
      },
      {
        id: 'suspension-termination',
        title: '16. Suspension and termination',
        items: [
          'You may stop using the Service and close your account at any time.',
          `We may end these Terms for convenience with ${L.noticeDays} days' notice, and will refund prepaid fees for the unused period.`,
          'We may suspend or terminate your account immediately if you materially breach these Terms (including section 8), if required by law, or to prevent harm to the Service, other users or the public.',
          'On termination, your right to use the Service ends. We will make your data available for export for 30 days, then delete it as described in the DPA and Privacy Policy, apart from credentials that remain verifiable under section 14.',
          'Sections that by their nature should survive termination survive it, including sections 9, 10, 14 and 17 to 24.',
        ],
      },
      {
        id: 'disclaimer',
        title: '17. Disclaimer of warranties',
        paragraphs: [
          'To the fullest extent permitted by law, the Service is provided <strong>"as is" and "as available"</strong>. We make no warranty, express or implied, including of merchantability, fitness for a particular purpose, title or non-infringement. We do not warrant that the Service will be uninterrupted, secure or error-free, that data will not be lost, or that any credential is accurate, lawful, or recognised or accepted by any person or institution.',
          'Nothing in these Terms excludes, restricts or modifies any right or remedy, or any guarantee, warranty or other term or condition, implied or imposed by law that cannot lawfully be excluded, including consumer guarantees under the Australian Consumer Law and the New Zealand Consumer Guarantees Act 1993. Where the law allows us to limit our liability for breach of such a guarantee, our liability is limited, at our option, to supplying the services again or paying the cost of having them supplied again.',
        ],
      },
      {
        id: 'limitation-of-liability',
        title: '18. Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law:',
        ],
        items: [
          'neither party is liable for any indirect, incidental, special, consequential, exemplary or punitive damages, or for any loss of profits, revenue, business, goodwill, data or anticipated savings, however caused, even if advised of the possibility;',
          'our total aggregate liability arising out of or relating to the Service or these Terms, whether in contract, tort (including negligence), statute or otherwise, is limited to <strong>the greater of (a) the fees you paid us for the Service in the 12 months before the event giving rise to the claim, and (b) USD 100</strong>;',
          'we are not liable for any loss arising from reliance on a credential or a verification result by you or any third party, or from an Issuer\'s acts or omissions.',
        ],
        after: [
          'These limits do not apply to liability that cannot be limited by law, including liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for wilful misconduct; to your payment obligations; or to your obligations under section 19(a).',
        ],
      },
      {
        id: 'indemnity',
        title: '19. Indemnities',
        paragraphs: [
          '(a) <strong>By you.</strong> You will defend and indemnify us, our officers and employees against third-party claims, and the resulting losses, damages, fines and reasonable legal costs, to the extent they arise from: your Customer Content; a credential you issued, including a claim that it is false or that you lacked authority to issue it; your breach of section 6 or 8; or your breach of data-protection law as controller.',
          '(b) <strong>By us.</strong> Subject to section 18, we will defend and indemnify you against third-party claims, and the resulting losses, damages, fines and reasonable legal costs, to the extent they arise from our breach of the DPA.',
          '(c) <strong>Process.</strong> The party seeking indemnity must notify the other promptly, let it control the defence and settlement (it may not admit fault for the indemnified party without consent), and provide reasonable help at the indemnifying party\'s cost.',
        ],
      },
      {
        id: 'disputes',
        title: '20. Governing law and disputes',
        items: [
          `These Terms, and any dispute or claim arising out of or in connection with them or the Service (including non-contractual disputes), are governed by the laws of ${L.governingLaw}, without regard to its conflict-of-laws rules. The UN Convention on Contracts for the International Sale of Goods does not apply.`,
          `<strong>Talk to us first.</strong> Before starting proceedings, the claiming party must send written notice of the dispute (to ${mailto(L.supportEmail)} for us) and both parties must try in good faith to resolve it for 30 days.`,
          'Subject to that step, the <strong>courts of Singapore have exclusive jurisdiction</strong>, including the Small Claims Tribunals for claims within their limits. Either party may seek urgent injunctive relief in any competent court.',
          '<strong>Class-action and jury waiver.</strong> To the extent permitted by law, claims may be brought only individually and not as a plaintiff or class member in any class, collective or representative proceeding, and each party waives any right to trial by jury.',
          'To the extent permitted by law, a claim must be brought within one year after the claiming party became aware, or should reasonably have become aware, of it.',
          '<strong>Consumers.</strong> If you use the Service as a consumer, or as a small business that is protected in your country, this section does not take away any mandatory protection given to you by the law where you live, including any right to bring proceedings in your local courts or to rely on a longer limitation period.',
        ],
      },
      {
        id: 'nz-australia',
        title: '21. New Zealand and Australian customers',
        items: [
          'If you acquire the Service <strong>in trade</strong> in New Zealand, you agree that the Consumer Guarantees Act 1993 and sections 9, 12A, 13 and 14(1) of the Fair Trading Act 1986 do not apply, to the extent that this is fair and reasonable given the parties\' positions and the value of the Service.',
          'Nothing in these Terms is intended to create an unfair contract term under the Australian Consumer Law. If a court finds that any term is unfair, that term is to be read down, or severed, only as far as needed to make it enforceable.',
        ],
      },
      {
        id: 'changes',
        title: '22. Changes to these Terms',
        paragraphs: [
          `We may update these Terms. For a material change we will give at least ${L.noticeDays} days' notice by email to account owners and in the Service before it takes effect, unless a change is needed sooner to comply with law or address a security risk. If you object to a material change, you may cancel before it takes effect and we will refund any prepaid fees for the period after that date. Otherwise, the updated Terms apply from the date stated. Non-material changes (such as clarifications) take effect when published.`,
        ],
      },
      {
        id: 'general',
        title: '23. General',
        items: [
          '<strong>Force majeure.</strong> Neither party is liable for delay or failure caused by events beyond its reasonable control, such as natural disasters, war, internet or utility outages, or failures of third-party infrastructure. This does not excuse payment obligations.',
          '<strong>Assignment.</strong> You may not assign these Terms without our consent. We may assign them in connection with a merger, acquisition or sale of assets, with notice to you.',
          '<strong>Severability and waiver.</strong> If any provision is unenforceable, it is limited or severed to the minimum extent needed and the rest remains in force. Not enforcing a provision is not a waiver of it.',
          '<strong>Entire agreement.</strong> These Terms, together with the documents in section 3, are the entire agreement about their subject matter and supersede prior understandings.',
          '<strong>No third-party rights.</strong> No one other than the parties has rights under these Terms, including under the Contracts (Rights of Third Parties) Act 2001 of Singapore.',
          '<strong>Relationship.</strong> The parties are independent contractors.',
          '<strong>Language.</strong> These Terms are written in English. If we provide a translation, the English version prevails to the extent permitted by law.',
          `<strong>Notices.</strong> We send notices to your account email. You send notices to ${mailto(L.supportEmail)}, or by post to ${L.company}, ${L.address}.`,
        ],
      },
      {
        id: 'contact',
        title: '24. Contact',
        paragraphs: [
          `${L.company}, ${L.address}.<br>General and legal: ${mailto(L.supportEmail)} · Privacy and data protection: ${mailto(L.privacyEmail)}`,
        ],
      },
    ],
  }

  return {
    termsContent: readonly(termsContent),
  }
}
