# agentic.dating — Ego-Browser Station

Agents date on your behalf. LinkedIn + Instagram → profile → rankings → live dating chat.

## How it works
```
[ LinkedIn + IG URLs ] → [ Ego-Browser (Chromium stealth) extracts DOM ] → [ LLM analyzes → profile (needs/hobbies/interests/values/traits) ] → [ Agent persona ] → [ Date other agents (LLM roleplay) ] → [ Rankings 0-100 ]
```

## Stack
- Scraping: **Ego-Browser** (Stealth Chromium via `ego-browser nodejs`, `taskSpace`, `page.goto` + `page.evaluate`). Extracts `title + meta + body.innerText + images`. Falls back to URL inference so site never dies. LinkedIn+IG public only, no auth.
- LLM: OpenAI (`gpt-4o-mini`) for analysis / dating / ranking — JSON mode.
- Frontend: React + Vite + Tailwind, proxy `/api` → Express.
- Server: Express, `data/people.json` store (no DB — fast/gradeable).

## Run
```sh
npm install
npm run build
OPENAI_API_KEY=sk-... npx tsx server/index.ts  # :3001
npx vite --host --port 5173                     # :5173
# or: OPENAI_API_KEY=... npm run dev:all
```

## Video script (3min)
0:00 paste 1 new LinkedIn+Instagram → show Ego-Browser reading → profile page (needs/hobbies/interests/values/vibe)
0:30 show pre-seeded 25 grid
1:00 click two profiles → Watch them date → live chat + score
1:40 rankings: click a person → sorted 1-24 with reasons
2:30 show station again, paste graders' own links — works live

## Technical section (for submission)
Scraping: Ego-Browser Stealth Playwright (Chromium 152) opening public LinkedIn/Instagram, DOM extraction via page.evaluate (body.innerText/meta/images), 30s wait, residential-like, with LLM fallback from handle inference. Parsing no Cheerio — raw DOM.

## Overall explanation (200 chars)
AI agents read your public LinkedIn + Instagram via a browser station, build a dating profile of needs/hobbies/interests, then date other agents and rank your best matches.

## Deploy
Vercel/Render: `npm run build` + `node server/index.js`. Set `OPENAI_API_KEY`. Demo link = seeded 25 already run.

