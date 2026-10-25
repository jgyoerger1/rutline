import { ArrowClockwise, ArrowSquareOut, Check, Lock } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { cloudConfigured } from '../../lib/cloud'
import { isNative } from '../../lib/native'
import { PAYMENT_LINK, PRO_BENEFITS, PRO_PRICE, proUntilLabel, refreshPro, useProState, type ProFeature } from '../../lib/pro'
import { useApp } from '../AppContext'
import { Button, SectionLabel, Sheet } from '../ui'

/**
 * The one place Pro is explained and bought. Opened by any locked feature,
 * which is listed first. Buying happens on the web through a Stripe Payment
 * Link tied to the account; the native app will sell through the App Store.
 */
export default function ProSheet({ feature, onClose }: { feature: ProFeature | null; onClose: () => void }) {
  const { setView, toast } = useApp()
  const auth = useAuth()
  const pro = useProState()
  const [checking, setChecking] = useState(false)

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
            <SectionLabel>Your season pass</SectionLabel>
            <div className="mt-1 text-[15px] text-bone-50">Pro is on until {proUntilLabel(pro.until)}.</div>
            <p className="mt-1 text-[12.5px] text-bone-400">Everything below is unlocked on this account, on every phone you sign in on.</p>
          </div>
        ) : (
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember-400">Season pass</div>
            <div className="mt-1 text-[26px] font-semibold tracking-tight leading-tight">
              {PRO_PRICE} <span className="text-[14px] font-normal text-bone-400">for 12 months</span>
            </div>
            <p className="mt-1 text-[13px] text-bone-400 leading-relaxed">One payment, no auto-renew. Buy it in August, hunt the whole season, decide again next year. The free app stays free.</p>
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
            {isNative ? (
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
