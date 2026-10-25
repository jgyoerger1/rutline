// Rutline Pro: Stripe webhook that turns a paid Checkout into a season pass.
//
// Stripe calls this after a Payment Link checkout completes. It verifies the
// signature, finds the account (the Payment Link carries the user id as
// client_reference_id; the buyer's email is the fallback) and writes
// entitlements.pro_until = 12 months from now (or from the current end date
// when they renew early). Only the service role can write that table.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// Stripe:  Developers -> Webhooks -> add endpoint
//          https://<project>.supabase.co/functions/v1/stripe-webhook
//          event: checkout.session.completed

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const PASS_DAYS = 365

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secretKey || !whSecret || !supabaseUrl || !serviceKey) return new Response('Server not configured', { status: 503 })

  const stripe = new Stripe(secretKey)
  const sig = req.headers.get('stripe-signature') ?? ''
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret)
  } catch (e) {
    return new Response(`Bad signature: ${e instanceof Error ? e.message : e}`, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') return json({ ignored: event.type })
  const session = event.data.object as Stripe.Checkout.Session
  if (session.payment_status !== 'paid') return json({ ignored: 'unpaid' })

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Who bought it: the account id the app put on the link, else the buyer's email
  let userId = session.client_reference_id ?? null
  const email = session.customer_details?.email?.toLowerCase() ?? null
  if (!userId && email) {
    const { data } = await db.from('profiles').select('id').ilike('email', email).maybeSingle()
    userId = (data as { id?: string } | null)?.id ?? null
  }
  if (!userId) {
    console.error('No account for session', session.id, email)
    return json({ error: 'no account matched; grant by hand' }, 202)
  }

  // Idempotent: the same session never adds a second year
  const { data: existing } = await db.from('entitlements').select('pro_until, last_session').eq('user_id', userId).maybeSingle()
  const cur = existing as { pro_until?: string | null; last_session?: string | null } | null
  if (cur?.last_session === session.id) return json({ ok: true, repeat: true })
  const base = Math.max(Date.now(), cur?.pro_until ? Date.parse(cur.pro_until) : 0)
  const proUntil = new Date(base + PASS_DAYS * 86400e3).toISOString()

  const { error } = await db.from('entitlements').upsert({ user_id: userId, pro_until: proUntil, source: 'stripe', last_session: session.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    console.error(error)
    return new Response(error.message, { status: 500 })
  }
  return json({ ok: true, userId, proUntil })
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
