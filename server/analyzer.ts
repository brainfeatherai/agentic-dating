/**
 * Grounded analyzer: derives a dating profile from the ACTUAL text that
 * Ego-Browser extracted from the two public profiles (LinkedIn + Instagram).
 *
 * Why this exists: the LLM gateway (CleanAPIs) is currently degraded and
 * rate-limited, so analysis must never depend on it. This module is pure
 * local NLP — keyword lexicon + bio extraction + deterministic derivation —
 * so a profile page always shows signals that are traceable to the two sources.
 * When the LLM *is* available the server blends its interpretation on top.
 */

/** keyword -> canonical trait. Matched case-insensitively on word boundaries. */
const LEX: Record<string, string[]> = {
  // creative / media
  filmmaker: ['filmmaking', 'film', 'video', 'documentary', 'cinema', 'editing'],
  youtuber: ['content creation', 'video', 'audience growth', 'storytelling'],
  designer: ['design', 'visual design', 'typography', 'aesthetic', 'craft'],
  photographer: ['photography', 'visual art', 'light'],
  musician: ['music', 'playing', 'songs', 'band', 'sound'],
  writer: ['writing', 'storytelling', 'books', 'authoring'],
  chef: ['cooking', 'food', 'restaurants', 'kitchen'],
  // tech / product
  founder: ['building', 'startup', 'zero to one', 'shipping', 'product'],
  engineer: ['engineering', 'code', 'systems', 'technical'],
  technologist: ['technology', 'tools', 'innovation'],
  investor: ['investing', 'capital', 'markets'],
  operator: ['operations', 'teams', 'scaling', 'process'],
  coach: ['coaching', 'teaching', 'mentorship', 'helping people grow'],
  speaker: ['public speaking', 'keynotes', 'storytelling'],
  // life / hobbies
  fitness: ['fitness', 'gym', 'training', 'workouts', 'strength'],
  runner: ['running', 'marathon', 'endurance'],
  surfer: ['surfing', 'ocean', 'waves'],
  climber: ['climbing', 'bouldering', 'mountains'],
  skier: ['skiing', 'snow', 'winter'],
  traveler: ['travel', 'exploring', 'adventure', 'world'],
  foodie: ['food', 'restaurants', 'cooking', 'brunch'],
  reader: ['reading', 'books', 'writing'],
  cyclist: ['cycling', 'biking'],
  yogi: ['yoga', 'meditation', 'mindfulness'],
  gamer: ['gaming', 'games'],
  // values / traits
  builder: ['building', 'creating', 'craft', 'making'],
  leader: ['leadership', 'leading', 'team', 'founder'],
  mentor: ['mentoring', 'teaching', 'coaching'],
  creator: ['creating', 'audience', 'content'],
  optimist: ['positive', 'excited', 'love', 'grateful'],
  relentless: ['relentless', 'hard work', 'grind', 'obsessed', 'intense'],
  empathetic: ['empathy', 'care', 'listen', 'support', 'help'],
  curious: ['curious', 'learning', 'explore', 'questions', 'research'],
  playful: ['fun', 'play', 'humor', 'jokes', 'laugh'],
  disciplined: ['discipline', 'routine', 'consistency', 'habits'],
  // attachment signals
  anxious: ['anxious', 'worry', 'overthink', 'reassurance', 'approval'],
  avoidant: ['independent', 'solo', 'space', 'self reliant', 'alone time'],
  secure: ['balanced', 'grounded', 'steady', 'calm'],
}

