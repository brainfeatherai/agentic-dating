import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { analyzeLocally } from './analyzer.js'
import { dateLocally, rankLocally } from './dating.js'
import path from 'node:path'
import OpenAI from 'openai'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.static(path.join(process.cwd(), 'dist')))

const PORT = 3001
const DATA_DIR = path.join(process.cwd(), 'data')
const PEOPLE_FILE = path.join(DATA_DIR, 'people.json')
fs.mkdirSync(DATA_DIR, { recursive: true })

// CleanAPIs gateway — OpenAI-compatible. Defaults to the CleanAPIs key so the
// site works out of the box; set OPENAI_API_KEY to talk to OpenAI directly instead.
const CLEAN_KEY = process.env.CLEANAPIS_API_KEY || 'cc_gBpyeonAytNib7UehZMQJBxwmfdmX32CFuB3QipVjJnAXH3W'
const useOpenAiDirect = !!process.env.OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: useOpenAiDirect ? process.env.OPENAI_API_KEY! : CLEAN_KEY,
  baseURL: useOpenAiDirect ? undefined : (process.env.OPENAI_BASE_URL || 'https://cleanapis.com/v1'),
})

// CleanAPIs is OpenAI-compatible and currently reports "1 of 6 providers active",
// so any single model can 503 "No available channel" at any moment. Every role
// therefore walks a WIDE failover list and retries transient errors.
const WIDE = [
  'gpt-5.6-sol','claude-sonnet-5','kimi-k3','seed-2.1-pro','gemini-3.7-flash','grok-4.6',
  'glm-5.3','qwen3.8-max','muse-spark-1.1','gpt-5.6-terra','gemini-3.1-pro','deepseek-v4-pro-0813',
  'seed-2.1-turbo','claude-opus-5','gpt-5.5','kimi-k2.6','qwen3.8-27b','gemma-2-2b','deepseek-v4-flash-0731',
].filter(Boolean)
const list = (env: string | undefined, preferred: string[]) =>
  env ? env.split(',').map(s => s.trim()) : [...preferred, ...WIDE.filter(m => !preferred.includes(m))]

const ROLE_MODELS: Record<string, string[]> = {
  analysis: list(process.env.ANALYSIS_MODEL, ['gpt-5.6-sol', 'seed-2.1-pro']),
  date:     list(process.env.DATE_MODEL,     ['claude-sonnet-5', 'gpt-5.6-sol']),
  rank:     list(process.env.RANK_MODEL,     ['gpt-5.6-sol', 'seed-2.1-pro']),
}

/** Disk cache so the seeded demo and any repeated demo run is instant and
 *  completely independent of gateway health. */
const CACHE_DIR = path.join(DATA_DIR, 'cache')
fs.mkdirSync(CACHE_DIR, { recursive: true })
function cachePath(role: string, body: string) {
  const h = crypto.createHash('sha256').update(role + '::' + body).digest('hex').slice(0, 32)
  return path.join(CACHE_DIR, `${role}-${h}.json`)
}
function cacheGet<T>(role: string, body: string): T | null {
  try { const f = cachePath(role, body); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : null } catch { return null }
}
function cacheSet(role: string, body: string, value: unknown) {
  try { fs.writeFileSync(cachePath(role, body), JSON.stringify(value)) } catch {}
}

/** Calls CleanAPIs, walking the failover list on provider errors, with backoff. */
async function chat(role: 'analysis'|'date'|'rank', messages: any[], opts: { temperature?: number; json?: boolean; cacheKey?: string; deadlineMs?: number } = {}) {
  const ck = opts.cacheKey
  if (ck) { const hit = cacheGet<any>(role, ck); if (hit) return hit }
  // Hard deadline: the gateway can hang on a 504, and the local engine is always
  // able to answer. Never let a slow provider outlast the HTTP request.
  const budget = opts.deadlineMs ?? 12000
  const started = Date.now()
  const bail = () => Date.now() - started > budget
  let lastErr: any
  let i = 0
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  for (const model of ROLE_MODELS[role]) {
    // ONE attempt per model. The key has a low requests/minute budget, so a
    // retry storm across 19 models would burn the quota and 429 everything.
    // We stop at the first success instead.
    if (bail()) break
    if (i > 0) await sleep(400)
    i++
    try {
      const r = await openai.chat.completions.create({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: 'json_object' } as any } : {}),
      } as any)
      const content = r.choices?.[0]?.message?.content || ''
      if (!content) throw new Error('empty completion')
      if (ck) cacheSet(role, ck, content)
      return content
    } catch (e: any) {
      lastErr = e
      const msg = String(e?.message || e)
      if (!/429|503|No available channel|fetch failed|timeout|ETIMEDOUT|ECONNRESET|502/.test(msg)) break
    }
  }
  console.error(`[${role}] all ${ROLE_MODELS[role].length} models failed. last: ${String(lastErr?.message || lastErr).slice(0, 140)}`)
  throw lastErr ?? new Error('all models failed')
}

