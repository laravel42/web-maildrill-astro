/**
 * Collapse near-duplicate media tags into a smaller, searchable set.
 * Used when seeding/retagging and when regrouping an existing library.
 *
 * Rule of thumb: after grouping, a tag must appear on at least MIN_TAG_ASSETS
 * images in the library — rarer tags are pruned (see pruneRareTags).
 */

/** Minimum distinct assets a tag must appear on to be kept. */
export const MIN_TAG_ASSETS = 3;

/** Dropped entirely — too generic, meta, or Unsplash composition noise. */
const DROP = new Set([
  'abstract',
  'aesthetic',
  'are',
  'background',
  'backgrounds',
  'beautiful',
  'beauty',
  'blur',
  'bokeh',
  'busy',
  'clean',
  'color',
  'colorful',
  'colors',
  'colour',
  'colours',
  'concept',
  'cool background',
  'creative',
  'cute',
  'dark aesthetic',
  'desktop wallpapers',
  'digital image',
  'editorial',
  'experimental',
  'focus',
  'food photography',
  'fun',
  'funny',
  'happy',
  'hd background',
  'hd wallpapers',
  'high',
  'image',
  'is',
  'long',
  'lookbook',
  'motivational',
  'photo',
  'photograph',
  'photographer',
  'photoshop',
  'reference',
  'selective',
  'slow shutter speed',
  'soft',
  'stock',
  'street photography',
  'style',
  'text',
  'three',
  'top',
  'tumblr',
  'tumblr background',
  'two',
  'unsplash',
  'wallpapers',
  'wearing',
]);

/**
 * Alias → canonical. Keys are already lowercased / lightly normalized.
 * Prefer the fuller phrase when short and long forms are the same idea
 * (e.g. aerial → aerial view), and the library folder vocabulary where it overlaps.
 */