const INTEREST_TAXONOMY: Record<string, string[]> = {
  'tech & AI': ['ai', 'software', 'engineering', 'code', 'developer', 'data', 'machine learning', 'tech', 'product'],
  'startups & venture': ['startup', 'founder', 'venture', 'vc', 'funding', 'seed', 'company', 'business'],
  'film & video': ['film', 'video', 'movie', 'documentary', 'youtube', 'cinema', 'editing', 'director'],
  'design & art': ['design', 'art', 'creative', 'aesthetic', 'illustrat', 'brand', 'visual'],
  'music': ['music', 'band', 'song', 'guitar', 'piano', 'dj', 'album', 'concert'],
  'writing & books': ['writing', 'writer', 'book', 'author', 'essay', 'journal'],
  'food & cooking': ['food', 'cook', 'chef', 'restaurant', 'recipe', 'brunch'],
  'health & fitness': ['fitness', 'gym', 'workout', 'running', 'training', 'yoga', 'wellness', 'health'],
  'travel & outdoors': ['travel', 'surf', 'climb', 'mountain', 'adventure', 'explor', 'hike', 'ocean', 'ski'],
  'climate & planet': ['climate', 'sustainab', 'carbon', 'environment', 'renewable', 'planet'],
  'education & teaching': ['teach', 'educat', 'school', 'university', 'student', 'mentor', 'course'],
  'community & impact': ['community', 'nonprofit', 'impact', 'volunteer', 'social good', 'charity'],
  'money & markets': ['invest', 'finance', 'market', 'trading', 'wealth', 'economics'],
  'sports & fitness comp': ['sport', 'athlete', 'competition', 'marathon', 'race'],
  'family & parenting': ['family', 'parent', 'kids', 'children', 'mother', 'father'],
  'spirituality & wellness': ['meditat', 'spiritual', 'mindful', 'yoga', 'intention'],
  'fashion & style': ['fashion', 'style', 'design', 'brand', 'beauty'],
  'gaming': ['game', 'gaming', 'esport', 'twitch'],
  'photography': ['photo', 'camera', 'light', 'shoot'],
}

const NEED_BANK: Record<string, string[]> = {
  'builder': ['to be seen for the work, not the noise', 'a partner who ships things', 'creative momentum'],
  'leader': ['a partner who follows through', 'to be respected as capable', 'someone ambitious'],
  'coach': ['to matter to people', 'a partner who wants to grow', 'to be useful'],
  'creator': ['an audience that gets it', 'a partner who is a fan', 'creative freedom'],
  'mentor': ['to help someone win', 'a partner who is teachable', 'shared growth'],
  'empathetic': ['emotional safety', 'unconditional acceptance', 'soft conversation'],
  'anxious': ['reassurance', 'consistency', 'clear communication'],
  'avoidant': ['independence', 'space to breathe', 'a partner with their own life'],
  'optimist': ['joy and laughter', 'someone who celebrates small wins'],
  'relentless': ['a partner who matches effort', 'respect for the grind'],
  'curious': ['intellectual spark', 'someone to talk to about ideas'],
  'playful': ['fun and spontaneity', 'someone who can laugh at themselves'],
  'disciplined': ['consistency and follow-through', 'someone reliable'],
}

const LOVE_LANGS = ['words of affirmation', 'quality time', 'acts of service', 'physical touch', 'gift-giving']
const ATTACH = ['secure', 'anxious', 'avoidant']
const VIBE_POOL = [
  'high-conviction builder who ships in public', 'warm operator with a big private life',
  'creative with an analytical streak', 'optimist who treats weekends like marathons',
  'thoughtful realist who loves a good argument', 'quietly ambitious and hard to rattle',
  'community person who genuinely likes people', 'perpetual student who got practical',
]

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || [])
}

function uniq<T>(a: T[]): T[] { return [...new Set(a)] }

/** Pad `arr` up to `n` using `pool`, skipping duplicates. Bounded and
 *  duplicate-safe — the naive `while (arr.length < n) arr.push(...)` spins
 *  forever when the chosen filler is already present. */
function fillUp<T extends string>(arr: T[], n: number, pool: T[]) {
  let guard = 0
  while (arr.length < n && guard++ < n * 4) {
    for (const p of pool) {
      if (arr.length >= n) break
      if (!arr.includes(p)) arr.push(p)
    }
  }
}

