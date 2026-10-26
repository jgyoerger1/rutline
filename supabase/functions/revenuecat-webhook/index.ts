// Rutline Pro: RevenueCat webhook that mirrors an App Store purchase onto the account.
//
// RevenueCat calls this for every subscriber event. When the subscriber is a
// signed-in Rutline account (the app logs the Supabase user id in as the
// RevenueCat app user id), the 'pro' entitlement's end date is written to
// entitlements.pro_until, the same row the Stripe webhook writes, so the web
// app and every other phone on the account see Pro too. Purchases made while
// signed out stay on the phone until the hunter signs in.
//
// Deploy:  supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets: supabase secrets set REVENUECAT_WEBHOOK_AUTH=<a long random string>
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// RevenueCat: Project settings -> Integrations -> Webhooks -> add
//          https://<project>.supabase.co/functions/v1/revenuecat-webhook
//          with "Authorization header value" set to that same string.

import { createClient } from 'npm:@supabase/supabase-js@2'

const ENTITLEMENT = 'pro'
const PASS_DAYS = 365
/** Events that start or extend a pass */
const GRANTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT'])
/** Events that end one */
const ENDS = new Set(['EXPIRATION'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RcEvent {
  id: string
  type: string
  app_user_id: string
  original_app_user_id?: string
  aliases?: string[]
  entitlement_ids?: string[] | null
  product_id?: string
  purchased_at_ms?: number
  expiration_at_ms?: number | null
  environment?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!expected || !supabaseUrl || !serviceKey) return new Response('Server not configured', { status: 503 })
  if (req.headers.get('authorization') !== expected) return new Response('Unauthorized', { status: 401 })

  let ev: RcEvent | undefined
  try {
    ev = ((await req.json()) as { event?: RcEvent }).event
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }
  if (!ev?.type || !ev.id) return new Response('No event', { status: 400 })
  if (ev.type === 'TEST') return json({ ok: true, test: true })
  if (!GRANTS.has(ev.type) && !ENDS.has(ev.type)) return json({ ignored: ev.type })
  if (ev.entitlement_ids && !ev.entitlement_ids.includes(ENTITLEMENT)) return json({ ignored: 'other entitlement' })

  // Which accounts: app user ids that are Supabase user ids. Anonymous ids ($RCAnonymousID:...) have no account yet.
  const ids = [...new Set([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])].filter((s): s is string => !!s && UUID.test(s)))]
  if (!ids.length) return json({ ok: true, skipped: 'no account on this subscriber yet' })

  const ends = ENDS.has(ev.type)
  // An auto-renewable pass carries the store's end date; a non-renewing pass runs a year from purchase
  const until = ends ? (ev.expiration_at_ms ?? Date.now()) : (ev.expiration_at_ms ?? (ev.purchased_at_ms ?? Date.now()) + PASS_DAYS * 86400e3)
  const source = ev.environment === 'SANDBOX' ? 'app-store-sandbox' : 'app-store'
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const results: Record<string, string> = {}

  for (const userId of ids) {
    const { data } = await db.from('entitlements').select('pro_until, source, last_session').eq('user_id', userId).maybeSingle()
    const cur = data as { pro_until?: string | null; source?: string | null; last_session?: string | null } | null
    // Idempotent: RevenueCat retries, and the same event never writes twice
    if (cur?.last_session === ev.id) {
      results[userId] = 'repeat'
      continue
    }
    const curUntil = cur?.pro_until ? Date.parse(cur.pro_until) : 0
    let next: { until: number; source: string }
    if (ends) {
      // Only an App Store pass ends here; a Stripe or hand-granted pass keeps its own date
      if (cur?.source && !cur.source.startsWith('app-store')) {
        results[userId] = `kept ${cur.source}`
        continue
      }
      next = { until, source }
    } else {
      // Never shorten a pass bought elsewhere: the later end date wins
      next = until > curUntil ? { until, source } : { until: curUntil, source: cur?.source ?? source }
    }
    const { error } = await db.from('entitlements').upsert({ user_id: userId, pro_until: new Date(next.until).toISOString(), source: next.source, last_session: ev.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) console.error(userId, error)
    results[userId] = error ? `error ${error.message}` : new Date(next.until).toISOString()
  }
  return json({ ok: true, type: ev.type, results })
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
