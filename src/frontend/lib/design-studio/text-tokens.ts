/**
 * Placeholders are stored as `{{recipient.name}}` but shown and typed as
 * `[recipient.name]` - the bracket form issuers know from other tools.
 */
const KEY = '[a-z][\\w.-]*'

export function toEditable(content: string): string {
  return content.replace(new RegExp(`\\{\\{\\s*(${KEY})\\s*\\}\\}`, 'gi'), (_, k) => `[${k}]`)
}

/** `[recipient.name]` -> `{{recipient.name}}` for known namespaces only, so ordinary brackets survive. */
export function fromEditable(text: string): string {
  return text.replace(new RegExp(`\\[(${KEY})\\]`, 'gi'), (m, k: string) =>
    /^(?:recipient|credential|issuer|achievement|custom)\./.test(k) ? `{{${k}}}` : m)
}
