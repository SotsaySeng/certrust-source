// src/backend/src/api/credential/templates/credential-issuance.ts

interface Achievement {
  name: string
  description?: string
}

interface Credential {
  credentialId: string
}

interface User {
  username: string
  email: string
}

interface TemplateParams {
  achievement: Achievement
  credential: Credential
  frontendUrl: string
  user: User | null
  issuerName?: string
  supportEmail?: string
  privacyEmail?: string
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const generateCredentialIssuanceEmail = ({ achievement, credential, frontendUrl, user, issuerName, supportEmail, privacyEmail }: TemplateParams) => {
  const issuer = issuerName?.trim() || 'Certrust'
  const credentialUrl = `${frontendUrl}/credentials/${credential.credentialId}`
  const description = achievement.description?.trim()

  // Collection notice for data the issuer gave us about the recipient (NZ
  // Privacy Act IPP 3A, GDPR Art. 14 and equivalents): who collected it
  // and why, who holds it and where, and how to see or correct it. The
  // issuer is responsible for giving it (Terms s.6); this covers the basics.
  // Plain text on purpose: one link per email keeps it out of spam folders.
  const privacyContact = privacyEmail || supportEmail
  const privacyNotice = `About your data: ${issuer} gave Certrust your name and email address to issue this credential. Certrust stores them on ${issuer}'s behalf (database in Singapore, served worldwide by Cloudflare). To see or correct your details, contact ${issuer}${privacyContact ? ` or ${privacyContact}` : ''}. You can make this credential private from its page. Privacy Policy: ${frontendUrl}/privacy-policy`

  // Deliberately plain: one call to action, no remote images, and no
  // "account created / username / set your password" block - that pattern
  // is what phishing mail looks like, and it sent the first real sends from
  // a brand-new domain straight to Gmail's spam folder. Downloading, sharing
  // and "Add to LinkedIn" all live on the credential page itself.
  const subject = `Your certificate from ${issuer}: ${achievement.name}`

  const text = `${issuer} has issued you the credential "${achievement.name}".
${description ? `\n${description}\n` : ''}
View your credential: ${credentialUrl}

From that page you can download it, share it, or add it to your LinkedIn profile. Anyone you share it with can check that it is genuine.
${user ? `
You can see all your credentials in one place by signing in at ${frontendUrl}/login with this email address. The first time, choose "Forgot password" to set a password.
` : ''}${supportEmail ? `
Questions? Reply to this email or write to ${supportEmail}.
` : ''}
You received this email because ${issuer} issued you a credential using Certrust.

${privacyNotice}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 560px; background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="padding: 32px 32px 8px 32px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #718096;">${escapeHtml(issuer)}</p>
              <h1 style="margin: 0; font-size: 22px; line-height: 1.3; color: #1a202c;">${escapeHtml(achievement.name)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; color: #4a5568; font-size: 15px; line-height: 1.6;">
              <p style="margin: 0 0 12px 0;"><strong>${escapeHtml(issuer)}</strong> has issued you this credential.</p>
              ${description ? `<p style="margin: 0 0 12px 0;">${escapeHtml(description)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 32px 24px 32px;">
              <a href="${credentialUrl}" style="display: inline-block; padding: 12px 28px; background-color: #28A745; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px;">View your credential</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 24px 32px; color: #4a5568; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 12px 0;">From that page you can download it, share it, or add it to your LinkedIn profile. Anyone you share it with can check that it is genuine.</p>
              ${user ? `<p style="margin: 0 0 12px 0;">You can see all your credentials in one place by signing in at certrust.app with this email address. The first time, choose &ldquo;Forgot password&rdquo; to set a password.</p>` : ''}
              ${supportEmail ? `<p style="margin: 0;">Questions? Reply to this email or write to ${escapeHtml(supportEmail)}.</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 28px 32px; border-top: 1px solid #edf2f7; font-size: 12px; line-height: 1.5; color: #a0aec0;">
              You received this email because ${escapeHtml(issuer)} issued you a credential using Certrust.
              <br><br>${escapeHtml(privacyNotice)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
