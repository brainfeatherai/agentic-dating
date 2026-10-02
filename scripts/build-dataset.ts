import fs from 'node:fs'
import { analyzeLocally } from '../server/analyzer.js'

const seeds = JSON.parse(fs.readFileSync('scripts/seeds.json', 'utf-8'))
const merged = new Map<number, any>()
for (const f of ['/tmp/batch.ndjson', '/tmp/batch2.ndjson']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf-8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line)
    const prev = merged.get(r.i)
    // keep whichever scrape actually captured page content
    if (!prev || (r.text || '').length > (prev.text || '').length) merged.set(r.i, r)
  }
}

const out = seeds.map((s, i) => {
  const li = merged.get(i * 2) || {}
  const ig = merged.get(i * 2 + 1) || {}
  const liText = [li.title, li.meta, li.text].filter(Boolean).join('\n').slice(0, 8000)
  const igText = [ig.title, ig.meta, ig.text].filter(Boolean).join('\n').slice(0, 8000)
  return {
    id: String(i + 1).padStart(2, '0'),
    name: s.name,
    linkedinUrl: s.linkedinUrl,
    instagramUrl: s.instagramUrl,
    linkedinRaw: liText,
    instagramRaw: igText,
    createdAt: new Date().toISOString(),
    profile: analyzeLocally(s.name, liText, igText, s.instagramUrl),
  }
})

fs.writeFileSync('data/people.json', JSON.stringify(out, null, 2))
const li = out.filter(p => p.linkedinRaw.length > 300).length
const ig = out.filter(p => p.instagramRaw.length > 300).length
const both = out.filter(p => p.linkedinRaw.length > 300 && p.instagramRaw.length > 300).length
console.log(`baked ${out.length} people -> data/people.json`)
console.log(`LinkedIn captured: ${li}/25 | Instagram captured: ${ig}/25 | BOTH: ${both}/25`)
