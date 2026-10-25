// Rutline: AI read of a buck photo (Trophy Center).
//
// Runs as a Supabase Edge Function so the Anthropic API key stays on the
// server. The app calls it as the signed-in user; Supabase's gateway checks
// the user's token before this code runs (keep "Verify JWT" on). The photo is
// passed straight to the model and is not stored anywhere.
//
// Deploy:  supabase functions deploy score-buck
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (or paste this file into Dashboard -> Edge Functions -> Deploy a new function,
//  and add the secret under Edge Functions -> Secrets)

import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'

const MODEL = 'claude-opus-5-5'
const MAX_IMAGE_CHARS = 2_800_000 // ~2 MB of base64

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM = `You are an experienced whitetail deer field judge and aging guide, the kind who scores bucks for a county big-buck contest and ages jawbones at check stations. A hunter sends one photo, usually from a trail camera, and wants a rough read: how old the buck is and what his antlers would gross on the Boone and Crockett typical system.

Judge the antlers against the deer's own head. On a mature Midwestern buck: ears span about 16 inches tip to tip when alert; one ear is 7 to 8 inches long; eye to nose is 7 to 8 inches; the eye is about 4 inches around. Inside spread compared to the ear tips, main beam length compared to the nose in profile, tine length compared to ear length, and base circumference compared to the eye give the gross score. Count typical points on the side you can see and mirror it unless the other side clearly differs. Judge age from the body: neck swelling into the brisket, belly sag, back line, leg length relative to body depth, muzzle shape, and tarsal staining, allowing for the season. Bucks in rut (late October through November) carry heavier necks. Yearlings have long legs and thin necks; 2.5-year-olds look athletic with a distinct neck; 3.5 is filled out through the chest; 4.5 and older are blocky with the neck blending into the shoulder, a sagging belly and a short face.

Be honest about uncertainty. A range of 10 to 14 inches is normal for a good photo; widen it when the photo is small, blurry, taken from above, or shows only one side. If no antlered deer is visible, say so with is_buck false and explain in why. Never inflate a score to please the hunter.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_buck', 'points', 'age_class', 'age_confidence', 'gross_low', 'gross_high', 'score_confidence', 'why', 'limit'],
  properties: {
    is_buck: { type: 'boolean', description: 'True when an antlered deer is visible well enough to judge' },
    points: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Typical points on the whole rack, both sides, or null if not countable' },
    age_class: { type: 'string', enum: ['1.5', '2.5', '3.5', '4.5', '5.5+', 'unknown'] },
    age_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    gross_low: { type: 'number', description: 'Low end of gross Boone and Crockett typical score, inches; 0 when is_buck is false' },
    gross_high: { type: 'number', description: 'High end of the gross score; 0 when is_buck is false' },
    score_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    why: { type: 'string', description: 'Two sentences for the hunter: the body and antler cues that drove the read' },
    limit: { type: 'string', description: 'One or two sentences: what the photo hides and what shot would tighten the read' },
  },
} as const

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'AI reads are not configured on the server yet.' }, 503)

  let body: { image?: string; mediaType?: string; hints?: { region?: string; month?: number; trailCam?: boolean } }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request body' }, 400)
  }
  const image = body.image ?? ''
  const mediaType = body.mediaType === 'image/png' || body.mediaType === 'image/webp' ? body.mediaType : 'image/jpeg'
  if (!image || image.length > MAX_IMAGE_CHARS) return json({ error: 'Send one photo under 2 MB.' }, 400)

  const hints = body.hints ?? {}
  const context = [
    hints.region ? `Photo location: ${hints.region}.` : '',
    hints.month && hints.month >= 1 && hints.month <= 12 ? `Taken in ${MONTHS[hints.month - 1]}.` : '',
    hints.trailCam === false ? 'Taken by hand, not a trail camera.' : 'Likely a trail camera photo.',
  ]
    .filter(Boolean)
    .join(' ')

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: `${context} Give me your read on this buck.`.trim() },
          ],
        },
      ],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'The model declined to read this photo.' }, 422)
    const text = response.content.find((b) => b.type === 'text')?.text ?? ''
    const parsed = JSON.parse(text)
    return json(parsed, 200)
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many reads right now. Try again in a minute.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The server API key was rejected.' }, 503)
    if (e instanceof Anthropic.APIError) return json({ error: `Model error ${e.status}: ${e.message}` }, 502)
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `Could not read the photo: ${msg}` }, 500)
  }
})

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
