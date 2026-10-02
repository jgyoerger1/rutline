import { FACTOR_DOCS } from '../../lib/huntcast'
import { SectionLabel } from '../ui'

const SOURCES: Array<{ label: string; url: string }> = [
  { label: 'HuntWise, HuntCast overview', url: 'https://huntwise.com/page/huntcast' },
  { label: 'HuntWise, how HuntCast plans a whitetail hunt', url: 'https://huntwise.com/field-guide/deer/how-huntcast-helps-you-plan-a-better-whitetail-hunt' },
  { label: 'BestHuntingTime, deer movement forecast methodology', url: 'https://besthuntingtime.com/deer-movement-forecast' },
  { label: 'MeatEater, how Mark Drury reads wind (DeerCast)', url: 'https://www.themeateater.com/wired-to-hunt/whitetail-hunting/how-mark-drury-predicts-buck-movement-based-on-wind' },
  { label: 'Deer & Deer Hunting, Alsheimer on weather', url: 'https://www.deeranddeerhunting.com/content/articles/1-how-weather-affects-deer-behavior-alsheimers-greatest-insights' },
  { label: 'National Deer Association, cold fronts and the collar data', url: 'https://deerassociation.com/hunting-cold-fronts/' },
  { label: 'MDWFP, moon myths vs. GPS reality', url: 'https://www.mdwfp.com/wildlife-hunting/private-lands-program/habitat-and-wildlife-information/moon-myths-vs-deer-reality-what-science-says' },
  { label: 'SEAFWA 2016, deer activity and solunar events', url: 'https://seafwa.org/journal/2016/movement-moon-white-tailed-deer-activity-and-solunar-events' },
  { label: 'Archery Hunting, 2026 rut dates by region', url: 'https://archeryhunting.com/2026-whitetail-rut-prediction-best-dates-to-hunt-by-region/' },
]

export default function Explain() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-bone-400 leading-relaxed max-w-[64ch]">
        Every hour starts from a dawn-and-dusk curve, then each factor below adds or subtracts points. The total is multiplied by the rut phase and clamped to 0-100. Commercial forecasts (HuntWise, DeerCast, BestHuntingTime) list the same inputs without publishing weights; the weights here lean on what the GPS-collar research actually supports. Time of day and rut phase carry the day. Pressure trend, a real temperature drop and a workable wind are the next tier. The moon is kept small on purpose.
      </p>
      <div>
        <SectionLabel className="mb-2">Factors</SectionLabel>
        <ul className="divide-y divide-bone-50/8 border-t border-b border-bone-50/8">
          {FACTOR_DOCS.map((f) => (
            <li key={f.key} className="grid grid-cols-[1fr_auto] md:grid-cols-[220px_90px_1fr] gap-x-4 gap-y-1 py-3 text-sm">
              <div className="font-medium">{f.title}</div>
              <div className="font-mono text-[12px] text-ember-400 tnum text-right md:text-left">{f.range}</div>
              <div className="col-span-2 md:col-span-1 text-bone-400 leading-relaxed">{f.why}</div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <SectionLabel className="mb-2">An honest note</SectionLabel>
        <p className="text-sm text-bone-400 leading-relaxed max-w-[64ch]">
          Collared-buck studies from Mississippi State, Texas A&M-Kingsville, Penn State and Maryland find that buck movement peaks with the local rut and shows no strong, consistent correlation with temperature, pressure, wind, rain or moon. November gets cold at the same time does come into estrus, which is why fronts get the credit. Use this index to pick the better of two sits, not to skip a day in the rut.
        </p>
      </div>
      <div>
        <SectionLabel className="mb-2">Sources</SectionLabel>
        <ul className="space-y-1.5">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-sm text-bone-200 hover:text-ember-400 underline underline-offset-4 decoration-bone-50/20">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
