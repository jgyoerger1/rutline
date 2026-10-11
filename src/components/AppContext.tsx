import { createContext, useContext } from 'react'
import type { DayScore } from '../lib/huntcast'
import type { PeakGuess } from '../lib/rut'
import type { Forecast, HomeGround, Settings } from '../lib/types'

export type View = 'map' | 'forecast' | 'huntcast' | 'tracker' | 'guide' | 'more'

export interface AppState {
  settings: Settings
  setSettings: (patch: Partial<Settings>) => void
  home: HomeGround | null
  /** A place picked on the Wind or Predict page for this session; overrides home for the forecast only */
  spot: HomeGround | null
  setSpot: (spot: HomeGround | null) => void
  /** Where the forecast and HuntCast are for: the spot if one is set, else home ground */
  where: HomeGround | null
  forecast: Forecast | null
  loading: boolean
  error: string | null
  refresh: () => void
  days: DayScore[]
  peak: PeakGuess | null
  view: View
  setView: (v: View) => void
  toast: (message: string) => void
  /** Map wants to open a specific waypoint */
  focusWaypoint: (id: number) => void
  focusRequest: number | null
  clearFocus: () => void
}

export const AppCtx = createContext<AppState>(null!)
export const useApp = () => useContext(AppCtx)