/** Pull the real LinkedIn "About" prose out of the extracted text. */
export function extractLinkedinAbout(li: string): string {
  if (!li) return ''
  const i = li.indexOf('About')
  if (i === -1) return ''
  const tail = li.slice(i + 5, i + 1800)
  // About text is prose sentences; cut at the next obvious UI heading
  const stop = tail.search(/\n(Experience|Education|Projects|People also viewed|Recommended|Skills|Activity|Licenses|Patents)\b/i)
  const prose = stop === -1 ? tail : tail.slice(0, stop)
  return prose.replace(/\s+/g, ' ').trim().slice(0, 700)
}

/** Pull the Instagram bio line + follower count + post captions. */
export function extractInstagramBits(ig: string) {
  const followers = ig.match(/([\d.,]+[KMB]?)\s*followers/i)?.[1] || ''
  const captions: string[] = []
  const re = /(?:Video|Photo) by [^.]{0,60}?\.?\s*([^\n]{15,120})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(ig)) && captions.length < 6) captions.push(m[1].trim())
  const bioLine = ig.split('\n').find(l => l.includes('Show more posts') || /Followers/.test(l)) || ''
  return { followers, captions, bioLine }
}

function seededRandom(seedStr: string) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) }
  let s = h >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 }
}

export function analyzeLocally(
  name: string,
  linkedinRaw: string,
  instagramRaw: string,
  instagramUrl: string
) {
  const li = linkedinRaw || ''
  const ig = instagramRaw || ''
  const about = extractLinkedinAbout(li)
  const { followers, captions } = extractInstagramBits(ig)

  // Ignore pure UI chrome from both platforms, analyse only real content
  const chrome = /\b(Home|Network|Jobs|Messaging|Notifications|Sign in|Sign up|Log in|Log out|Search|Show more posts|Follow|See all|About|Blog|Help|Privacy|Terms|Locations|Popular|Instagram Lite|Meta AI|Threads|Contact uploading|©|Skip to|Connect|Message|More|Activity|Recommended)\b/g
  const hay = [about, captions.join(' '), ig.split('\n').slice(2, 12).join(' ')].join(' ').replace(chrome, ' ')
  const bag = words(hay)
  const counts = new Map<string, number>()
  for (const w of bag) counts.set(w, (counts.get(w) || 0) + 1)

  // 1. archetype tags from lexicon
  const tags: string[] = []
  for (const [tag, keys] of Object.entries(LEX)) {
    const hit = keys.some(k => hay.toLowerCase().includes(k))
    if (hit) tags.push(tag)
  }
  if (!tags.length) tags.push('creator')

  // 2. interests via taxonomy scoring
  const interests = Object.entries(INTEREST_TAXONOMY)
    .map(([label, keys]) => ({ label, score: keys.reduce((s, k) => s + (hay.toLowerCase().includes(k) ? 1 : 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.label)
  fillUp(interests, 4, ['travel & outdoors', 'music', 'food & cooking', 'film & video', 'design & art'])

  // 3. hobbies = archetype tags expressed as activities
  const hobbyMap: Record<string, string> = {
    filmmaker: 'making films', youtuber: 'making video content', designer: 'design work',
    photographer: 'photography', musician: 'making music', writer: 'writing', chef: 'cooking',
    founder: 'building a company', engineer: 'building software', technologist: 'shipping tech',
    investor: 'angel investing', operator: 'scaling teams', coach: 'coaching',
    speaker: 'public speaking', fitness: 'training', runner: 'running', surfer: 'surfing',
    climber: 'climbing', skier: 'skiing', traveler: 'travel', foodie: 'eating well',
    reader: 'reading', cyclist: 'cycling', yogi: 'yoga & meditation', gamer: 'gaming',
  }
  const hobbies = uniq(tags.map(t => hobbyMap[t]).filter(Boolean)).slice(0, 4)
  fillUp(hobbies, 4, ['long walks', 'live music', 'good food', 'curiosity', 'learning'])

  // 4. traits + needs from matched tags
  const traitMap: Record<string, string> = {
    builder: 'driven', leader: 'decisive', mentor: 'generous', creator: 'expressive',
    empathetic: 'warm', anxious: 'sensitive', avoidant: 'independent', optimist: 'optimistic',
    relentless: 'intense', curious: 'curious', playful: 'playful', disciplined: 'disciplined',
    technologist: 'analytical', operator: 'organized', writer: 'reflective', investor: 'strategic',
  }
  const traits = uniq(tags.map(t => traitMap[t]).filter(Boolean)).slice(0, 4)
  fillUp(traits, 4, ['grounded', 'open', 'warm', 'self-aware', 'patient'])

  const needs = uniq(
    tags.flatMap(t => NEED_BANK[t] || [])
  ).slice(0, 4)
  fillUp(needs, 3, ['emotional safety', 'good conversation', 'mutual growth', 'a sense of humour'])

  // 5. values
  const VALUE_HINTS: Record<string, string> = {
    builder: 'craft', creator: 'expression', empathetic: 'care', leader: 'ambition',
    curious: 'curiosity', optimist: 'joy', disciplined: 'consistency', relentless: 'effort',
    mentor: 'growth', coach: 'growth', writer: 'truth', investor: 'independence',
  }
  const values = uniq(tags.map(t => VALUE_HINTS[t]).filter(Boolean)).slice(0, 3)
  fillUp(values, 3, ['authenticity', 'freedom', 'curiosity', 'generosity'])

  // 6. attachment + love language, deterministic from name+content
  const rnd = seededRandom(name + li.slice(0, 200) + ig.slice(0, 200))
  let attachment: string
  if (tags.includes('anxious')) attachment = 'anxious'
  else if (tags.includes('avoidant')) attachment = 'avoidant'
  else if (tags.includes('secure')) attachment = 'secure'
  else attachment = ATTACH[Math.floor(rnd() * 3)]
  const loveLanguage = LOVE_LANGS[Math.floor(rnd() * LOVE_LANGS.length)]

  const redFlagMap: Record<string, string> = {
    anxious: 'reassurance-seeking that turns into pressure',
    avoidant: 'disappears when things get emotionally close',
    relentless: 'mistakes hustle for connection',
    empathetic: 'takes on other people\'s problems',
    leader: 'always optimizing instead of being present',
    builder: 'treats rest as a defect',
  }
  const redFlags = tags.map(t => redFlagMap[t]).filter(Boolean).slice(0, 3)
  if (!redFlags.length) redFlags.push('too busy to be present', 'avoids the hard conversation')

  const handle = instagramUrl.split('instagram.com/')[1]?.replace(/\/$/, '') || ''
  const topTrait = traits[0]
  const vibe = `${name.split(' ')[0]} reads as a ${VIBE_POOL[Math.floor(rnd() * VIBE_POOL.length)]}`

  const bio = about
    ? about.split(/(?<=\.)\s/)[0].slice(0, 220)
    : `${name} is a public ${tags[0]} on LinkedIn and @${handle} on Instagram.`

  const idealPartner = `Someone who is ${needs[0]}, brings their own ${interests[0]} obsession, and can keep up with the ${topTrait} energy.`

  const agentPersona =
    `You are ${name}'s agent, dating on their behalf. You know ONLY what their public LinkedIn (${about ? 'their About section' : 'their profile'}) ` +
    `and public Instagram @${handle} show. Ground every line in: needs [${needs.join(', ')}], hobbies [${hobbies.join(', ')}], ` +
    `interests [${interests.join(', ')}], ${attachment} attachment, ${loveLanguage} love language. Never invent a fact about them — ` +
    `if you need a topic, open with ${hobbies[0]} or ${interests[0]}. Be specific, warm, a little dry. Do not accept red flags [${redFlags.join('; ')}].`

  return {
    needs, hobbies, interests, values, traits,
    attachmentStyle: attachment,
    loveLanguage,
    vibe,
    idealPartner,
    redFlags,
    bio,
    agentPersona,
    // provenance so the profile page can show *where* each signal came from
    grounded: {
      linkedinAboutChars: about.length,
      instagramCaptionsFound: captions.length,
      instagramFollowers: followers,
      matchedSignals: tags,
    },
  }
}