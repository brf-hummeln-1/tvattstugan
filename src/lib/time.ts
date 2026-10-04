// All tid i appen räknas i Europe/Stockholm, oavsett telefonens inställning.

export const TZ = 'Europe/Stockholm'

export const SLOTS = [
  { slot: 1, label: '10–13', startHour: 10, endHour: 13 },
  { slot: 2, label: '13–16', startHour: 13, endHour: 16 },
  { slot: 3, label: '16–19', startHour: 16, endHour: 19 },
  { slot: 4, label: '19–22', startHour: 19, endHour: 22 },
] as const

export type SlotNumber = 1 | 2 | 3 | 4

export function slotLabel(slot: number): string {
  return SLOTS.find((s) => s.slot === slot)?.label ?? `Pass ${slot}`
}

const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const partsFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Dagens datum i Stockholm som YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return dateFmt.format(now)
}

/** Klockslag i Stockholm som minuter sedan midnatt, plus datumet. */
export function stockholmNow(now = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(partsFmt.formatToParts(now).map((p) => [p.type, p.value]))
  const hour = Number(parts.hour) % 24
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  }
}

/** Lägg till dagar på ett YYYY-MM-DD-datum (kalenderdagar, ingen tidszon inblandad). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** Samma datum en månad fram, klämt till månadens sista dag (som Postgres). */
export function addOneMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const t = new Date(Date.UTC(y, m, Math.min(d, lastDay)))
  return t.toISOString().slice(0, 10)
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number)
  const [y2, m2, d2] = toISO.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Har passet slutat (i Stockholmstid)? */
export function slotHasEnded(date: string, slot: number, now = new Date()): boolean {
  const cur = stockholmNow(now)
  if (date < cur.date) return true
  if (date > cur.date) return false
  const def = SLOTS.find((s) => s.slot === slot)
  return !!def && cur.minutes >= def.endHour * 60
}

/** Pågår passet just nu? */
export function slotIsOngoing(date: string, slot: number, now = new Date()): boolean {
  const cur = stockholmNow(now)
  if (date !== cur.date) return false
  const def = SLOTS.find((s) => s.slot === slot)
  return !!def && cur.minutes >= def.startHour * 60 && cur.minutes < def.endHour * 60
}

const weekdayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', weekday: 'long' })
const longFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', day: 'numeric', month: 'long' })

/** "måndag 6 oktober" – datumet tolkas som kalenderdag. */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const weekday = weekdayFmt.format(t)
  return `${weekday} ${longFmt.format(t)}`
}

/** "Idag", "Imorgon" eller veckodag + datum. */
export function formatDayHeading(iso: string, now = new Date()): string {
  const today = todayISO(now)
  if (iso === today) return 'Idag'
  if (iso === addDays(today, 1)) return 'Imorgon'
  const s = formatDateLong(iso)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const timeFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const dateTimeFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export function formatTime(ts: string): string {
  return timeFmt.format(new Date(ts))
}

export function formatDateTime(ts: string): string {
  return dateTimeFmt.format(new Date(ts))
}
