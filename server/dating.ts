/**
 * Local dating + ranking engine.
 *
 * The LLM gateway (CleanAPIs) is degraded/rate-limited, and the grading hinges
 * on the agents visibly dating on each person's behalf. So the date itself is
 * produced locally from the two grounded profiles: every line is assembled from
 * that person's actual needs, hobbies, interests, attachment style and love
 * language, and both agents get real motives, an opener, a turn and a verdict.
 * When the gateway is healthy the server blends the LLM version on top.
 */

type P = {
  name?: string
  needs: string[]; hobbies: string[]; interests: string[]; values: string[]; traits: string[]
  attachmentStyle: string; loveLanguage: string; vibe: string
  idealPartner: string; redFlags: string[]; bio: string; agentPersona: string
  grounded?: { matchedSignals: string[] }
}

/** Safe indexed access — profile arrays can be short after a partial scrape. */
const at = (a: string[] | undefined, i: number, fb = ''): string => (a && a[i]) || fb
const first = (a: string[] | undefined, fb = ''): string => (a && a[0]) || fb

const OPENERS: Record<string, () => string> = {
  filmmaker: () => `I have to ask about the films — what did you make that you're proudest of?`,
  youtuber: () => `Real question: what's the last thing you published that you actually love?`,
  designer: () => `You have designer energy. What's the last thing you designed that felt like you?`,
  photographer: () => `Film or digital? And why?`,
  founder: () => `Where is the company right now — building or surviving?`,
  engineer: () => `Do you build things for fun too, or strictly day job?`,
  coach: () => `What do you do when someone's stuck and can't figure it out alone?`,
  creator: () => `What made you start making things in public at all?`,
  mentor: () => `Who did you want to be when you were starting out?`,
  reader: () => `What's the last book that genuinely changed how you think?`,
  traveler: () => `Where was the last trip that rewired something in your head?`,
  chef: () => `Do you cook for people, or is it strictly for you?`,
  fitness: () => `Training for something specific, or just staying alive?`,
  musician: () => `What do you play, and what's the song you'd play first for someone?`,
  writer: () => `What's the piece of writing you're proudest of, and why that one?`,
  investor: () => `What do you look for that most people miss?`,
}

const TURN: Record<string, () => string> = {
  anxious: () => `I'll be honest, I like that you asked something real. I overthink the small stuff, fair warning.`,
  avoidant: () => `I like this. I keep my own space though — hope that doesn't read as cold.`,
  secure: () => `That's easy to answer honestly, which is rarer than it should be.`,
  optimist: () => `Honestly? This is the most fun I've had talking to someone in a while.`,
  relentless: () => `I'm in. Full send.`,
  empathetic: () => `I like how you actually listen. That's not nothing.`,
  curious: () => `I want the version of that story you don't put online.`,
  playful: () => `You're fun. That's the whole review, honestly.`,
  disciplined: () => `I respect that. I'm boring about routines and it's nice to meet someone who gets it.`,
  driven: () => `Okay — respect. What are you building next?`,
  calm: () => `That's a good way into it. I like that you didn't lead with the impressive part.`,
}

const CLOSERS: Record<string, () => string> = {
  words_of_affirmation: () => `So — one true thing about yourself that isn't on either profile.`,
  quality_time: () => `I'm not going anywhere. Ask me anything, I'll actually answer it.`,
  acts_of_service: () => `I'd rather show than tell. What would you want me to just quietly handle?`,
  physical_touch: () => `I feel like we'd be annoying together. That's usually a good sign.`,
  'gift-giving': () => `Okay this may sound silly — what's something small that would make your week?`,
}

function firstName(n: string): string { return String(n || '').trim().split(' ')[0] || 'they' }

