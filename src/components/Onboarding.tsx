import { motion } from 'framer-motion'
import { useApp } from './AppContext'
import HomePicker from './HomePicker'
import { StaggerText, TrailDraw, Wordmark } from './motion'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { setSettings, toast } = useApp()
  return (
    <motion.div className="fixed inset-0 z-[80] bg-pine-950 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
      {/* Mobile: the poster carries the logo; copy sits on the lower third */}
      <div className="md:hidden absolute inset-0">
        <motion.img src="brand/poster.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-top" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: [0.16, 1, 0.3, 1] }} />
        <div className="absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/85 via-45% to-transparent" />
      </div>
      <TrailDraw className="hidden md:block" delay={0.4} />

      <div className="relative min-h-[100dvh] grid md:grid-cols-[1.05fr_1fr]">
        <div className="relative px-6 pt-[52dvh] pb-10 md:pt-20 md:pb-20 md:pl-[7vw] md:pr-12 flex flex-col justify-end md:justify-center">
          <motion.div className="hidden md:flex items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <img src="icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl border border-bone-50/10" />
            <Wordmark className="text-xl" />
          </motion.div>
          <h1 className="md:mt-10 text-[28px] md:text-5xl font-semibold tracking-tighter leading-[1.04] max-w-[16ch]">
            <StaggerText text="Map. Predict. Track." delay={0.15} />
          </h1>
          <motion.p className="mt-4 md:mt-5 text-bone-300 text-[15px] md:text-base leading-relaxed max-w-[46ch]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, type: 'spring', stiffness: 140, damping: 22 }}>
            Pin your stands, cameras and scrapes. Pull live wind and weather for your ground. Get an hour-by-hour read on when deer are on their feet. And when it is time to find one, turn your phone into a blood light.
          </motion.p>
          <motion.div className="mt-8 md:mt-10 max-w-md" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, type: 'spring', stiffness: 140, damping: 22 }}>
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
          </motion.div>
        </div>

        {/* Desktop: the field hero with a fade into the copy column */}
        <div className="relative hidden md:block overflow-hidden">
          <motion.img src="brand/hero-buck.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[64%_45%]" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: [0.16, 1, 0.3, 1] }} />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950 via-pine-950/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-pine-950/85 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_100%_100%,rgba(15,17,16,0.95),transparent_65%)]" />
        </div>
      </div>
    </motion.div>
  )
}
