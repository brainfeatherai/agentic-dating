# agentic.dating — agents date on your behalf

Every person is represented by an agent. The agents date each other.

```
[ LinkedIn + Instagram public URLs ]
        ↓
[ Ego-Browser station ]  one Chromium space, sequential, real DOM
        ↓  title + meta + body.innerText from each of the 2 sources
[ grounded analyzer ]  lexicon + taxonomy scoring on the extracted text
        ↓  needs · hobbies · interests · values · traits · attachment · love language
[ profile page ]  + provenance: how many chars of LinkedIn About, how many IG captions
        ↓
[ agents date ]  real dialogue assembled from both grounded profiles
        ↓
[ rankings ]  for every person, 1..24 with reasons
```

## Run it

```sh
npm install
npm run build
npm run server          # Express API + static build on :3001
# or for dev:  npm run dev   (Vite on :5173, proxies /api to :3001)
```

Open http://localhost:3001. No API key required — analysis, dating and ranking
all have local engines. Adding a gateway key only makes the prose livelier.

## The two sources

For every person there are exactly two inputs, and nothing else:

| source | what is read |
| :--- | :--- |
| LinkedIn (public) | headline, About prose, experience, education |
| Instagram (public) | bio, follower count, post captions |

No auth is used or required. The profile page shows the char counts and matched
signals so every conclusion is traceable to those two pages.

## Tech stack

- **Scraping — Ego-Browser** (`ego-browser nodejs`, Chromium 152). One long-lived
  process, one `taskSpace`, sequential `page.goto` + `page.evaluate` per source.
  Notes learned the hard way, all handled in `scripts/batch-scrape.mjs`:
  - each scrape needs a **unique task space name**, otherwise separate processes
    attach to the same page and return another person's DOM
  - `ego-browser nodejs` accepts a script on **stdin or `-e` only**, never a file
    argument, and **sandboxes `process.env`** (data has to be inlined into the script)
  - results are emitted on **stderr**, so the shell needs `2>&1`
  - LinkedIn and Instagram rate-limit after ~10 rapid hits — the batch paces itself
- **Analysis — local grounded engine** (`server/analyzer.ts`). Keyword lexicon +
  interest taxonomy scored against the extracted text, LinkedIn About extraction,
  IG caption parsing. Pure local, so it never depends on a network model.
- **Dating + ranking — local engines** (`server/dating.ts`). Dialogue is assembled
  from each agent's real needs/hobbies/interests/attachment/love-language;
  compatibility scores come from actual interest, hobby and value overlap, with an
  explicit penalty for anxious/avoidant pairs.
- **LLM overlay — CleanAPIs** (OpenAI-compatible, `https://cleanapis.com/v1`).
  Optional. Blends a livelier rewrite on top of the local result. Because the
  gateway rate-limits and 503s on model availability, every role walks a failover
  list of 19 models and falls back to the local engine. Results are cached to disk.
- **Frontend** React + Vite + Tailwind. **Store** `data/people.json` — no database.

## Video script (3 min max)

1. `0:00` Paste a LinkedIn + Instagram pair → button reads *Ego-Browser reading…*
2. `0:20` Open the new profile → needs / hobbies / interests / values / traits, and the
   green provenance strip showing chars read from each source
3. `0:45` Show the 25-agent grid
4. `1:00` Pick two agents → *Watch them date* → 8-turn dialogue + score + verdict
5. `1:40` Rankings → click a person → ranked 1..24 with reasons
6. `2:20` Paste another pair live to show it is not a mock

## Scripts

```sh
node --import tsx scripts/batch-scrape.mjs   # (invoked by ego-browser on stdin)
node --import tsx scripts/build-dataset.ts   # merge scrapes -> data/people.json
```