const ALIAS: Record<string, string> = {
  // folders / topics
  animal: 'animals',
  wildlife: 'animals',
  fauna: 'animals',
  mammal: 'animals',
  sport: 'sports',
  athletic: 'sports',
  athletics: 'sports',
  fitness: 'sports',
  exercise: 'sports',
  athlete: 'sports',
  'working out': 'workout',
  tech: 'technology',
  techno: 'technology',
  'high tech': 'technology',
  digital: 'technology',
  electronic: 'technology',
  electronics: 'technology',
  outdoor: 'nature',
  outdoors: 'nature',
  wilderness: 'nature',
  wild: 'nature',
  natural: 'nature',
  scenery: 'nature',
  land: 'landscape',
  building: 'architecture',
  buildings: 'architecture',
  architectural: 'architecture',
  clothing: 'fashion',
  clothes: 'fashion',
  cloth: 'fashion',
  clothe: 'fashion',
  apparel: 'fashion',
  garment: 'fashion',
  moda: 'fashion',
  'clothes rail': 'fashion',
  'clothing rack': 'fashion',
  'clothing store': 'shopping',
  'food and drink': 'food',
  cuisine: 'food',
  dish: 'food',
  eating: 'food',
  drink: 'food',
  beverage: 'food',
  cooked: 'cooking',
  baked: 'cooking',
  corporate: 'business',
  'business person': 'business',
  person: 'people',
  human: 'people',
  humans: 'people',
  adult: 'people',
  journey: 'travel',
  trip: 'travel',
  holiday: 'travel',

  // people
  woman: 'women',
  girl: 'women',
  female: 'women',
  lady: 'women',
  businesswoman: 'women',
  'black girl': 'women',
  'black women': 'women',
  'beautiful woman': 'women',
  'happy woman': 'women',
  'fitness woman': 'women',
  'female portrait': 'portrait',
  'girl smiling': 'portrait',
  man: 'men',
  boy: 'men',
  guy: 'men',
  male: 'men',
  businessman: 'men',
  friendship: 'friend',
  teamwork: 'team',
  smile: 'smiling',
  selfie: 'portrait',

  // subjects / equipment
  bird: 'birds',
  'bird s': 'birds',
  tree: 'trees',
  woodland: 'forest',
  mountain: 'mountains',
  'mountain peak': 'mountains',
  alp: 'mountains',
  flower: 'flowers',
  bloom: 'flowers',
  cloud: 'clouds',
  eye: 'eyes',
  hand: 'hands',
  handshake: 'hands',
  egg: 'eggs',
  bike: 'bicycle',
  cycling: 'bicycle',
  cyclist: 'bicycle',
  plane: 'airplane',
  aeroplane: 'airplane',
  aircraft: 'airplane',
  aviation: 'airplane',
  macbook: 'laptop',
  desktop: 'laptop',
  notebook: 'laptop',
  mac: 'laptop',
  'computer background': 'computer',
  pcb: 'circuit',
  'circuit board': 'circuit',
  motherboard: 'circuit',
  microchip: 'circuit',
  chip: 'circuit',
  microcontroller: 'circuit',
  'graphics card': 'circuit',
  gray: 'grey',
  grayscale: 'grey',
  urban: 'city',
  cityscape: 'city',

  // short ↔ fuller phrase (prefer the fuller form)
  aerial: 'aerial view',
  drone: 'aerial view',
  ski: 'skiing',
  run: 'running',
  runner: 'running',
  swim: 'swimming',
  hike: 'hiking',
  stair: 'staircase',
  step: 'staircase',
  shop: 'shopping',
  store: 'shopping',
  retail: 'shopping',
  health: 'healthy',
  'healthy lifestyle': 'healthy',
  lifestyle: 'life',
  wooden: 'wood',
  worker: 'work',
  working: 'work',
  engineer: 'engineering',
  tomatoe: 'tomato',
  tenni: 'tennis',
  'tennis ball': 'tennis',
  'tennis player': 'tennis',
  'racket sport': 'tennis',
  football: 'soccer',
  grassland: 'grass',
  'night sky': 'night',
  'clear sky': 'sky',
  'palm tree': 'trees',
  'luxury resort': 'resort',
  'home working': 'home office',
  hamburger: 'burger',
  racoon: 'raccoon',
  'sci fi': 'science fiction',
  'artificial intelligence': 'ai',
  intelligence: 'ai',
  iphone: 'phone',
  mobile: 'phone',
  financial: 'finance',
  banking: 'finance',
  pay: 'payment',
  'credit card': 'payment',
  autumn: 'fall',
  twilight: 'sunset',
  evening: 'sunset',
  kitten: 'cat',
  puppy: 'dog',
  bunny: 'rabbit',
  cub: 'animals',
  rainforest: 'forest',
  jungle: 'forest',
  sunlight: 'light',
  sun: 'light',
  neon: 'light',
  minimalism: 'minimal',
  minimalist: 'minimal',
  minimalistic: 'minimal',
  simple: 'minimal',
  monochrome: 'black',
  skyscraper: 'skyline',
  apartment: 'interior',
  room: 'interior',
  house: 'home',
  pattern: 'texture',
  geometric: 'texture',
  gradient: 'texture',
  yoga: 'wellness',
  fit: 'workout',
  training: 'workout',
  'high school sport': 'sports',
  deporte: 'sports',
  nba: 'basketball',
  ncaa: 'basketball',
  'slam dunk': 'basketball',
  cafe: 'coffee',
  'los angele': 'los angeles',
  pari: 'paris',
  maldive: 'maldives',
  philippine: 'philippines',
  'united state': 'usa',
  texa: 'texas',
  african: 'africa',
  coding: 'code',
  hardware: 'technology',
  software: 'technology',
  cybersecurity: 'technology',
  network: 'technology',
  internet: 'technology',

  // art / creative
  art: 'artwork',
  illustration: 'artwork',
  'modern art': 'artwork',
  sketch: 'artwork',
  painting: 'artwork',
  drawing: 'artwork',

  // rare → common (salvage signal before the min-asset prune)
  landscape: 'nature',
  park: 'nature',
  'national park': 'nature',
  countryside: 'nature',
  island: 'nature',
  cliff: 'nature',
  hill: 'nature',
  sky: 'clouds',
  weather: 'nature',
  rain: 'nature',
  storm: 'nature',
  ice: 'winter',
  water: 'sea',
  sand: 'beach',
  adventure: 'travel',
  airport: 'travel',
  car: 'travel',
  train: 'travel',
  passport: 'travel',
  resort: 'travel',
  luxury: 'travel',
  skiing: 'winter',
  baseball: 'sports',
  badminton: 'sports',
  golf: 'sports',
  volleyball: 'sports',
  archery: 'sports',
  skateboard: 'sports',
  'scuba diving': 'sports',
  action: 'sports',
  jump: 'sports',
  motion: 'sports',
  player: 'sports',
  court: 'sports',
  stadium: 'sports',
  muscle: 'sports',
  strength: 'sports',
  riding: 'sports',
  dance: 'sports',
  cake: 'food',
  cheese: 'food',
  chicken: 'food',
  steak: 'food',
  wine: 'food',
  beer: 'food',
  pizza: 'food',
  avocado: 'food',
  banana: 'food',
  lemon: 'food',
  pancake: 'food',
  ramen: 'food',
  seafood: 'food',
  shrimp: 'food',
  salmon: 'food',
  sandwich: 'food',
  sauce: 'food',
  sweet: 'food',
  mushroom: 'food',
  bbq: 'food',
  taco: 'food',
  donut: 'food',
  cream: 'food',
  dough: 'food',
  noodle: 'food',
  blueberry: 'food',
  raspberry: 'food',
  broccoli: 'food',
  oreo: 'food',
  chef: 'food',
  plate: 'food',
  cup: 'food',
  fresh: 'food',
  supper: 'dinner',
  jacket: 'fashion',
  shirt: 'fashion',
  shoe: 'fashion',
  suit: 'fashion',
  blazer: 'fashion',
  outfit: 'fashion',
  jewelry: 'fashion',
  vogue: 'fashion',
  gucci: 'fashion',
  sleeve: 'fashion',
  hanger: 'fashion',
  wedding: 'fashion',
  vintage: 'fashion',
  bridge: 'architecture',
  roof: 'architecture',
  structure: 'architecture',
  concrete: 'architecture',
  palace: 'architecture',
  museum: 'architecture',
  ai: 'technology',
  robot: 'technology',
  science: 'technology',
  'science fiction': 'technology',
  hacker: 'technology',
  nasa: 'technology',
  render: 'technology',
  'digital transformation': 'technology',
  'liquid cooling': 'technology',
  gaming: 'technology',
  game: 'technology',
  couple: 'people',
  group: 'people',
  baby: 'people',
  together: 'people',
  diversity: 'people',
  interview: 'business',
  communication: 'business',
  connection: 'business',
  company: 'business',
  commerce: 'business',
  career: 'business',
  customer: 'business',
  entrepreneur: 'business',
  executive: 'business',
  marketing: 'business',
  market: 'business',
  education: 'learning',
  school: 'learning',
  student: 'learning',
  zoo: 'animals',
  eagle: 'animals',
  fox: 'animals',
  deer: 'animals',
  tiger: 'animals',
  elephant: 'animals',
  bear: 'animals',
  cow: 'animals',
  frog: 'animals',
  horse: 'animals',
  monkey: 'animals',
  panda: 'animals',
  parrot: 'animals',
  peacock: 'animals',
  pigeon: 'animals',
  rabbit: 'animals',
  raccoon: 'animals',
  reptile: 'animals',
  squirrel: 'animals',
  turtle: 'animals',
  wolf: 'animals',
  flamingo: 'animals',
  giraffe: 'animals',
  leopard: 'animals',
  macaw: 'animals',
  amphibian: 'animals',
  california: 'usa',
  chicago: 'usa',
  'new york': 'usa',
  texas: 'usa',
  face: 'portrait',
  silhouetted: 'silhouette',
  silhouettes: 'silhouette',
};

