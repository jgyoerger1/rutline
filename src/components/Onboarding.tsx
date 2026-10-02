import { motion } from 'framer-motion'
import { useApp } from './AppContext'
import HomePicker from './HomePicker'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { setSettings, toast } = useApp()
  return (
    <motion.div className="fixed inset-0 z-[80] bg-pine-950 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
      <div className="min-h-[100dvh] grid md:grid-cols-[1.1fr_1fr]">
        <div className="relative px-6 py-10 md:pl-[8vw] md:pr-12 md:py-20 flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <img src="icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl border border-bone-50/10" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-bone-600">Downwind</span>
          </div>
          <h1 className="mt-10 text-3xl md:text-5xl font-semibold tracking-tighter leading-[1.02] max-w-[16ch]">Know the wind. Know the hour.</h1>
          <p className="mt-5 text-bone-400 leading-relaxed max-w-[48ch]">
            Pin your stands, cameras and scrapes. Pull live wind and weather for your ground. Get an hour-by-hour read on when deer are on their feet. And when it is time to find one, turn your phone into a blood light.
          </p>
          <div className="mt-10 max-w-md">
            <div className="text-[12px] font-medium tracking-wide text-bone-400 uppercase mb-3">Start with your home ground</div>
            <HomePicker
              onPick={(home) => {
                setSettings({ home })
                toast(`Home ground set: ${home.label}`)
                onDone()
              }}
            />
            <button onClick={onDone} className="mt-4 text-[13px] text-bone-600 hover:text-bone-200 underline-offset-4 hover:underline">
              Skip for now
            </button>
          </div>
        </div>
        <div className="relative hidden md:block overflow-hidden">
          <img src="icons/splash.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950 via-pine-950/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-pine-950/80 via-transparent to-transparent" />
        </div>
      </div>
    </motion.div>
  )
}