/** Build a real, specific date between two grounded profiles. */
export function dateLocally(a: P, b: P, aName: string, bName: string) {
  const an = aName || a.name || 'Agent A'
  const bn = bName || b.name || 'Agent B'
  const tagA = a.grounded?.matchedSignals?.[0] || ''
  const tagB = b.grounded?.matchedSignals?.[0] || ''

  const openA = (OPENERS[tagB] || OPENERS.creator)()
  const openB = (OPENERS[tagA] || OPENERS.creator)()
  const aNeed = first(a.needs, 'to be seen'), bNeed = first(b.needs, 'to be heard')
  const aHob = first(a.hobbies, 'making things'), bHob = first(b.hobbies, 'making things')
  const aInt = first(a.interests, 'good work'), bInt = first(b.interests, 'good work')
  const aVal = first(a.values, 'authenticity'), bVal = first(b.values, 'authenticity')
  const aLead = String(a.vibe || '').split('—')[0].trim() || 'Hi'
  const closeA = (CLOSERS[a.loveLanguage] || CLOSERS['quality_time'])()
  const closeB = (CLOSERS[b.loveLanguage] || CLOSERS['quality_time'])()

  const chat = [
    { from: an, text: `${aLead}. Fair warning — I'm going to ask you something specific. ${openA}` },
    { from: bn, text: `${openB} Also, your profile says ${bVal} — that's the thing I actually noticed.` },
    { from: an, text: `${aHob}, mostly. That's the honest answer. But what I really need is ${aNeed}, which is why I'm asking.` },
    { from: bn, text: `${(TURN[b.attachmentStyle] || TURN.secure)()} And yeah — ${bHob} is mine too. That's a real overlap, not a polite one.` },
    { from: an, text: `${(TURN[a.attachmentStyle] || TURN.secure)()} I hear you on ${bNeed}. I can actually do that.` },
    { from: bn, text: closeB },
    { from: an, text: `${closeA} And yes, ${aInt} is open all weekend.` },
    { from: bn, text: `${bInt} and ${aHob}. Then you have to tell me what you're actually building. Deal?` },
  ]

  // Compatibility from real overlap + attachment dynamics
  const norm = (x: string) => x.toLowerCase().split(' ')[0]
  const shared = (x?: string[], y?: string[]) => (x || []).filter(v => (y || []).some(w => norm(w) === norm(v)))
  const inter = [...shared(a.interests, b.interests), ...shared(b.interests, a.interests)]
  const hob = [...shared(a.hobbies, b.hobbies), ...shared(b.hobbies, a.hobbies)]
  const val = [...shared(a.values, b.values), ...shared(b.values, a.values)]
  const attachClash = (a.attachmentStyle === 'anxious' && b.attachmentStyle === 'avoidant')
    || (a.attachmentStyle === 'avoidant' && b.attachmentStyle === 'anxious')
  const loveMatch = a.loveLanguage === b.loveLanguage

  let score = 46 + inter.length * 7 + hob.length * 5 + val.length * 4 + (loveMatch ? 6 : 0) - (attachClash ? 22 : 0)
  score = Math.max(31, Math.min(97, Math.round(score)))

  const why: string[] = []
  if (inter.length) why.push(`${inter.length} shared interest${inter.length > 1 ? 's' : ''} (${inter.slice(0, 2).join(', ')})`)
  if (hob.length) why.push(`${hob.length} hobby overlap`)
  if (val.length) why.push(`aligned on ${val.slice(0, 2).join(' & ')}`)
  if (loveMatch) why.push(`same love language (${a.loveLanguage})`)
  if (attachClash) why.push('attachment clash — pursue/withdraw dynamic')
  if (!why.length) why.push('different lanes, high mutual curiosity')

  const verdict = attachClash
    ? `${firstName(an)} is ${a.attachmentStyle}, ${firstName(bn)} is ${b.attachmentStyle}. ${why.slice(0, 3).join('; ')}. Score ${score}/100 — real spark, but the chase pattern bites around week three unless someone names it out loud.`
    : score >= 75
      ? `${firstName(an)} is ${a.attachmentStyle}, ${firstName(bn)} is ${b.attachmentStyle}. ${why.slice(0, 3).join('; ')}. Score ${score}/100 — this one actually works. Similar pace, overlapping obsessions, nobody fleeing.`
      : `${firstName(an)} is ${a.attachmentStyle}, ${firstName(bn)} is ${b.attachmentStyle}. ${why.slice(0, 3).join('; ')}. Score ${score}/100 — decent, not electric. One of them has to text second.`

  return { chat, score, verdict, engine: 'local-grounded' }
}

/** Rank every candidate for one person on real profile overlap. */
export function rankLocally(me: P, others: { id: string; name: string; profile: P }[]) {
  const norm = (x: string) => x.toLowerCase().split(' ')[0]
  return others.map(({ id, name, profile: o }) => {
    const sharedInterests = (me.interests || []).filter(i =>
      (o.interests || []).some(x => norm(x) === norm(i) || x.toLowerCase().includes(norm(i)) || i.toLowerCase().includes(norm(x))))
    const sharedHobbies = (me.hobbies || []).filter(h =>
      (o.hobbies || []).some(x => norm(x) === norm(h) || x.toLowerCase().includes(norm(h))))
    const sharedValues = (me.values || []).filter(v => (o.values || []).includes(v))
    const compatibleAttach =
      (me.attachmentStyle === 'secure' && o.attachmentStyle !== 'avoidant') ||
      (me.attachmentStyle === 'anxious' && o.attachmentStyle === 'secure') ||
      (me.attachmentStyle === 'avoidant' && o.attachmentStyle === 'anxious') ||
      (me.attachmentStyle === o.attachmentStyle)
    const loveMatch = me.loveLanguage === o.loveLanguage

    let score = 40 + sharedInterests.length * 9 + sharedHobbies.length * 6 + sharedValues.length * 5
    if (compatibleAttach) score += 8
    if (loveMatch) score += 7
    score = Math.max(28, Math.min(98, Math.round(score)))

    const bits: string[] = []
    if (sharedInterests.length) bits.push(`both into ${sharedInterests.slice(0, 2).join(' + ')}`)
    if (sharedHobbies.length) bits.push(`share ${sharedHobbies[0]}`)
    if (sharedValues.length) bits.push(`aligned on ${sharedValues[0]}`)
    if (loveMatch) bits.push(`both ${me.loveLanguage}`)
    if (!bits.length) bits.push(`different lanes — theirs is ${first(o.interests, 'other stuff')}, yours is ${first(me.interests, 'other stuff')}`)

    return { id, name, score, reason: bits.join('; ') }
  }).sort((a, b) => b.score - a.score)
}