type Person = {
  id: string
  name: string
  linkedinUrl: string
  instagramUrl: string
  linkedinRaw?: string
  instagramRaw?: string
  profile?: Profile
  createdAt: string
}
type Profile = {
  needs: string[]
  hobbies: string[]
  interests: string[]
  values: string[]
  traits: string[]
  attachmentStyle: string
  loveLanguage: string
  vibe: string
  idealPartner: string
  redFlags: string[]
  bio: string
  agentPersona: string
  grounded?: { linkedinAboutChars: number; instagramCaptionsFound: number; instagramFollowers: string; matchedSignals: string[] }
  analyzedBy?: string
}

function loadPeople(): Person[] {
  if (!fs.existsSync(PEOPLE_FILE)) return []
  try { return JSON.parse(fs.readFileSync(PEOPLE_FILE, 'utf-8')) } catch { return [] }
}
function savePeople(p: Person[]) { fs.writeFileSync(PEOPLE_FILE, JSON.stringify(p, null, 2)) }
function id() { return Math.random().toString(36).slice(2, 9) }

/** Some providers wrap JSON in ```json fences or add prose. Clean it up. */
function stripFences(raw: string): string {
  let t = raw.trim()
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (f) t = f[1].trim()
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  const c = t.indexOf('['), d = t.lastIndexOf(']')
  if (a === -1 && c !== -1) return t.slice(c, d + 1)
  if (a !== -1) return t.slice(a, b + 1)
  return t
}

// --- Ego-Browser Scrape via embedded nodejs ---
async function egoScrape(url: string, site: 'linkedin'|'instagram'): Promise<string> {
  const cmd = `ego-browser nodejs -e '
const task = await taskSpace("s${site}${url.replace(/[^a-z0-9]/gi,'').slice(-20)}");
const page = task.page("p1");
await page.goto(${JSON.stringify(url)}, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4000);
const data = await page.evaluate(() => {
  const txt = document.body.innerText.slice(0,12000);
  const title = document.title;
  const meta = document.querySelector("meta[name=\\"description\\"]")?.content || "";
  const imgs = [...document.querySelectorAll("img")].slice(0,3).map(i=>i.alt||i.src).join("\\n");
  return { title, meta, txt, imgs, url: location.href };
});
console.log(JSON.stringify(data));
await task.finish({keep:[]});
' 2>&1`

  const { execSync } = await import('node:child_process')
  try {
    const out = execSync(cmd, { timeout: 45000, maxBuffer: 2_000_000 }).toString()
    // extract last JSON line
    const lines = out.trim().split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      try { const j = JSON.parse(lines[i]); if (j.txt) return `${j.title}\n${j.meta}\n${j.txt.slice(0,8000)}\n${j.imgs}` } catch {}
    }
    return out.slice(0, 8000)
  } catch (e:any) {
    return `SCRAPE_FAILED: ${String(e.message||e).slice(0,500)} URL:${url}`
  }
}

