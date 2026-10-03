import { motion } from 'framer-motion'
import { AppleLogo, ArrowLeft, EnvelopeSimple, GoogleLogo } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { cloud } from '../../lib/cloud'
import { setSettings } from '../../lib/settings'
import { useApp } from '../AppContext'
import { StaggerText, TrailDraw, Wordmark } from '../motion'
import { Button, Field, Input } from '../ui'

type Mode = 'signin' | 'signup' | 'code' | 'reset'

export default function SignIn() {
  const { toast } = useApp()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(() => {
    try {
      return localStorage.getItem('rutline.pendingJoin') ? 'You have a camp invite. Sign in or create an account and you will join it automatically.' : null
    } catch {
      return null
    }
  })
  if (!cloud) return null
  const backend = cloud

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em.includes('@')) {
      setError('Enter the email you want on the account.')
      return
    }
    if (mode === 'signin') return void run(() => backend.signInWithPassword(em, password))
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Use a password of at least 8 characters.')
        return
      }
      return void run(async () => {
        const r = await backend.signUpWithPassword(em, password)
        if (r.needsConfirmation) {
          setNotice('Check your email for the confirmation link, then come back and sign in.')
          setMode('signin')
        }
      })
    }
    if (mode === 'code') {
      if (!codeSent) return void run(async () => {
        await backend.sendEmailCode(em)
        setCodeSent(true)
        setNotice(`We emailed a 6-digit code to ${em}.`)
      })
      return void run(() => backend.verifyEmailCode(em, code))
    }
    if (mode === 'reset') {
      return void run(async () => {
        await backend.sendPasswordReset(em)
        setNotice('If that email has an account, a reset link is on its way.')
        setMode('signin')
      })
    }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'code' ? 'Sign in with a code' : mode === 'reset' ? 'Reset your password' : 'Sign in'

  return (
    <motion.div className="fixed inset-0 z-[85] bg-pine-950 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
      <div className="md:hidden absolute inset-0">
        <motion.img src="brand/poster.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-top" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: [0.16, 1, 0.3, 1] }} />
        <div className="absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/90 via-50% to-pine-950/20" />
      </div>
      <TrailDraw className="hidden md:block" delay={0.4} />

      <div className="relative min-h-[100dvh] grid md:grid-cols-[1.05fr_1fr]">
        <div className="relative px-6 pt-[34dvh] pb-10 md:pt-20 md:pb-20 md:pl-[7vw] md:pr-12 flex flex-col justify-end md:justify-center">
          <motion.div className="hidden md:flex items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <img src="icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl border border-bone-50/10" />
            <Wordmark className="text-xl" />
          </motion.div>
          <h1 className="md:mt-10 text-[26px] md:text-4xl font-semibold tracking-tighter leading-[1.05] max-w-[18ch]">
            <StaggerText text="Your ground, on every device." delay={0.1} />
          </h1>
          <motion.p className="mt-3 text-bone-300 text-[14.5px] leading-relaxed max-w-[44ch]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            Sign in and your pins, photos, landowners and settings follow you to any phone or browser. Everything still works offline in the woods.
          </motion.p>

          <motion.form onSubmit={submit} className="mt-7 max-w-md space-y-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, type: 'spring', stiffness: 140, damping: 22 }}>
            <div className="flex items-center gap-2">
              {mode !== 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                    setCodeSent(false)
                  }}
                  className="push w-8 h-8 grid place-items-center rounded-lg text-bone-400 hover:text-bone-50"
                  aria-label="Back"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="text-[12px] font-medium tracking-wide text-bone-400 uppercase">{title}</div>
            </div>

            {notice && <div className="rounded-xl border border-bone-50/10 bg-pine-900/70 px-4 py-3 text-[13px] text-bone-200">{notice}</div>}

            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" required disabled={busy || (mode === 'code' && codeSent)} />
            </Field>

            {(mode === 'signin' || mode === 'signup') && (
              <Field label="Password" helper={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••••••" required disabled={busy} />
              </Field>
            )}

            {mode === 'code' && codeSent && (
              <Field label="6-digit code" helper="From the email we just sent.">
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="font-mono tracking-[0.3em]" required disabled={busy} />
              </Field>
            )}

            {error && (
              <div role="alert" className="text-[13px] text-ember-400">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? 'One moment' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'code' ? (codeSent ? 'Verify code' : 'Email me a code') : 'Send reset link'}
            </Button>

            {backend.providers.length > 0 && mode !== 'reset' && (
              <div className="grid grid-cols-2 gap-2">
                {backend.providers.includes('apple') && (
                  <Button type="button" onClick={() => void run(() => backend.signInWithProvider('apple'))} disabled={busy}>
                    <AppleLogo size={18} weight="fill" /> Apple
                  </Button>
                )}
                {backend.providers.includes('google') && (
                  <Button type="button" onClick={() => void run(() => backend.signInWithProvider('google'))} disabled={busy}>
                    <GoogleLogo size={18} weight="bold" /> Google
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-bone-400">
              {mode === 'signin' && (
                <>
                  <button type="button" onClick={() => setMode('signup')} className="hover:text-bone-50 underline underline-offset-4 decoration-bone-50/20">
                    New here? Create an account
                  </button>
                  <button type="button" onClick={() => setMode('code')} className="hover:text-bone-50 underline underline-offset-4 decoration-bone-50/20 inline-flex items-center gap-1">
                    <EnvelopeSimple size={14} /> Email me a code instead
                  </button>
                  <button type="button" onClick={() => setMode('reset')} className="hover:text-bone-50 underline underline-offset-4 decoration-bone-50/20">
                    Forgot password
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button type="button" onClick={() => setMode('signin')} className="hover:text-bone-50 underline underline-offset-4 decoration-bone-50/20">
                  Already have an account? Sign in
                </button>
              )}
              {mode === 'code' && codeSent && (
                <button
                  type="button"
                  onClick={() => {
                    setCodeSent(false)
                    setCode('')
                  }}
                  className="hover:text-bone-50 underline underline-offset-4 decoration-bone-50/20"
                >
                  Use a different email
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-bone-50/8">
              <button
                type="button"
                onClick={() => {
                  setSettings({ localOnly: true })
                  toast('Running on this device only. Sign in any time from More.')
                }}
                className="text-[13px] text-bone-600 hover:text-bone-200 underline-offset-4 hover:underline"
              >
                Use without an account on this device
              </button>
            </div>
          </motion.form>
        </div>

        <div className="relative hidden md:block overflow-hidden">
          <motion.img src="brand/hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[70%_50%]" initial={{ scale: 1.08, x: 10 }} animate={{ scale: 1, x: 0 }} transition={{ duration: 7, ease: [0.16, 1, 0.3, 1] }} />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950 via-pine-950/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-pine-950/80 via-transparent to-transparent" />
        </div>
      </div>
    </motion.div>
  )
}
