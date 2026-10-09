/**
 * Turning a county's owner-of-record string into something a hunter can
 * search for. Assessor rolls write people LAST FIRST MI, join co-owners with
 * "&", and mix in trusts, farms, LLCs and public bodies. Nothing here calls a
 * people-search service: we build ordinary web searches the hunter opens
 * themselves, by name and by the tax mailing address.
 */

export type OwnerKind = 'person' | 'trust' | 'business' | 'public'

export interface OwnerRead {
  kind: OwnerKind
  /** "John Smith" for people and trusts; the entity name otherwise */
  searchName: string
  /** The second person on the deed, if any, in the same form */
  coOwner: string | null
}

const PUBLIC = /\b(CITY OF|VILLAGE OF|TOWN OF|TOWNSHIP|TWP|COUNTY|STATE OF|UNITED STATES|U ?S ?A|U ?S OF A|DEPARTMENT|DEPT|DNR|ODNR|BOARD OF|SCHOOL|DISTRICT|METRO ?PARKS?|PARKS?|COMMISSION|AUTHORITY|CONSERVANCY|UNIVERSITY|COLLEGE|LAND BANK|FOREST SERVICE|ARMY CORPS|WILDLIFE)\b/
const BUSINESS = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|CO|LP|LLP|LTD|PARTNERS|PARTNERSHIP|FARMS?|LAND|LANDS|PROPERTIES|PROPERTY|HOLDINGS?|INVESTMENTS?|ENTERPRISES?|ASSOC(IATION)?|CHURCH|BANK|CLUB|DEVELOPMENT|REALTY|GROUP|VENTURES?|RANCH|ACRES|TIMBER|LUMBER|RAILROAD|RAILWAY|UTILIT(Y|IES)|ELECTRIC|ENERGY|MINISTRIES|CEMETERY|HOMEOWNERS|HOA|CONDOMINIUM)\b/
const TRUST = /\b(TRUST|TRUSTEE|TRUSTEES|TR|TTEE|TTEES|REVOCABLE|IRREVOCABLE|LIVING|FAMILY TRUST)\b/
const TRUST_ALL = new RegExp(TRUST.source, 'g')
const NOISE = /\b(ET ?AL|ET ?UX|ET ?VIR|JTWROS|JT ?TEN|JTRS|TENANTS IN COMMON|TIC|LIFE ESTATE|L\/E|LE|SURV|SURVIVORSHIP|UND(IVIDED)? ?\d*\/?\d*|INT(EREST)?|AS TRUSTEE|TRUSTEE OF|TRUSTEES OF|DTD|DATED|U\/A|UAD|UTD)\b/g
const SUFFIX = /^(JR|SR|II|III|IV)$/

