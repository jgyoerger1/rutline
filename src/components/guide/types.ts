import type { ComponentType } from 'react'
import type { MotionValue } from 'framer-motion'

export interface GuideStep {
  id: string
  number: number
  title: string
  kicker: string
  body: string[]
  tips?: string[]
  caution?: string
  /** Small two-column reference list (wait times, minimums) */
  facts?: Array<[string, string]>
  /** Scene key the diagram should show for this step */
  illustration: string
}

export interface GuideMeta {
  slug: string
  installment: number
  title: string
  subtitle: string
  minutes: number
  gear: string[]
  /** Fine print under the outro */
  footnote?: string
}

export interface DiagramProps {
  /** 'intro', a step's illustration key, or 'outro' */
  scene: string
  /** 0-1 progress through the active step, spring-smoothed */
  draw: MotionValue<number>
  className?: string
}

export type Diagram = ComponentType<DiagramProps>
