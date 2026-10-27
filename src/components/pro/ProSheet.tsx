import { ArrowClockwise, ArrowSquareOut, Check, Lock } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { cloudConfigured } from '../../lib/cloud'
import { IAP_CONFIGURED, buy, getOffer, restore, type IapOffer } from '../../lib/iap'
import { isNative } from '../../lib/native'
import { PAYMENT_LINK, PRO_BENEFITS, PRO_PRICE, proUntilLabel, refreshPro, useProState, type ProFeature } from '../../lib/pro'
import { useApp } from '../AppContext'
import { Button, SectionLabel, Sheet } from '../ui'

/**
 * The one place Pro is explained and bought. Opened by any locked feature,
 * which is listed first. Buying happens on the web through a Stripe Payment
 * Link tied to the account, and in the iOS app through the App Store (lib/iap.ts).
 */
export default function ProSheet({ feature, onClose }: { feature: ProFeature | null; onClose: () => void }) {
  const { setView, toast } = useApp()
  const auth = useAuth()
  const pro = useProState()
  const [checking, setChecking] = useState(false)
  // The App Store's own price for the pass, loaded when this build sells in-app
  const [offer, setOffer] = useState<IapOffer | null | undefined>(IAP_CONFIGURED ? undefined : null)
  useEffect(() => {
    if (!IAP_CONFIGURED || feature === null || pro.pro) return
    let on = true
    getOffer()
      .then((o) => on && setOffer(o))
      .catch(() => on && setOffer(null))
    return () => {
      on = false
    }
  }, [feature, pro.pro])

  const ordered = feature && feature !== 'all' ? [...PRO_BENEFITS].sort((a, b) => (a.id === feature ? -1 : b.id === feature ? 1 : 0)) : PRO_BENEFITS

  async function check() {
    setChecking(true)
    const s = await refreshPro()
    setChecking(false)
    toast(s.pro ? `Pro is on until ${proUntilLabel(s.until)}` : 'No Pro on this account yet')
    if (s.pro) onClose()
  }

  const buyUrl = auth.user && PAYMENT_LINK ? `${PAYMENT_LINK}?client_reference_id=${encodeURIComponent(auth.user.id)}${auth.user.email ? `&prefilled_email=${encodeURIComponent(auth.user.email)}` : ''}` : null

  return (
    <Sheet open={feature !== null} onClose={onClose} title="Rutline Pro" scrollKey={feature}>
      <div className="space-y-6">
        {pro.pro ? (
          <div className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4">
            <SectionLabel>{pro.source === 'native-preview' ? 'Preview build' : pro.source === 'preview' ? 'Open while we test' : 'Your season pass'}</SectionLabel>
            <div className="mt-1 text-[15px] text-bone-50">{pro.until ? `Pro is on until ${proUntilLabel(pro.until)}.` : 'Everything is unlocked in this build.'}</div>
            <p className="mt-1 text-[12.5px] text-bone-400">{pro.source === 'native-preview' ? 'Pro will be sold through the App Store when Rutline ships there. Until then, the whole app is yours to test.' : pro.source === 'preview' ? 'Pro is open to everyone while Rutline is being tested. It becomes a season pass later; nothing you save goes away.' : pro.source?.startsWith('app-store') ? 'Bought through the App Store. Sign in and it follows your account to every phone; on a new iPhone, Restore purchases brings it back.' : 'Everything below is unlocked on this account, on every phone you sign in on.'}</p>
          </div>
        ) : (
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember-400">Season pass</div>
            <div className="mt-1 text-[26px] font-semibold tracking-tight leading-tight">
              {offer?.price ?? PRO_PRICE} <span className="text-[14px] font-normal text-bone-400">{offer?.renews ? 'a year' : 'for 12 months'}</span>
            </div>
            <p className="mt-1 text-[13px] text-bone-400 leading-relaxed">{offer?.renews ? 'Renews each year through your Apple ID unless you cancel; cancel any time and keep the rest of the year.' : 'One payment, no auto-renew.'} Buy it in August, hunt the whole season, decide again next year. The free app stays free.</p>
          </div>
        )}

        <ul className="divide-y divide-bone-50/8 border-y border-bone-50/8">
          {ordered.map((b) => {
            const lead = b.id === feature
            return (
              <li key={b.id} className="py-3 flex gap-3">
                <span className={`mt-0.5 shrink-0 w-6 h-6 rounded-md grid place-items-center ${pro.pro ? 'bg-ember-500/15 text-ember-400' : lead ? 'bg-ember-500 text-ember-950' : 'bg-pine-800 text-bone-500'}`}>{pro.pro ? <Check size={13} weight="bold" /> : <Lock size={13} weight={lead ? 'fill' : 'regular'} />}</span>
                <span className="min-w-0">
                  <span className={`block text-[14px] ${lead ? 'text-bone-50 font-semibold' : 'text-bone-50'}`}>{b.title}</span>
                  <span className="block text-[12.5px] text-bone-500 leading-relaxed">{b.body}</span>
                </span>
              </li>
            )
          })}
        </ul>

        {!pro.pro && (
          <div className="space-y-3">
            {IAP_CONFIGURED ? (
              <NativeBuy offer={offer} signedIn={!!auth.user} onDone={onClose} />
            ) : isNative ? (
              <p className="text-[13px] text-bone-400 leading-relaxed">Pro is coming to this version through the App Store. Everything free works today.</p>
            ) : !cloudConfigured ? (
              <p className="text-[13px] text-bone-400 leading-relaxed">Pro needs an account, and this build has no account service.</p>
            ) : !auth.user ? (
              <>
                <p className="text-[13px] text-bone-400 leading-relaxed">Pro lives on your account so it follows you to every phone. Sign in first, then come back here.</p>
                <Button variant="primary" onClick={() => { onClose(); setView('more') }}>
                  Sign in under Settings
                </Button>
              </>
            ) : buyUrl ? (
              <>
                <a href={buyUrl} target="_blank" rel="noreferrer" className="push inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-ember-500 text-ember-950 text-[14px] font-semibold border border-ember-300/30 w-full">
                  Buy Pro · {PRO_PRICE} <ArrowSquareOut size={15} />
                </a>
                <p className="text-[12px] text-bone-600 leading-relaxed">Checkout opens in your browser. When it finishes, come back and tap below if Pro has not switched on by itself.</p>
                <Button variant="ghost" size="sm" onClick={check} disabled={checking}>
                  <ArrowClockwise size={14} className={checking ? 'animate-spin' : ''} /> I already bought it
                </Button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-bone-400 leading-relaxed">Pro goes on sale before the rut. Accounts made this season get it free for a year; it switches on by itself.</p>
                <Button variant="ghost" size="sm" onClick={check} disabled={checking}>
                  <ArrowClockwise size={14} className={checking ? 'animate-spin' : ''} /> Check again
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}

/**
 * Buy and restore through the App Store. Apple wants the price, the term,
 * the standard EULA and the privacy policy on the screen that sells an
 * auto-renewable subscription, so they are all here.
 */
function NativeBuy({ offer, signedIn, onDone }: { offer: IapOffer | null | undefined; signedIn: boolean; onDone: () => void }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null)

  async function purchase() {
    if (!offer) return
    setBusy('buy')
    const r = await buy(offer.pkg)
    if (!r.ok) {
      setBusy(null)
      if (!r.cancelled) toast(r.message)
      return
    }
    const s = await refreshPro()
    setBusy(null)
    toast(s.pro || r.status.pro ? 'Rutline Pro is on. Thank you.' : 'Purchase received; Pro switches on in a moment')
    if (s.pro) onDone()
  }

  async function restoreAll() {
    setBusy('restore')
    try {
      const got = await restore()
      const s = await refreshPro()
      toast(got.pro || s.pro ? `Pro is on until ${proUntilLabel(s.until ?? got.until)}` : 'No Pro purchase on this Apple ID')
      if (s.pro) onDone()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reach the App Store')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Button variant="primary" onClick={purchase} disabled={!offer || busy !== null}>
        {offer === undefined ? 'Checking the App Store…' : offer ? `Buy Pro · ${offer.price}` : 'Not for sale yet'}
      </Button>
      <p className="text-[12px] text-bone-600 leading-relaxed">
        {offer?.renews ? 'Billed to your Apple ID for a year at a time; it renews unless you cancel in Settings › Apple ID › Subscriptions at least a day before the year ends.' : 'Billed once to your Apple ID and good for 12 months.'}{' '}
        {signedIn ? 'It follows your account to every phone.' : 'Signed out, Pro stays on this phone; sign in and it follows your account.'}
      </p>
      <Button variant="ghost" size="sm" onClick={restoreAll} disabled={busy !== null}>
        <ArrowClockwise size={14} className={busy === 'restore' ? 'animate-spin' : ''} /> Restore purchases
      </Button>
      <p className="text-[11.5px] text-bone-600">
        <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" className="underline">
          Terms of use
        </a>{' '}
        ·{' '}
        <a href="https://jordanyoerger.com/rutline/privacy.html" target="_blank" rel="noreferrer" className="underline">
          Privacy
        </a>
      </p>
    </>
  )
}
