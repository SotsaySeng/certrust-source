/**
 * Lightweight i18n composable — no @nuxtjs/i18n dependency needed.
 * Reads locale JSON files directly; locale is stored in a Nuxt state ref
 * (SSR-compatible) and persisted in the certrust_locale cookie.
 */

import de from '../locales/de.json'
// Statically import all locale files so they are bundled with no async load
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'
import pt from '../locales/pt.json'

type LocaleCode = 'en' | 'fr' | 'it' | 'es' | 'de' | 'pt'

const MESSAGES: Record<LocaleCode, Record<string, any>> = { en, fr, it, es, de, pt }

export const LOCALES = [
  { code: 'en' as LocaleCode, name: 'English' },
  { code: 'fr' as LocaleCode, name: 'Français' },
  { code: 'it' as LocaleCode, name: 'Italiano' },
  { code: 'es' as LocaleCode, name: 'Español' },
  { code: 'de' as LocaleCode, name: 'Deutsch' },
  { code: 'pt' as LocaleCode, name: 'Português' },
]

/** Resolve a dot-separated key path in a nested object */
function resolve(obj: Record<string, any>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') { return undefined }
    cur = cur[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

export function useI18n() {
  const localeCookie = useCookie<LocaleCode>('certrust_locale', { maxAge: 60 * 60 * 24 * 365 })
  // Pre-existing bug fixed here: setLocale() below already wrote the
  // choice to this cookie, but the locale state's own useState initializer
  // never read it back - so any real navigation/reload (SSR, not just an
  // in-session client-side route change) silently reset the language to
  // English regardless of what the user had picked, discovered live while
  // verifying locale-cycling on the dashboard. `locale.value` may already
  // equal the desired code from a previous request in this same
  // useState's shared context, so only fall back to the cookie/'en' when
  // it hasn't been set to a known locale yet.
  const locale = useState<LocaleCode>('locale', () => (
    localeCookie.value && localeCookie.value in MESSAGES ? localeCookie.value : 'en'
  ))

  /** Translate a dot-notation key, with optional `{param}` interpolation */
  function t(key: string, params?: Record<string, string>): string {
    const messages = MESSAGES[locale.value] ?? MESSAGES.en
    let value = resolve(messages, key) ?? resolve(MESSAGES.en, key) ?? key
    if (params) {
      value = value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`)
    }
    return value
  }

  function setLocale(code: LocaleCode | string) {
    const safe = (code in MESSAGES ? code : 'en') as LocaleCode
    locale.value = safe
    localeCookie.value = safe
  }

  return {
    t,
    locale: readonly(locale),
    locales: readonly(ref(LOCALES)),
    setLocale,
  }
}
