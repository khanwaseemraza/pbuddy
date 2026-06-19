// Listing content moderation (E14-S4). A pure text screen over a parcel's
// free-text fields (title + description) for prohibited-item signals. This is the
// safety backstop for the sealed-package model: the carrier never opens the
// parcel, so the listing text is the main place we can catch an obviously
// improper item before it ever reaches the marketplace.
//
// Kept pure (no I/O) so it is exhaustively unit-testable and reusable.

// Word-boundary patterns grouped by the prohibited category they map to. These
// mirror the prohibited-items declaration; matching is deliberately conservative
// (whole words / common phrases) to keep false positives low — borderline cases
// are handled by the sender declaration + the carrier's right to refuse, not here.
const RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'drugs', patterns: [
    /\b(cocaine|heroin|cannabis|weed|marijuana|mdma|ketamine|meth|amphetamine|opioids?)\b/i,
    /\bcontrolled substances?\b/i,
  ] },
  { category: 'weapons', patterns: [
    /\b(gun|guns|firearm|firearms|pistol|rifle|shotgun|ammunition|ammo|bullets?|grenade|explosives?)\b/i,
    /\b(knife|knives|blade|machete|taser|stun gun)\b/i,
  ] },
  { category: 'cash', patterns: [
    /\b(cash|banknotes?|bank cards?|credit cards?|debit cards?)\b/i,
  ] },
  { category: 'stolen_goods', patterns: [
    /\b(stolen|counterfeit|fake (?:goods|watches?|bags?)|knock[- ]?off)\b/i,
  ] },
  { category: 'hazardous', patterns: [
    /\b(fireworks?|flammable|corrosive|toxic|acid|gas cylinder|lithium battery pack)\b/i,
  ] },
  { category: 'livestock', patterns: [
    /\b(live animals?|livestock|puppy|puppies|kitten|reptile)\b/i,
  ] },
];

export interface ModerationResult {
  flagged: boolean;
  hits: Array<{ category: string; term: string }>;
}

/** Screen free text for prohibited-item signals. Returns every category hit. */
export function screenListing(...fields: Array<string | null | undefined>): ModerationResult {
  const text = fields.filter(Boolean).join(' \n ');
  const hits: ModerationResult['hits'] = [];
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) hits.push({ category: rule.category, term: m[0].toLowerCase() });
    }
  }
  return { flagged: hits.length > 0, hits };
}
