const L = LEGAL

export function useDpaContent() {
  const dpaContent: LegalDocument = {
    title: 'Data Processing Agreement',
    summary: `This Data Processing Agreement ("DPA") forms part of the ${L.product} Terms and Conditions between the Customer (the "Issuer") and ${L.company}. It applies automatically to every Customer and covers the personal data we process for the Customer. A countersigned copy is available on request from ${L.privacyEmail}.`,
    lastUpdated: L.effectiveDate,
    sections: [
      {
        id: 'scope',
        title: '1. Scope, roles and definitions',
        items: [
          `The Customer is the <strong>controller</strong> (or, where it acts for another controller, a processor), and ${L.company} ("<strong>Processor</strong>") is the <strong>processor</strong> (or sub-processor) of the personal data described in Annex I ("<strong>Customer Personal Data</strong>").`,
          '"<strong>Data Protection Law</strong>" means all data-protection laws that apply to the processing, including, as applicable: the EU GDPR and UK GDPR; the Singapore Personal Data Protection Act 2012; the Lao Law on Electronic Data Protection (2017); the Thailand Personal Data Protection Act B.E. 2562; the Vietnam Law on Personal Data Protection No. 91/2025/QH15 and Decree 356/2025/ND-CP; the Australian Privacy Act 1988; the New Zealand Privacy Act 2020; and US state privacy laws such as the CCPA. Terms such as "personal data", "processing", "controller", "processor", "data subject" and "personal data breach" have the meanings given in the GDPR, or the equivalent terms in other Data Protection Law.',
          'For the CCPA and similar US laws, the Processor is a "service provider" or "processor". It will not sell or share Customer Personal Data, or retain, use or disclose it for any purpose other than providing the Service, or outside the direct business relationship with the Customer.',
        ],
      },
      {
        id: 'instructions',
        title: '2. Processing on instructions',
        items: [
          'The Processor processes Customer Personal Data only on the Customer\'s documented instructions, unless the law requires otherwise; in that case it will inform the Customer before processing unless the law prohibits it. The Terms, this DPA and the Customer\'s use and configuration of the Service are the Customer\'s complete instructions.',
          '<strong>Standing instruction on recipient choices.</strong> The Customer instructs the Processor to honour a Recipient\'s choice to make their own credential private or public, and to keep credentials the Customer has issued verifiable (read-only) after the Customer\'s account closes, as described in section 14 of the Terms, unless the Customer asks for them to be deleted.',
          'The Processor will tell the Customer if, in its opinion, an instruction infringes Data Protection Law.',
          'The Customer is responsible for the lawfulness of its instructions and of the Customer Personal Data, including having a lawful basis, giving Recipients the notices required by law (for example GDPR Articles 13 and 14, or New Zealand IPP 3A), and obtaining any parental or guardian consent needed for minors.',
        ],
      },
      {
        id: 'confidentiality',
        title: '3. Confidentiality',
        paragraphs: [
          'The Processor ensures that everyone it authorises to process Customer Personal Data is bound by confidentiality obligations, and has access only as far as needed to provide the Service.',
        ],
      },
      {
        id: 'security',
        title: '4. Security',
        paragraphs: [
          'The Processor implements and maintains the technical and organisational measures in Annex II, which are designed to ensure a level of security appropriate to the risk. It may update them, provided that the overall level of protection is not reduced.',
        ],
      },
      {
        id: 'subprocessors',
        title: '5. Sub-processors',
        items: [
          `The Customer gives general authorisation for the Processor to engage sub-processors. The current sub-processors are listed in Annex III and on the ${link('/subprocessors', 'sub-processors page')}.`,
          `The Processor will give at least <strong>${L.noticeDays} days' notice</strong>, by email to the account owner and on that page, before adding or replacing a sub-processor.`,
          `The Customer may object on reasonable data-protection grounds within that period by writing to ${mailto(L.privacyEmail)}. The parties will discuss the objection in good faith. If it is not resolved, the Customer may terminate the affected Service, and the Processor will refund prepaid fees for the unused period.`,
          'The Processor imposes on each sub-processor data-protection obligations that are substantially no less protective than this DPA, and remains responsible for their performance.',
        ],
      },
      {
        id: 'data-subject-requests',
        title: '6. Data subject requests',
        paragraphs: [
          'Taking into account the nature of the processing, the Processor will help the Customer by appropriate technical and organisational measures to respond to requests from data subjects to exercise their rights. If the Processor receives such a request directly, it will pass it to the Customer without undue delay and will not respond itself, except to confirm that the request relates to the Customer, or to act on a Recipient\'s visibility choice under section 2.',
        ],
      },
      {
        id: 'breach',
        title: '7. Personal data breaches',
        items: [
          `The Processor will notify the Customer without undue delay, and in any event <strong>within ${L.breachNoticeHours} hours</strong> after becoming aware of a personal data breach affecting Customer Personal Data.`,
          'The notice will describe, as far as then known: the nature of the breach, the categories and approximate number of data subjects and records concerned, the likely consequences, and the measures taken or proposed. The Processor will add information as it becomes available.',
          'The Processor will take reasonable steps to contain and remediate the breach, and will help the Customer meet its own obligations to notify regulators and data subjects. Notifying regulators and data subjects is the Customer\'s responsibility as controller, unless the law requires the Processor to do it.',
          'Notice of a breach is not an admission of fault or liability.',
        ],
      },
      {
        id: 'assistance',
        title: '8. Impact assessments and consultation',
        paragraphs: [
          'The Processor will give the Customer reasonable information and help, at the Customer\'s reasonable cost where the effort is significant, with data protection impact assessments, transfer impact assessments, and prior consultations with regulators that relate to the Service.',
        ],
      },
      {
        id: 'deletion',
        title: '9. Return and deletion',
        items: [
          'During the term, the Customer can export Customer Personal Data through the Service or by request.',
          'Within 30 days after termination, the Processor will delete Customer Personal Data, except (a) credentials the Customer has not asked to delete, which remain verifiable under section 14 of the Terms; (b) data the law requires the Processor to retain; and (c) copies in encrypted backups, which are deleted when the backups rotate out within ' + L.backupRetentionDays + ' days and are not used in the meantime.',
          'On request, the Processor will confirm deletion in writing.',
        ],
      },
      {
        id: 'audit',
        title: '10. Information and audits',
        items: [
          'The Processor will make available the information reasonably necessary to demonstrate compliance with this DPA, including written answers to reasonable security questionnaires and any third-party audit reports or certifications it holds.',
          'If that information is not enough to demonstrate compliance, or a regulator requires it, the Customer may carry out an audit, itself or through an independent auditor bound by confidentiality, no more than once in any 12 months (unless following a breach), on at least 30 days\' written notice, during business hours, and in a way that does not disrupt the Service or compromise other customers\' data. Each party bears its own costs.',
        ],
      },
      {
        id: 'transfers',
        title: '11. International transfers',
        items: [
          'Customer Personal Data is stored in Singapore and may be processed in other countries where the Processor and its sub-processors operate (see Annex III).',
          '<strong>EU:</strong> where Customer Personal Data subject to the EU GDPR is transferred to a country without an adequacy decision, the Standard Contractual Clauses approved by Commission Implementing Decision (EU) 2021/914 are incorporated into this DPA by reference: Module 2 (controller to processor) where the Customer is a controller, and Module 3 (processor to processor) where the Customer is a processor. For them: clause 7 (docking) applies; clause 9 option 2 (general authorisation, with the notice period in section 5 of this DPA) applies; the option in clause 11 does not apply; clauses 17 and 18 are governed by, and disputes decided by the courts of, Ireland; and Annexes I to III of this DPA complete the Appendix.',
          '<strong>UK:</strong> for transfers subject to the UK GDPR, the International Data Transfer Addendum issued by the UK Information Commissioner (version B1.0) is incorporated, completed with the information in this DPA. Either party may end it as set out in its section 19.',
          '<strong>Switzerland:</strong> the Standard Contractual Clauses apply with the adjustments needed for the Swiss Federal Act on Data Protection.',
          '<strong>Other countries:</strong> for transfers subject to the laws of Singapore, Thailand, Vietnam, Laos, Australia or New Zealand, the Processor provides the protections of this DPA, which the parties agree offer a standard comparable to those laws, and will cooperate with any transfer impact assessment, dossier or filing those laws require (for example under Vietnam\'s Decree 356/2025/ND-CP).',
          'If the Standard Contractual Clauses conflict with this DPA, the Standard Contractual Clauses prevail.',
        ],
      },
      {
        id: 'liability',
        title: '12. Liability and general terms',
        items: [
          'Each party\'s liability under this DPA is subject to the exclusions and limits in the Terms, except where Data Protection Law or the Standard Contractual Clauses do not allow it.',
          'This DPA lasts as long as the Processor processes Customer Personal Data. It is governed by the law and dispute terms of the Terms, except where the Standard Contractual Clauses require otherwise.',
          'If this DPA conflicts with the Terms, this DPA prevails for matters about personal data.',
        ],
      },
      {
        id: 'annex-1',
        title: 'Annex I: Description of the processing',
        items: [
          `<strong>Parties:</strong> Data exporter: the Customer (controller or processor), whose contact details are its account details. Data importer: ${L.company}, ${L.address}, contact ${mailto(L.privacyEmail)} (processor).`,
          '<strong>Data subjects:</strong> Recipients of credentials; the Customer\'s staff and authorised users; people named in evidence the Customer uploads.',
          '<strong>Categories of personal data:</strong> name; email address; credential content (achievement, criteria, issue and expiry dates, description, evidence, revocation status and reason); whether a credential was issued to a minor; visibility settings; account and log data for the Customer\'s users.',
          '<strong>Sensitive data:</strong> none intended. The Customer must not include special-category data unless it is necessary and lawful.',
          '<strong>Frequency:</strong> continuous.',
          '<strong>Nature and purpose of processing:</strong> hosting, storing, signing, emailing, displaying and verifying digital credentials, and related support, security and billing administration, to provide the Service.',
          '<strong>Duration:</strong> the term of the Terms, plus the post-termination periods in section 9 of this DPA and section 14 of the Terms.',
          '<strong>Competent supervisory authority (EU):</strong> the authority of the Member State where the Customer is established or, if none, where its representative is established.',
        ],
      },
      {
        id: 'annex-2',
        title: 'Annex II: Technical and organisational security measures',
        items: [
          '<strong>Encryption:</strong> TLS for all traffic; encrypted database connections; encrypted off-site backups; issuer signing keys encrypted at rest.',
          '<strong>Integrity:</strong> every credential is digitally signed (Ed25519), so any alteration is detectable, with revocation status lists.',
          '<strong>Access control:</strong> every request is scoped to the user\'s own organisation; staff access follows least privilege; administrator access is limited to named personnel.',
          '<strong>Authentication:</strong> passwords stored only as salted one-way hashes; sessions in HttpOnly, Secure cookies; email confirmation before an account can sign in.',
          '<strong>Public exposure minimised:</strong> public verification responses contain only whitelisted fields, never recipient contact details; credential identifiers are random and unguessable; verification pages are not indexed by search engines; private and minor credentials disclose no recipient details.',
          `<strong>Availability and resilience:</strong> managed, redundant hosting; daily backups kept for 35 days and monthly backups for ${L.backupRetentionDays} days, stored in a separate, access-restricted bucket with deletion lock.`,
          '<strong>Monitoring:</strong> audit logs of security-relevant actions; server logs retained for up to 90 days.',
          '<strong>Development:</strong> code review and automated tests, including tests that check tenant isolation and what public endpoints disclose; dependencies kept up to date.',
          '<strong>Incident response:</strong> a documented breach-response process and the notification commitments in section 7.',
          '<strong>Sub-processors:</strong> chosen for their security practices and bound by data-protection terms.',
        ],
      },
      {
        id: 'annex-3',
        title: 'Annex III: Sub-processors',
        paragraphs: [
          `The current list, with each sub-processor's purpose and location, is published on the ${link('/subprocessors', 'sub-processors page')}, which forms part of this Annex.`,
        ],
      },
    ],
  }

  return {
    dpaContent: readonly(dpaContent),
  }
}
