/** "1 Oct 2026" or "1 Oct 2026 – 2 Oct 2026" for an event's dates (date only, viewer's time zone). */
export function formatEventDates(start: string | null | undefined, end: string | null | undefined, locale?: string): string {
  const fmt = (v: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v))
  const from = start ? fmt(start) : ''
  const to = end ? fmt(end) : ''
  if (from && to && from !== to) {
    return `${from} – ${to}`
  }
  return from || to
}
