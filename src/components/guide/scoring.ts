/**
 * Scoring a whitetail the Boone and Crockett typical way, written for Rutline.
 * The example rack in the diagram is a typical 10 with one abnormal point:
 * gross 154 6/8, net 150 0/8.
 */
import type { GuideMeta, GuideStep } from './types'

export type RackScene = 'prep' | 'points' | 'beams' | 'tines' | 'circs' | 'spread' | 'total'

export const SCORING: GuideMeta = {
  slug: 'scoring-a-buck',
  installment: 3,
  title: 'Scoring a buck',
  subtitle: 'The Boone and Crockett typical method, measure by measure, with a score sheet at the end that does the arithmetic.',
  minutes: 25,
  gear: ['A quarter-inch flexible steel tape', 'A steel cable or a length of wire for the beams', 'A pencil and a score sheet, or the one at the end of this guide', 'A straightedge for the tine baselines', 'Good light'],
  footnote: 'This is the typical whitetail method. Non-typical scoring adds the abnormal points instead of deducting them. An official entry needs a 60-day drying period and a certified measurer; the sheet here gives you a green score.',
}

/** The example rack, in inches. Left and right from the deer's point of view. */
export const EXAMPLE_RACK = {
  L: { F: '24 2/8', G1: '5 2/8', G2: '9 4/8', G3: '8 2/8', G4: '4 6/8', H1: '4 4/8', H2: '4 2/8', H3: '4 0/8', H4: '3 6/8' },
  R: { F: '23 6/8', G1: '4 6/8', G2: '9 0/8', G3: '8 6/8', G4: '4 2/8', H1: '4 4/8', H2: '4 4/8', H3: '4 2/8', H4: '3 4/8' },
  spread: '17 4/8',
  abnormal: '1 4/8',
}

export const SCORING_STEPS: GuideStep[] = [
  {
    id: 'prep',
    number: 1,
    title: 'Set the rules',
    kicker: 'Eighths, a flexible tape and a dry rack',
    body: [
      'Every measurement is taken to the nearest eighth of an inch with a quarter-inch flexible steel tape. A cable or wire follows the curves better for the main beams: lay it, mark it, then measure the mark.',
      'Official scores wait 60 days after the kill so the rack has dried and shrunk. A green score taken now runs a little high. Expect to lose a point or two by the time it is official.',
      'Decide which side is right and which is left from the deer’s point of view, and keep it straight all the way through.',
    ],
    facts: [
      ['Unit', 'Nearest 1/8 inch'],
      ['Drying period', '60 days for an official score'],
      ['B&C typical, awards', '160'],
      ['B&C typical, all-time', '170'],
      ['Pope and Young typical', '125'],
    ],
    illustration: 'prep',
  },
  {
    id: 'points',
    number: 2,
    title: 'Count the points',
    kicker: 'What counts, and what does not',
    body: [
      'A point must be at least one inch long, and somewhere along that inch it has to be longer than it is wide. The tip of the main beam counts as a point but is measured as part of the beam, never as a tine.',
      'Name the normal points from the base out. G1 is the brow tine, G2 the next one up the beam, then G3, G4 and so on. Normal points rise from the top of the main beam in the usual pattern. Anything else, a sticker off a tine, a drop tine, a kicker off the burr, is abnormal: measured, written down and, for a typical score, deducted.',
      'Count both sides before you measure anything. The example rack is a typical ten with one abnormal point off the right G2.',
    ],
    illustration: 'points',
  },
  {
    id: 'beams',
    number: 3,
    title: 'Main beams',
    kicker: 'Burr to tip along the outside curve',
    body: [
      'Lay the cable along the outside of the beam, starting at the lowest outside edge of the burr and following the centre of the outer curve all the way to the tip. Mark the cable at the tip, pull it straight and read it.',
      'Record this as F for each side. The longer beam also caps your spread credit later.',
    ],
    facts: [
      ['Example, left beam', '24 2/8'],
      ['Example, right beam', '23 6/8'],
    ],
    illustration: 'beams',
  },
  {
    id: 'tines',
    number: 4,
    title: 'Tines',
    kicker: 'From the top edge of the beam to the tip',
    body: [
      'Lay a straightedge along the top edge of the beam on either side of the tine and draw a baseline across its base. Measure from that line, along the outer curve of the tine, to the tip.',
      'Do every normal point on both sides, G1 up to the last one. A point that fails the one-inch rule is not measured at all. An abnormal point is measured the same way and goes on its own line.',
    ],
    facts: [
      ['Example, left G2', '9 4/8'],
      ['Example, right G2', '9 0/8'],
    ],
    illustration: 'tines',
  },
  {
    id: 'circs',
    number: 5,
    title: 'Circumferences',
    kicker: 'Four per side, at the narrowest place',
    body: [
      'H1 is the smallest circumference between the burr and the brow tine. H2 sits between G1 and G2, H3 between G2 and G3, H4 between G3 and G4. Wrap the tape snug and read it at the narrowest point in each gap.',
      'There are always four, whatever the rack. If a side has no G4, take H4 halfway between G3 and the tip of the beam.',
    ],
    facts: [
      ['Example, right H1 to H4', '4 4/8 · 4 4/8 · 4 2/8 · 3 4/8'],
      ['Example, left H1 to H4', '4 4/8 · 4 2/8 · 4 0/8 · 3 6/8'],
    ],
    illustration: 'circs',
  },
  {
    id: 'spread',
    number: 6,
    title: 'Inside spread',
    kicker: 'The widest gap between the beams',
    body: [
      'Measure the inside spread at the widest point between the main beams, at a right angle to the centre line of the skull. Record it, but credit only up to the length of the longer main beam. A rack that is wider than it is long does not get the extra.',
      'Tip-to-tip and greatest outside spread go on the sheet for the record. Neither one scores.',
    ],
    facts: [
      ['Example, inside spread', '17 4/8'],
      ['Spread credit', 'Inside spread, capped at the longer beam'],
    ],
    illustration: 'spread',
  },
  {
    id: 'total',
    number: 7,
    title: 'Add it up',
    kicker: 'Gross is what grew. Net is what the book counts.',
    body: [
      'Add each side: beam, every normal tine, four circumferences. Add the spread credit. Add the abnormal points. That total is the gross score, the number hunters quote at the tailgate.',
      'For the typical net, subtract the side-to-side difference on every paired measurement, then subtract the abnormal points. Symmetry pays. A rack can lose ten inches to lopsided tines.',
      'The example rack: left side 68 4/8, right side 67 2/8, spread 17 4/8, one abnormal point 1 4/8. Gross 154 6/8. Differences 3 2/8. Net typical 150 0/8.',
    ],
    illustration: 'total',
  },
]