/** Words that look plural but must stay intact. */
const NO_SINGULARIZE = new Set([
  'tennis',
  'business',
  'glass',
  'grass',
  'news',
  'series',
  'species',
  'electronics',
  'athletics',
  'physics',
  'mathematics',
  'cross',
  'bass',
  'gas',
  'plus',
  'bonus',
  'canvas',
  'circus',
  'focus',
  'oasis',
  'paris',
  'texas',
  'netherlands',
  'philippines',
  'maldives',
  'aerobics',
  'cosmetics',
  'goods',
  'clothes',
  'sunglasses',
]);

const IRREGULAR_SINGULAR: Record<string, string> = {
  people: 'people',
  men: 'men',
  women: 'women',
  children: 'child',
  geese: 'goose',
  mice: 'mouse',
  leaves: 'leaf',
  lives: 'life',
  wolves: 'wolf',
  knives: 'knife',
  shelves: 'shelf',
  news: 'news',
  series: 'series',
  species: 'species',
};

function singularizeWord(word: string): string {
  if (NO_SINGULARIZE.has(word)) return word;
  if (IRREGULAR_SINGULAR[word]) return IRREGULAR_SINGULAR[word];
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (
    word.endsWith('sses') ||
    word.endsWith('xes') ||
    word.endsWith('zes') ||
    word.endsWith('ches') ||
    word.endsWith('shes')
  ) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Normalize raw tag text for lookup (does not drop). */
export function normalizeTagKey(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizePhrase(tag: string): string {
  const parts = tag.split(/\s+/);
  if (parts.length === 0) return tag;
  parts[parts.length - 1] = singularizeWord(parts[parts.length - 1]!);
  return parts.join(' ');
}

/** Resolve alias chains (luxury resort → resort is one hop; keep shallow). */
function resolveAlias(key: string): string {
  let cur = key;
  for (let i = 0; i < 3; i++) {
    const next = ALIAS[cur];
    if (!next || next === cur) break;
    cur = next;
  }
  return cur;
}

/** Map one tag onto its group canonical, or null if it should be dropped. */
export function canonicalizeTag(raw: string): string | null {
  const key = normalizeTagKey(raw);
  if (!key || key.length < 2 || key.length > 32) return null;
  if (DROP.has(key)) return null;
  if (/\b(wallpaper|background|selective|shallow|close up|stock|aesthetic)\b/.test(key)) {
    return null;
  }
  if (key.split(/\s+/).length > 3) return null;

  const fromKey = resolveAlias(key);
  if (fromKey !== key) return fromKey;

  const singular = singularizePhrase(key);
  if (DROP.has(singular)) return null;
  const fromSingular = resolveAlias(singular);
  if (fromSingular !== singular) return fromSingular;
  return singular;
}

/**
 * Collapse a tag list: canonicalize, de-dupe, drop tags subsumed by a shorter
 * kept tag (e.g. drop "african safari" if "safari" is present), cap length.
 *
 * Prefer the fuller phrase when a short form aliases to it (aerial → aerial view)
 * so subsumption does not discard the canonical long form.
 */
export function groupSimilarTags(tags: string[], max = 6): string[] {
  const canonical: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const c = canonicalizeTag(raw);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    canonical.push(c);
  }

  // Drop longer tags that already contain a shorter kept tag as a whole word,
  // unless the longer tag is an ALIAS *target* (preferred fuller form).
  const preferredLong = new Set(Object.values(ALIAS));
  const kept = canonical.filter((tag, _i, all) => {
    if (preferredLong.has(tag) && tag.includes(' ')) return true;
    const words = new Set(tag.split(/\s+/));
    for (const other of all) {
      if (other === tag) continue;
      if (other.length >= tag.length) continue;
      const otherWords = other.split(/\s+/);
      if (otherWords.every((w) => words.has(w)) && otherWords.length < words.size) {
        return false;
      }
    }
    return true;
  });

  return kept.slice(0, max);
}

/** Count how many assets each tag appears on (once per asset). */
export function tagFrequencies(tagLists: string[][]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const tags of tagLists) {
    for (const t of new Set(tags)) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return freq;
}

/** Drop tags that appear on fewer than `minAssets` images. */
export function pruneRareTags(
  tags: string[],
  freq: Map<string, number>,
  minAssets = MIN_TAG_ASSETS,
): string[] {
  return tags.filter((t) => (freq.get(t) ?? 0) >= minAssets);
}

/**
 * Library-wide regroup: canonicalize/group each list, then drop tags that
 * don't meet the min-asset threshold across the corpus.
 * `protect` tags (e.g. folder/topic labels) are never pruned.
 */
export function regroupLibraryTags(
  tagLists: string[][],
  max = 6,
  minAssets = MIN_TAG_ASSETS,
  protect: Iterable<string> = [],
): { tags: string[][]; freq: Map<string, number>; pruned: string[] } {
  const protectedTags = new Set(
    [...protect].map((t) => t.trim().toLowerCase().replace(/-/g, ' ')).filter(Boolean),
  );
  const grouped = tagLists.map((tags) => {
    // Keep protected tags even when they would be DROP'd (experimental, …).
    const keptProtect: string[] = [];
    const rest: string[] = [];
    for (const raw of tags) {
      const spaced = raw.trim().toLowerCase().replace(/-/g, ' ');
      if (protectedTags.has(spaced)) {
        if (!keptProtect.includes(spaced)) keptProtect.push(spaced);
      } else {
        rest.push(raw);
      }
    }
    const groupedRest = groupSimilarTags(rest, Math.max(0, max - keptProtect.length));
    return [...keptProtect, ...groupedRest.filter((t) => !keptProtect.includes(t))].slice(0, max);
  });
  const freq = tagFrequencies(grouped);
  const pruned = [...freq.entries()]
    .filter(([t, n]) => n < minAssets && !protectedTags.has(t))
    .map(([t]) => t)
    .sort();
  const tags = grouped.map((list) =>
    list.filter((t) => protectedTags.has(t) || (freq.get(t) ?? 0) >= minAssets),
  );
  return { tags, freq, pruned };
}
