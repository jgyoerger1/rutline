/**
 * Field dressing a whitetail, written for Rutline. Sequence follows the
 * hunter-education standard (tag, position, open, free the organs top and
 * bottom, pull, cool). Illustration keys drive the sticky diagram.
 */
export type IllustrationKey = 'position' | 'anus' | 'belly' | 'chest' | 'windpipe' | 'diaphragm' | 'pull' | 'organs' | 'cool'

import type { GuideMeta, GuideStep } from './types'

export const FIELD_DRESSING: GuideMeta = {
  slug: 'field-dressing',
  installment: 1,
  title: 'Field dressing a deer',
  subtitle: 'From the first cut to a cooling carcass in nine steps. Clean, quick, and no punctured gut.',
  minutes: 20,
  gear: ['A sharp knife, 3 to 4 inch blade, drop point or gut hook', 'Nitrile gloves, shoulder length if you have them', 'A zip tie or 2 feet of string', 'Game bags or a clean tarp', 'Paper towels or a rag', 'Your tag, and the pen to fill it out'],
  footnote: "Written for Rutline from the hunter-education standard sequence. Regulations on tagging and evidence of sex vary by state; your agency's rules win.",
}

export const FIELD_DRESSING_STEPS: GuideStep[] = [
  {
    id: 'position',
    number: 1,
    title: 'Tag it, then set it up',
    kicker: 'Before the knife comes out',
    body: [
      'Fill out and attach your tag first. Most states require it before the deer is moved, and it is the one step nobody remembers once their hands are bloody.',
      'Drag the deer to a clean, flat spot and roll it onto its back with the head uphill, so everything drains away from the chest. Wedge rocks, a pack or logs under the shoulders to keep it from rolling. If you have a partner, have them hold the hind legs apart; alone, tie a leg off to a sapling.',
      'Gloves on. A sharp knife matters more than a big one: three to four inches of blade, and you will use the first inch of it for almost everything.',
    ],
    tips: ['Note the kill site on your map now. Rutline can drop a pin at your position from the button at the end of this guide.', 'Photograph the tag on the deer if your state allows electronic tagging; it is proof if anything gets lost on the drag out.'],
    illustration: 'position',
  },
  {
    id: 'anus',
    number: 2,
    title: 'Free the vent',
    kicker: 'Work from the back end first',
    body: [
      'Cut a circle around the anus, about an inch out, angling the blade in toward the tailbone. Go deep enough, four to six inches, that the rectum pulls free from the surrounding tissue like a cork.',
      'Pull a few inches of it out and close it off with a zip tie or a knot of string. That seals the one thing you do not want leaking into the cavity later.',
      'On a doe, cut around the udder and lift it away in the same pass. On a buck, cut around the penis and testicles and lay them back toward the tail; check your regulations, some states want evidence of sex left attached.',
    ],
    caution: 'Keep the blade angled away from the gut and work slowly here. The bladder sits just inside.',
    illustration: 'anus',
  },
  {
    id: 'belly',
    number: 3,
    title: 'Open the belly',
    kicker: 'The cut that makes or ruins the meat',
    body: [
      'Pinch the hide at the base of the breastbone, lift it, and nick a hole just big enough for two fingers. Push your index and middle finger into the slit in a V, palm up, with the blade riding between them, edge up.',
      'Lift with the fingers and slide the knife toward the pelvis in one controlled stroke. Your fingers hold the stomach and intestines down and away from the edge. Stop at the pelvis.',
      'If the gut balloons up into the cut, slow down. A nicked paunch is fixable, a sliced one is a mess you will taste.',
    ],
    tips: ['A gut-hook knife does this step for you: hook in at the sternum and pull toward the tail.'],
    caution: 'Blade up, always. Never saw downward into the body cavity.',
    illustration: 'belly',
  },
  {
    id: 'chest',
    number: 4,
    title: 'Open the chest',
    kicker: 'Optional, but it makes the next two steps easy',
    body: [
      'Split the breastbone from the bottom up, through the cartilage where the ribs meet. A stout knife does it on a young deer; a mature buck may want a small saw. Stop short of the neck if the head is going to a taxidermist.',
      'Spread the ribs apart with your knees or a stick. You can now see and reach the heart, lungs and the top of the windpipe instead of working blind.',
      'Skipping this is fine on a small deer: you can do everything from below the diaphragm by feel. It just takes longer and more trust in your knife hand.',
    ],
    illustration: 'chest',
  },
  {
    id: 'windpipe',
    number: 5,
    title: 'Cut the windpipe and gullet',
    kicker: 'Set everything free at the top',
    body: [
      'Reach up into the neck, grab the windpipe and esophagus together as high as you can, and cut through both above your hand. Cutting high leaves the throat clean and gives you a handle to pull on.',
      'If you did not open the chest, do this by reaching up under the ribs: find the windpipe by feel against the spine, pull it down, and cut with the blade facing away from your fingers.',
    ],
    caution: 'This is the cut that sends hunters to the emergency room. Your off hand is in the dark next to the edge; keep the blade turned away from it.',
    illustration: 'windpipe',
  },
  {
    id: 'diaphragm',
    number: 6,
    title: 'Cut the diaphragm loose',
    kicker: 'The wall between chest and belly',
    body: [
      'The diaphragm is the thin sheet of muscle that separates the lungs from the gut. It is attached all the way around the inside of the ribs. Run the knife along the ribs on both sides to free it, cutting close to the bone.',
      'Once it is loose, nothing is holding the chest organs to the body except the windpipe you already cut.',
    ],
    illustration: 'diaphragm',
  },
  {
    id: 'pull',
    number: 7,
    title: 'Roll it and pull',
    kicker: 'Everything comes out together',
    body: [
      'Roll the deer onto its side, downhill. Grab the windpipe and pull steadily toward the tail. Lungs, heart, stomach and intestines follow in one connected mass.',
      'Where it hangs up, cut the connective tissue holding it to the back wall. Keep tension and let gravity do the work.',
      'The tied-off rectum pulls through from the inside last. Lift the bladder out by the neck without squeezing it. If you need to open the pelvis to get it clear, split the pelvic bone at the seam with the knife point or a saw.',
    ],
    illustration: 'pull',
  },
  {
    id: 'organs',
    number: 8,
    title: 'Heart and liver',
    kicker: 'The best meat on the animal, if you want it',
    body: [
      'Before you walk away from the pile, cut the heart free and trim the liver off the mass. Both go in a bag on their own and into the cold as fast as the rest.',
      'Check the liver as you go: spots, cysts or an off colour are a reason to leave it, and a reason to look the rest of the carcass over carefully.',
    ],
    illustration: 'organs',
  },
  {
    id: 'cool',
    number: 9,
    title: 'Drain, wipe, cool',
    kicker: 'Heat spoils more venison than anything else',
    body: [
      'Tip the deer head-up and let it drain. Wipe the cavity out with paper towels or a rag; do not rinse it with creek water, which adds bacteria and moisture.',
      'Prop the chest open with a stick so air moves through, then get the carcass hanging or into shade and cold as soon as you can. Above about 50°F you are on a clock, and bags of ice in the cavity buy you time on the drag out.',
      'Pack out your gloves and the zip tie. Leave the gut pile where it will not foul a trail or water.',
    ],
    tips: ['Drop a pin at the kill site now so the drag line, the pile and the stand that produced it all live on your map for next season.'],
    illustration: 'cool',
  },
]
