/**
 * Reading a blood trail, written for Rutline. Shot reaction, wait times,
 * sign at the hit site, blood colour, marking, grid search, approach.
 */
import type { GuideMeta, GuideStep } from './types'

export type TrailScene = 'shot' | 'hitsite' | 'blood' | 'mark' | 'grid' | 'approach'

export const BLOOD_TRAIL: GuideMeta = {
  slug: 'blood-trail',
  installment: 2,
  title: 'Reading a blood trail',
  subtitle: 'What the hit tells you, how long to wait, and how to stay on a trail that wants to disappear.',
  minutes: 15,
  gear: ['Flagging tape or a roll of tissue', 'A headlamp, and the blood-light mode in the Track tab', 'Your phone with Rutline on it, for blood pins', 'Drag rope and gloves', 'Patience. It is the gear you run out of first.'],
  footnote: 'Wait times are rules of thumb, not rules. Weather, the deer and your own confidence in the shot all move them. Where tracking dogs are legal, a good one finds deer people do not.',
}

export const BLOOD_TRAIL_STEPS: GuideStep[] = [
  {
    id: 'shot',
    number: 1,
    title: 'Watch, listen, then wait',
    kicker: 'The first minute decides the next hour',
    body: [
      'The trail starts before you leave the stand. Burn in two spots: exactly where the deer stood when you shot, and the last place you saw or heard it. Pick a tree or a rock behind each one, because from the ground nothing looks the same.',
      'Read the reaction. A hard kick of the back legs usually means heart or lungs. A hunched back and a stiff walk-off is the gut. A deer that drops flat and scrambles up again was grazed high. A flag-up bound with no stumble may be a clean miss.',
      'Then sit. Pushing a deer that would have bedded within 150 yards turns a short track into a long one, or into no deer at all.',
    ],
    facts: [
      ['Heart or lungs', '30 minutes'],
      ['Liver', '4 hours'],
      ['Paunch', '8 to 12 hours; overnight if it is cool'],
      ['Not sure', 'Treat it as a paunch hit'],
    ],
    tips: ['Drop a pin at the hit site and another at last seen while you are still in the stand. The map remembers what the woods will not.'],
    illustration: 'shot',
  },
  {
    id: 'hitsite',
    number: 2,
    title: 'Read the hit site',
    kicker: 'Hair, blood and the arrow say where you hit',
    body: [
      'Walk to the hit site quietly and look before you step. Hair comes off at the entry. White hair means low, belly or brisket. Long dark hair with a grey base is the high back. A big pile of hair with little blood is often a graze.',
      'Find the arrow if you shot one. Smell it. Sour and smeared green is paunch. Bright red and bubbly is lungs. Greasy with white fat and little blood is a muscle hit. Dark and thick is liver.',
      'Mark the hit site with tape or a pin before you move on. Everything downstream is measured from here.',
    ],
    illustration: 'hitsite',
  },
  {
    id: 'blood',
    number: 3,
    title: 'Read the blood',
    kicker: 'Colour, bubbles and where it lands',
    body: [
      'Pink to bright red with small bubbles is lung blood; expect a short track. Bright red in volume, sprayed, is an artery or the heart; shorter still. Dark red to maroon is liver. The deer will bed and die within a few hours if nobody pushes it.',
      'Brown or green blood mixed with food is paunch. Thin, watery pink blood that tapers off quickly is muscle. Blood on both sides of the trail means the shot passed through.',
      'Look at the height too. Spray at knee height and above comes from the chest. Drips on the ground only can mean a low hit or a leg.',
    ],
    facts: [
      ['Pink, frothy', 'Lungs'],
      ['Bright, heavy', 'Heart or artery'],
      ['Dark maroon', 'Liver'],
      ['Brown-green, food', 'Paunch'],
      ['Thin, pink, tapering', 'Muscle'],
    ],
    illustration: 'blood',
  },
  {
    id: 'mark',
    number: 4,
    title: 'Mark and move slowly',
    kicker: 'Flag the last blood before you look for the next',
    body: [
      'Walk beside the trail, never on it, so you can come back to the sign you have already found. Mark every drop you confirm with a scrap of tape or tissue, and drop a blood pin in Rutline so the line builds on your map as you go.',
      'Look low and look far. Blood lands on the backs of leaves, on grass at hip height, and on the far side of logs the deer cleared. Overturned leaves and scuffed tracks keep you on the line when the blood thins out.',
      'At night, the blood-light mode in the Track tab pulls red out of the leaf litter. Go slower than feels reasonable.',
    ],
    tips: ['One tracker on the sign, everyone else behind. Three people on the trail stamp it out.'],
    illustration: 'mark',
  },
  {
    id: 'grid',
    number: 5,
    title: 'When the blood stops',
    kicker: 'You have lost the line, not the deer',
    body: [
      'Go back to the last blood you are sure of. Work circles outward from it, each one wider, looking for a single drop, a track or a bent stem. A wounded deer heads downhill, toward water and the thickest cover, and it tends to swing back toward where it came from.',
      'Check creek edges, the first thick cover and any bed you find. A bed with blood in it means you are close. Back out and wait if that blood is dark or sparse.',
      'If you lose a paunch or liver hit in the dark, leave it. Come back at first light with fresh eyes and a bigger grid.',
    ],
    caution: 'A deer jumped from its bed before it is dead can go a mile. When in doubt, back out.',
    illustration: 'grid',
  },
  {
    id: 'approach',
    number: 6,
    title: 'Approach and confirm',
    kicker: 'From behind, ready for one more',
    body: [
      'Come in from behind and from downwind. A deer that is not dead is watching its back trail. Stop short and look at the eyes: open and glassy is dead, closed means it is alive.',
      'Touch the eye with a stick or an arrow before you touch the deer. If it blinks, back off and finish it.',
      'Then tag it, drop the pin, and turn to installment one.',
    ],
    illustration: 'approach',
  },
]