export function readOwner(raw: string): OwnerRead {
  const up = raw.toUpperCase().replace(/\s+/g, ' ').trim()
  if (PUBLIC.test(up)) return { kind: 'public', searchName: titleCase(up), coOwner: null }
  const isTrust = TRUST.test(up)
  if (BUSINESS.test(up) && !isTrust) return { kind: 'business', searchName: titleCase(up), coOwner: null }

  const people = up
    .replace(NOISE, ' ')
    .split(/\s*(?:&|\bAND\b|;|\/|\+)\s*/)
    .map((s) => s.replace(/\b(THE|OF)\b/g, ' ').replace(TRUST_ALL, ' ').replace(/\d+/g, ' ').replace(/[^A-Z,' -]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 1)
  if (!people.length) return { kind: isTrust ? 'trust' : 'business', searchName: titleCase(up), coOwner: null }

  const first = toFirstLast(people[0])
  const surname = first.split(' ').slice(-1)[0]
  let second: string | null = null
  if (people[1]) {
    const t = people[1].split(' ').filter((x) => !SUFFIX.test(x))
    // "SMITH JOHN A & MARY B": a given name (and initial) that inherits the surname
    const givenOnly = !people[1].includes(',') && (t.length === 1 || (t.length === 2 && t[1].length === 1))
    second = givenOnly ? titleCase(`${t[0]} ${surname}`) : toFirstLast(people[1])
  }
  return { kind: isTrust ? 'trust' : 'person', searchName: first, coOwner: second }
}

/** Assessor order is usually LAST FIRST MI; a comma or a middle initial in second place says otherwise. */
function toFirstLast(s: string): string {
  if (s.includes(',')) {
    const [last, rest] = s.split(',', 2).map((x) => x.trim())
    const given = rest.split(' ').filter((t) => t.length > 1 && !SUFFIX.test(t))
    return titleCase([given[0], last].filter(Boolean).join(' '))
  }
  const t = s.split(' ').filter((x) => !SUFFIX.test(x))
  if (t.length === 1) return titleCase(t[0])
  // "JOHN A SMITH": initial in the middle, so it is already first-last
  if (t.length >= 3 && t[1].length === 1) return titleCase(`${t[0]} ${t[t.length - 1]}`)
  // "SMITH JOHN A" or "SMITH JOHN"
  return titleCase(`${t[1]} ${t[0]}`)
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)/g, (_m, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(Llc|Lp|Llp|Ltd|Usa|Dnr|Hoa|Cwd)\b/g, (m) => m.toUpperCase())
    .replace(/(?<=.)\b(Of|And|The)\b/g, (m) => m.toLowerCase())
    .replace(/\bMc([a-z])/g, (_m, c: string) => 'Mc' + c.toUpperCase())
}

export interface MailParts {
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

/** "123 MAIN ST, KENT, OH 44240" or "123 MAIN ST, KENT OH, 44240" or "123 MAIN ST KENT OH 44240" */
export function readMailing(addr: string | null | undefined): MailParts {
  const none = { street: null, city: null, state: null, zip: null }
  if (!addr) return none
  const s = addr.replace(/\s+/g, ' ').trim()
  if (!s.includes(',')) {
    // "123 MAIN ST KENT OH 44240": no commas, so the word before the state is taken as the city
    const t = /^(.*)\s+([A-Za-z.'-]+)\s+([A-Za-z]{2})\s*(\d{5})?(?:-\d{4})?$/.exec(s)
    return t ? { street: t[1] || null, city: titleCase(t[2]), state: t[3].toUpperCase(), zip: t[4] ?? null } : { ...none, street: s }
  }
  const m = /^(.*?),?\s*([A-Za-z][A-Za-z .'-]*?),?\s+([A-Za-z]{2})\.?,?\s*(\d{5})?(?:-\d{4})?$/.exec(s)
  if (!m) return { ...none, street: s }
  const street = m[1].trim()
  const city = m[2].trim()
  return { street: street || null, city: titleCase(city), state: m[3].toUpperCase(), zip: m[4] ?? null }
}

export interface Lookup {
  label: string
  hint: string
  url: string
}

const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`

/** Ordinary web searches the hunter opens in a new tab. */
export function phoneLookups(owner: OwnerRead, mail: MailParts, fallbackState: string): Lookup[] {
  const place = [mail.city, mail.state ?? fallbackState].filter(Boolean).join(' ')
  const out: Lookup[] = []
  if (owner.kind === 'person' || owner.kind === 'trust') {
    out.push({ label: 'Search by name', hint: `"${owner.searchName}" ${place}`, url: g(`"${owner.searchName}" ${place} phone`) })
    if (mail.street) out.push({ label: 'Search by mailing address', hint: `${titleCase(mail.street)}, ${place}`, url: g(`"${titleCase(mail.street)}" ${place} phone`) })
    out.push({
      label: 'People-search listings',
      hint: 'TruePeopleSearch, FastPeopleSearch, Whitepages',
      url: g(`"${owner.searchName}" ${place} (site:truepeoplesearch.com OR site:fastpeoplesearch.com OR site:whitepages.com)`),
    })
    if (owner.coOwner) out.push({ label: 'Search the co-owner', hint: owner.coOwner, url: g(`"${owner.coOwner}" ${place} phone`) })
  } else if (owner.kind === 'business') {
    const st = mail.state ?? fallbackState
    out.push({ label: 'Search the business', hint: owner.searchName, url: g(`"${owner.searchName}" ${place} phone`) })
    out.push({ label: 'Who is behind it', hint: `${st} business filing and registered agent`, url: g(`"${owner.searchName}" ${st} secretary of state business search registered agent`) })
    if (mail.street) out.push({ label: 'Search by mailing address', hint: `${titleCase(mail.street)}, ${place}`, url: g(`"${titleCase(mail.street)}" ${place}`) })
  } else {
    out.push({ label: 'Hunting on this land', hint: owner.searchName, url: g(`"${owner.searchName}" hunting permit access rules`) })
  }
  return out
}

/** A short first text. Long letters go by mail; this is for a number the hunter already found. */
export function firstText(hunterName: string, where: string): string {
  const me = hunterName.trim() || 'a local hunter'
  return `Hi, this is ${me}. I'm a local deer hunter and I'd like to ask permission to hunt your land${where ? ` ${where}` : ''}. I'm careful, I'll follow any rules you set, and I'm glad to share venison. Would you be open to a quick call? Thank you either way.`
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** iOS wants "&body", Android "?body"; "?&body" works on both. */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`
}

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : raw.trim()
}
