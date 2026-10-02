/**
 * Pre-bake: scrape all seed people with Ego-Browser and run the grounded
 * analyzer, so the deployed demo link is instant and never depends on the
 * LLM gateway.  Run once:  node --import tsx scripts/prebake.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { analyzeLocally } from '../server/analyzer.js'

const BASE = process.cwd()
const DATA = path.join(BASE, 'data')
const SEEDS = JSON.parse(fs.readFileSync(path.join(BASE, 'scripts', 'seeds.json'), 'utf-8'))

function egoScrape(url: string): string {
  // Each scrape needs a UNIQUE task space. Reusing one name across separate
  // ego-browser processes makes them attach to the same page, so concurrent
  // (or stale) runs read each other's DOM.
  const slug = url.replace(/[^a-z0-9]/gi, '').slice(-24)
  const script = `
const task = await taskSpace("s${slug}");
const page = task.page("p1");
try{
  await page.goto(${JSON.stringify(url)}, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3500);
  const d = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="description"]')?.content || "";
    return { t: document.title, m: meta, x: document.body.innerText.slice(0,12000) };
  });
  console.log("__JSON__" + JSON.stringify(d));
}catch(e){ console.log("__JSON__" + JSON.stringify({t:"",m:"",x:"SCRAPE_FAILED: "+String(e).slice(0,200)})); }
await task.finish({keep:[]});
`
  fs.writeFileSync('/tmp/_ego_scrape.mjs', script)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = execSync('ego-browser nodejs < /tmp/_ego_scrape.mjs 2>&1', {
        timeout: 60_000, maxBuffer: 4_000_000,
      }).toString()
      const line = out.split('\n').find(l => l.includes('__JSON__'))
      if (!line) continue
      const d = JSON.parse(line.replace('__JSON__', ''))
      const text = `${d.t}\n${d.m}\n${d.x}`.slice(0, 8000)
      // guard against a stale page answering for a different URL
      if (text.length > 200 && !text.includes('SCRAPE_FAILED')) return text
    } catch { /* retry once */ }
  }
  return ''
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const out: any[] = []

for (const [i, s] of SEEDS.entries()) {
  process.stdout.write(`[${i + 1}/${SEEDS.length}] ${s.name} ... `)
  const li = egoScrape(s.linkedinUrl)
  await sleep(1500)
  const ig = egoScrape(s.instagramUrl)
  await sleep(1500)
  const profile = analyzeLocally(s.name, li, ig, s.instagramUrl)
  const ok = li.length > 200 && ig.length > 200
  console.log(`LI ${String(li.length).padStart(5)} | IG ${String(ig.length).padStart(5)} | ${ok ? 'OK' : 'THIN'}`)
  out.push({
    id: String(i + 1).padStart(2, '0'),
    name: s.name,
    linkedinUrl: s.linkedinUrl,
    instagramUrl: s.instagramUrl,
    linkedinRaw: li,
    instagramRaw: ig,
    createdAt: new Date().toISOString(),
    profile,
  })
  fs.writeFileSync(path.join(DATA, 'people.json'), JSON.stringify(out, null, 2))
}

console.log(`\nBaked ${out.length} people -> data/people.json`)
const good = out.filter(p => p.linkedinRaw.length > 200 && p.instagramRaw.length > 200).length
console.log(`Both sources scraped: ${good}/${out.length}`)