// ONE ego-browser process, ONE task space, sequential over all jobs.
// Data is inlined because `ego-browser nodejs` sandboxes process.env.
import fs from 'node:fs'

const JOBS = [{"i": 0, "url": "https://www.linkedin.com/in/alexisohanian"}, {"i": 1, "url": "https://www.instagram.com/alexisohanian"}, {"i": 2, "url": "https://www.linkedin.com/in/amandanguyen"}, {"i": 3, "url": "https://www.instagram.com/amandanguyen"}, {"i": 4, "url": "https://www.linkedin.com/in/warikoo"}, {"i": 5, "url": "https://www.instagram.com/ankurwarikoo"}, {"i": 6, "url": "https://www.linkedin.com/in/arlan"}, {"i": 7, "url": "https://www.instagram.com/arlanh"}, {"i": 8, "url": "https://www.linkedin.com/in/austin-evans-5935051"}, {"i": 9, "url": "https://www.instagram.com/austinnotduncan"}, {"i": 10, "url": "https://www.linkedin.com/in/ava-duvernay"}, {"i": 11, "url": "https://www.instagram.com/ava"}, {"i": 12, "url": "https://www.linkedin.com/in/caseyneistat"}, {"i": 13, "url": "https://www.instagram.com/caseyneistat"}, {"i": 14, "url": "https://www.linkedin.com/in/codiesanchez"}, {"i": 15, "url": "https://www.instagram.com/codiesanchez"}, {"i": 16, "url": "https://www.linkedin.com/in/daniel-ek"}, {"i": 17, "url": "https://www.instagram.com/danielek"}, {"i": 18, "url": "https://www.linkedin.com/in/emmachamberlain"}, {"i": 19, "url": "https://www.instagram.com/emmachamberlain"}, {"i": 20, "url": "https://www.linkedin.com/in/garyvaynerchuk"}, {"i": 21, "url": "https://www.instagram.com/garyvee"}, {"i": 22, "url": "https://www.linkedin.com/in/gwynne-shotwell"}, {"i": 23, "url": "https://www.instagram.com/gwynneshotwell"}, {"i": 24, "url": "https://www.linkedin.com/in/hasanminhaj"}, {"i": 25, "url": "https://www.instagram.com/hasanminhaj"}, {"i": 26, "url": "https://www.linkedin.com/in/issa-rae-540b1a43b7"}, {"i": 27, "url": "https://www.instagram.com/issarae"}, {"i": 28, "url": "https://www.linkedin.com/in/jackconte"}, {"i": 29, "url": "https://www.instagram.com/jackconte"}, {"i": 30, "url": "https://www.linkedin.com/in/lillysingh"}, {"i": 31, "url": "https://www.instagram.com/lilly"}, {"i": 32, "url": "https://www.linkedin.com/in/mkbhd"}, {"i": 33, "url": "https://www.instagram.com/mkbhd"}, {"i": 34, "url": "https://www.linkedin.com/in/melanieperkins"}, {"i": 35, "url": "https://www.instagram.com/melanieperkins"}, {"i": 36, "url": "https://www.linkedin.com/in/james-beast6000"}, {"i": 37, "url": "https://www.instagram.com/mrbeast"}, {"i": 38, "url": "https://www.linkedin.com/in/naval"}, {"i": 39, "url": "https://www.instagram.com/naval"}, {"i": 40, "url": "https://www.linkedin.com/in/neilkpatel"}, {"i": 41, "url": "https://www.instagram.com/neilpatel"}, {"i": 42, "url": "https://www.linkedin.com/in/reidhoffman"}, {"i": 43, "url": "https://www.instagram.com/reidhoffman"}, {"i": 44, "url": "https://www.linkedin.com/in/rrhoover"}, {"i": 45, "url": "https://www.instagram.com/rrhoover"}, {"i": 46, "url": "https://www.linkedin.com/in/simonegiertz"}, {"i": 47, "url": "https://www.instagram.com/simonegiertz"}, {"i": 48, "url": "https://www.linkedin.com/in/timferriss"}, {"i": 49, "url": "https://www.instagram.com/timferriss"}]
const OUT = '/tmp/batch.ndjson'
fs.writeFileSync(OUT, '')
const log = (o) => fs.appendFileSync(OUT, JSON.stringify(o) + '\n')

const task = await taskSpace('batchscrape')
const page = task.page('p1')

for (const job of JOBS) {
  let out = { i: job.i, url: job.url, title: '', meta: '', text: '', err: '' }
  try {
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(3000)
    const d = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]')?.content || ''
      return { title: document.title, meta, text: document.body.innerText.slice(0, 12000) }
    })
    out = { ...out, ...d }
  } catch (e) {
    out.err = String(e).slice(0, 160)
  }
  log(out)
}
await task.finish({ keep: [] })