async function analyzePerson(name: string, linkedinRaw: string, instagramRaw: string, instagramUrl = ''): Promise<Profile> {
  // 1. Grounded local analysis — always runs, zero API dependency.
  const local = analyzeLocally(name, linkedinRaw, instagramRaw, instagramUrl) as any

  // 2. LLM interpretation layered on top when the gateway is healthy.
  const prompt = `You are an expert dating psychologist. Analyze this person using ONLY these two sources.

Name: ${name}
LinkedIn content:
${linkedinRaw.slice(0, 5000)}

Instagram content:
${instagramRaw.slice(0, 5000)}

Return ONLY valid JSON with this exact shape:
{
  "needs": ["3-5 emotional needs"],
  "hobbies": ["4-6 hobbies"],
  "interests": ["4-6 interests"],
  "values": ["3-4 core values"],
  "traits": ["4-5 personality traits"],
  "attachmentStyle": "secure/anxious/avoidant",
  "loveLanguage": "words of affirmation / acts of service / etc",
  "vibe": "1 sentence vibe",
  "idealPartner": "2 sentence description of ideal partner",
  "redFlags": ["2-3 incompatibilities"],
  "bio": "2 sentence bio for dating card",
  "agentPersona": "1 paragraph instruction for agent roleplaying this person on a date"
}`
  try {
    const raw = await chat('analysis', [{ role: 'user', content: prompt }], {
      temperature: 0.7, json: true,
      cacheKey: name + '|' + linkedinRaw.slice(0, 1500) + '|' + instagramRaw.slice(0, 1500),
      deadlineMs: 14000,
    })
    const j = JSON.parse(stripFences(raw))
    return {
      needs: j.needs?.length ? j.needs : local.needs,
      hobbies: j.hobbies?.length ? j.hobbies : local.hobbies,
      interests: j.interests?.length ? j.interests : local.interests,
      values: j.values?.length ? j.values : local.values,
      traits: j.traits?.length ? j.traits : local.traits,
      attachmentStyle: j.attachmentStyle || local.attachmentStyle,
      loveLanguage: j.loveLanguage || local.loveLanguage,
      vibe: j.vibe || local.vibe,
      idealPartner: j.idealPartner || local.idealPartner,
      redFlags: j.redFlags?.length ? j.redFlags : local.redFlags,
      bio: j.bio || local.bio,
      agentPersona: j.agentPersona || local.agentPersona,
      grounded: local.grounded,
      analyzedBy: 'llm+grounded',
    } as Profile
  } catch (e: any) {
    console.error('[analyze] gateway down -> grounded local analysis used')
    return { ...local, analyzedBy: 'local-grounded' } as Profile
  }
}

// --- API ---

app.get('/api/people', (_req,res)=> res.json(loadPeople()))

app.get('/api/people/:id', (req,res)=>{
  const p = loadPeople().find(x=>x.id===req.params.id)
  if(!p) return res.status(404).json({error:'not found'})
  res.json(p)
})

app.post('/api/people', async (req,res)=>{
  const { name, linkedinUrl, instagramUrl } = req.body as {name:string, linkedinUrl:string, instagramUrl:string}
  if(!linkedinUrl || !instagramUrl) return res.status(400).json({error:'linkedinUrl and instagramUrl required'})
  const people = loadPeople()
  const person: Person = { id: id(), name: name || linkedinUrl.split('/in/')[1]?.split('/')[0] || 'unknown', linkedinUrl, instagramUrl, createdAt: new Date().toISOString() }
  // scrape via ego-browser (station) — parallel
  const [liRaw, igRaw] = await Promise.all([
    egoScrape(linkedinUrl, 'linkedin'),
    egoScrape(instagramUrl, 'instagram'),
  ])
  person.linkedinRaw = liRaw
  person.instagramRaw = igRaw
  person.profile = await analyzePerson(person.name, liRaw, igRaw, instagramUrl)
  people.push(person)
  savePeople(people)
  res.json(person)
})

// re-analyze
app.post('/api/people/:id/analyze', async (req,res)=>{
  const people = loadPeople()
  const p = people.find(x=>x.id===req.params.id)
  if(!p) return res.status(404).json({error:'not found'})
  if(!p.linkedinRaw || !p.instagramRaw){
    const [liRaw, igRaw] = await Promise.all([ egoScrape(p.linkedinUrl,'linkedin'), egoScrape(p.instagramUrl,'instagram')])
    p.linkedinRaw = liRaw; p.instagramRaw = igRaw
  }
  p.profile = await analyzePerson(p.name, p.linkedinRaw!, p.instagramRaw!, p.instagramUrl)
  savePeople(people)
  res.json(p)
})

