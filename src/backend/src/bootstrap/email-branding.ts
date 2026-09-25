/**
 * Puts the Certrust logo at the top of every outgoing email.
 *
 * Every send - credential issuance/expiration, billing, trust reports and
 * the users-permissions confirmation/reset emails - ends up in the email
 * plugin's provider.send (email.send and sendTemplatedEmail both call it),
 * so wrapping that one function brands them all, including templates that
 * live in the DB-backed plugin store and can't be edited in code.
 *
 * The logo is attached inline (cid:certrust-logo) rather than linked, so it
 * shows without "load remote images" and works against a local mail sink.
 * Text-only messages get a minimal HTML part so they can carry it too.
 */

import { CERTRUST_LOGO_PNG_BASE64 } from './email-logo-data'

const LOGO_CID = 'certrust-logo'

const LOGO_HTML = `<div style="text-align:center;padding:20px 0 8px 0;"><img src="cid:${LOGO_CID}" alt="Certrust" width="160" style="display:inline-block;border:0;height:auto;max-width:160px;"></div>`

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Escapes plain text, links bare URLs and keeps paragraph/line breaks. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) =>
      `<p style="margin:0 0 14px 0;">${escapeHtml(para.trim())
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
        .replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

export function brandHtml(html: string): string {
  if (html.includes(`cid:${LOGO_CID}`)) return html
  const body = html.match(/<body[^>]*>/i)
  return body ? html.replace(body[0], `${body[0]}${LOGO_HTML}`) : `${LOGO_HTML}${html}`
}

export function brandMessage(message: Record<string, any>): Record<string, any> {
  const html = message.html
    ? String(message.html)
    : message.text
      ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a202c;max-width:560px;margin:0 auto;padding:0 16px 24px 16px;">${textToHtml(String(message.text))}</div>`
      : ''
  if (!html) return message

  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  return {
    ...message,
    html: brandHtml(html),
    attachments: attachments.some((a: any) => a?.cid === LOGO_CID)
      ? attachments
      : [
          ...attachments,
          {
            filename: 'certrust-logo.png',
            content: Buffer.from(CERTRUST_LOGO_PNG_BASE64, 'base64'),
            contentType: 'image/png',
            cid: LOGO_CID,
            contentDisposition: 'inline',
          },
        ],
  }
}

export function setupEmailBranding(strapi: any): void {
  const provider = strapi.plugin('email')?.provider
  if (!provider || typeof provider.send !== 'function' || provider.__certrustBranded) {
    strapi.log.warn('[EmailBranding] Email provider not available (or already wrapped), skipping.')
    return
  }
  const send = provider.send.bind(provider)
  provider.send = (options: any) => send(brandMessage(options))
  provider.__certrustBranded = true
  strapi.log.info('[EmailBranding] Certrust logo will be added to all outgoing emails.')
}
