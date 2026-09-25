import { generateCredentialIssuanceEmail } from '../../templates/credential-issuance'
import { generateCredentialExpirationEmail } from '../../templates/credential-expiration'
import { parseMailbox } from '../../../../bootstrap/email-sender-setup'
import type { ExpirationWarningPayload, NotificationPayload, NotificationProvider } from './types'

/**
 * Default notification provider: sends via Strapi's own email plugin
 * (nodemailer under the hood, see config/plugins.ts), using the existing
 * credential-issuance email template. This is exactly what credential.ts
 * did inline before this provider existed - no behavior change.
 */
/**
 * "<Issuer> via Certrust" <configured sender address>: recipients recognise
 * the organisation that taught them, not an unfamiliar platform name. The
 * address itself stays the onboarded one from SMTP_FROM.
 */
function senderFor(strapi: any, issuerName?: string): string | undefined {
  const issuer = issuerName?.trim().replace(/["<>\r\n]/g, '')
  const mailbox = parseMailbox(strapi.config?.get?.('plugin::email.settings.defaultFrom'))
  if (!issuer || !mailbox) return undefined
  return `"${issuer} via Certrust" <${mailbox.email}>`
}

export function createStrapiEmailProvider(strapi: any): NotificationProvider {
  return {
    async sendCredentialIssued({ to, achievement, credential, frontendUrl, user, issuerName, supportEmail }: NotificationPayload) {
      const emailTemplate = generateCredentialIssuanceEmail({ achievement, credential, frontendUrl, user, issuerName, supportEmail, privacyEmail: strapi.config?.get?.('custom.privacyEmail', '') })
      const from = senderFor(strapi, issuerName)

      await strapi.plugins['email'].services.email.send({
        to,
        ...(from ? { from } : {}),
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      })
    },

    async sendExpirationWarning({ to, achievement, credential, frontendUrl, user, daysLeft, expirationDate, issuerName, supportEmail }: ExpirationWarningPayload) {
      const emailTemplate = generateCredentialExpirationEmail({ achievement, credential, frontendUrl, user, daysLeft, expirationDate, issuerName, supportEmail })

      await strapi.plugins['email'].services.email.send({
        to,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      })
    },
  }
}