// dating: agent A dates agent B
app.post('/api/date', async (req,res)=>{
  const { aId, bId } = req.body as {aId:string,bId:string}
  const people = loadPeople()
  const a = people.find(x=>x.id===aId), b = people.find(x=>x.id===bId)
  if(!a||!b) return res.status(404).json({error:'not found'})
  if(!a.profile||!b.profile) return res.status(400).json({error:'both agents need analysis first'})

  // 1. Always produce a real, grounded date locally.
  const local = dateLocally(a.profile as any, b.profile as any, a.name, b.name)

  // 2. Let the LLM rewrite it as livelier dialogue when the gateway is healthy.
  const prompt = `Two AI agents are on a first date, each speaking for a real human. Stay strictly inside these two profiles.

AGENT A — ${a.name}: ${JSON.stringify(a.profile)}
AGENT B — ${b.name}: ${JSON.stringify(b.profile)}

Write a 10-turn alternating chat, starting with A. Be specific to their actual hobbies, interests and needs. Natural, warm, a little dry, 1-2 sentences each. Then a compatibility score 0-100 and a one-sentence verdict.

Return JSON: { "chat": [{"from":"${a.name}","text":"..."}], "score": 82, "verdict": "..." }`
  try {
    const raw = await chat('date', [{ role:'user', content: prompt }], { temperature: 0.9, json: true, cacheKey: aId + '|' + bId, deadlineMs: 10000 })
    const j = JSON.parse(stripFences(raw))
    if (Array.isArray(j.chat) && j.chat.length) {
      return res.json({ chat: j.chat, score: j.score ?? local.score, verdict: j.verdict || local.verdict, engine: 'llm' })
    }
    throw new Error('bad chat shape')
  } catch {
    res.json({ ...local, engine: 'local-grounded' })
  }
})

// rankings for a person
app.post('/api/rank', async (req,res)=>{
  const { personId } = req.body as {personId:string}
  const people = loadPeople()
  const me = people.find(x=>x.id===personId)
  if(!me) return res.status(404).json({error:'not found'})
  if(!me.profile) return res.status(400).json({error:'agent needs analysis first'})
  const others = people.filter(x=>x.id!==personId && x.profile)
  if(others.length===0) return res.json([])

  const local = rankLocally(me.profile as any, others.map(o=>({id:o.id,name:o.name,profile:o.profile as any})))

  const prompt = `Rank dating compatibility for ${me.name} against all candidates below, best first.
${me.name}: ${JSON.stringify(me.profile)}
CANDIDATES:
${others.map(o=>`ID:${o.id} NAME:${o.name} PROFILE:${JSON.stringify(o.profile)}`).join('\n').slice(0,11000)}
Return ONLY JSON: {"rankings":[{"id":"...","score":88,"reason":"one sentence"}]} sorted by score descending.`
  try {
    const raw = await chat('rank', [{role:'user', content: prompt}], { temperature: 0.3, json: true, cacheKey: 'rank|' + personId, deadlineMs: 12000 })
    let j:any = JSON.parse(stripFences(raw))
    let arr = Array.isArray(j) ? j : (j.rankings || j.results || j.ranking || [])
    if (!Array.isArray(arr) || !arr.length) throw new Error('bad rank shape')
    arr = arr.map((x:any)=> ({ ...x, name: others.find(o=>o.id===x.id)?.name || x.name || x.id }))
             .sort((a:any,b:any)=>b.score-a.score)
    return res.json(arr)
  } catch {
    res.json(local)
  }
})

app.delete('/api/people/:id', (req,res)=>{
  const people = loadPeople().filter(x=>x.id!==req.params.id)
  savePeople(people); res.json({ok:true})
})

app.post('/api/seed', (req,res)=>{
  const incoming = req.body as Person[]
  if(!Array.isArray(incoming)) return res.status(400).json({error:'array required'})
  savePeople(incoming); res.json({ok:true, count:incoming.length})
})

// SPA fallback
app.use((req,res)=> {
  const idx = path.join(process.cwd(),'dist','index.html')
  if(fs.existsSync(idx) && req.method==='GET' && !req.path.startsWith('/api')) res.sendFile(idx)
  else res.status(404).json({ok:true, api:true})
})

app.listen(PORT, ()=> console.log(`[server] http://localhost:${PORT}`))
