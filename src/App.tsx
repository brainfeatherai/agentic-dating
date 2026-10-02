import { useEffect, useState } from 'react'
import { getPeople, addPerson, dateAgents, getRanking, type Person } from './lib/api'

function Pill({children}:{children:string}){ return <span className="px-2 py-1 text-xs bg-zinc-100 rounded-full border">{children}</span> }

function ProfileCard({p, onOpen}:{p:Person, onOpen:()=>void}){
  return <div onClick={onOpen} className="cursor-pointer rounded-2xl border bg-white p-4 hover:shadow-lg transition shadow-sm">
    <div className="font-semibold">{p.name}</div>
    <div className="text-xs text-zinc-500 truncate">{p.linkedinUrl}</div>
    <div className="text-xs text-zinc-500 truncate">{p.instagramUrl}</div>
    {p.profile && <>
      <div className="mt-2 text-sm text-zinc-700 line-clamp-2">{p.profile.bio}</div>
      <div className="mt-2 flex flex-wrap gap-1">{p.profile.traits.slice(0,3).map(t=><Pill key={t}>{t}</Pill>)}</div>
      <div className="mt-1 text-xs text-zinc-500">{p.profile.vibe}</div>
    </>}
    {!p.profile && <div className="mt-2 text-xs animate-pulse">Analyzing…</div>}
  </div>
}

export default function App(){
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Person|null>(null)
  const [ranking, setRanking] = useState<{id:string,name:string,score:number,reason:string}[]|null>(null)
  const [rankingFor, setRankingFor] = useState<string|null>(null)
  const [dateA, setDateA] = useState<string>('')
  const [dateB, setDateB] = useState<string>('')
  const [dateRes, setDateRes] = useState<null|{chat:{from:string,text:string}[],score:number,verdict:string}>(null)
  const [dating, setDating]=useState(false)

  // form
  const [name, setName]=useState('')
  const [li, setLi]=useState('')
  const [ig, setIg]=useState('')
  const [addState, setAddState]=useState('')

  async function refresh(){ setPeople(await getPeople()) }
  useEffect(()=>{ refresh() },[])

  async function handleAdd(){
    if(!li || !ig){ setAddState('Paste both links'); return }
    setLoading(true); setAddState('Ego-Browser reading LinkedIn + Instagram… (15-40s)')
    try{ const p=await addPerson({name, linkedinUrl:li, instagramUrl:ig}); setAddState('Done — agent created'); setName(''); setLi(''); setIg(''); setPeople(prev=>[...prev,p]) }
    catch(e:any){ setAddState('Failed: '+e.message)}
    finally{ setLoading(false); refresh() }
  }

  async function handleRank(pid:string){
    setRankingFor(pid); setRanking(null)
    const r=await getRanking(pid); setRanking(r)
  }
  async function handleDate(){
    if(!dateA||!dateB) return
    setDating(true); setDateRes(null)
    try{ const r=await dateAgents(dateA,dateB); setDateRes(r)} finally{ setDating(false)}
  }

  const selRanking = rankingFor ? people.find(x=>x.id===rankingFor) : null

  return <div className="min-h-screen bg-zinc-50 text-zinc-900">
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-black tracking-tight text-xl">AGENTIC<span className="text-pink-600">.</span>DATING</div>
        <div className="text-xs text-zinc-500 hidden sm:block">Ego-Browser Station · LinkedIn + Instagram → Agent → Dating</div>
        <a href="https://github.com" target="_blank" className="text-xs border px-3 py-1.5 rounded-full">GitHub</a>
      </div>
    </header>

    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* station */}
      <section className="rounded-2xl bg-white border p-5">
        <div className="font-semibold">Station — paste 2 official links</div>
        <div className="text-xs text-zinc-500">Each person = LinkedIn (public) + Instagram (public). Ego-Browser opens both, extracts, LLM builds profile. 2 sources only.</div>
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name (optional, inferred)" className="border rounded-xl px-3 py-2 text-sm"/>
          <input value={li} onChange={e=>setLi(e.target.value)} placeholder="https://linkedin.com/in/..." className="border rounded-xl px-3 py-2 text-sm"/>
          <input value={ig} onChange={e=>setIg(e.target.value)} placeholder="https://instagram.com/..." className="border rounded-xl px-3 py-2 text-sm"/>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button disabled={loading} onClick={handleAdd} className="bg-zinc-900 text-white px-5 py-2 rounded-full text-sm disabled:opacity-50">{loading?'Ego-Browser working…':'Create agent'}</button>
          <span className="text-xs text-zinc-600">{addState}</span>
          <span className="ml-auto text-xs text-zinc-500">{people.length} agents</span>
        </div>
      </section>

      {/* people grid */}
      <section>
        <div className="flex items-baseline gap-2"><h2 className="font-semibold">Agents</h2><span className="text-xs text-zinc-500">click for profile page → needs · hobbies · interests</span></div>
        {people.length===0 && <div className="mt-3 text-sm text-zinc-500 border border-dashed rounded-2xl p-8 text-center">No agents yet. Paste 25 pairs or use seed below.</div>}
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {people.map(p=><ProfileCard key={p.id} p={p} onOpen={()=>setSelected(p)} />)}
        </div>
      </section>

      {/* dating lab */}
      <section className="rounded-2xl bg-white border p-5">
        <div className="font-semibold">Agents date on their behalf — watch them</div>
        <div className="text-xs text-zinc-500">Pick two agents, click Date. LLM roleplays using only their LinkedIn+IG analysis.</div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select value={dateA} onChange={e=>setDateA(e.target.value)} className="border rounded-full px-3 py-2 text-sm">
            <option value="">Agent A</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-zinc-400">×</span>
          <select value={dateB} onChange={e=>setDateB(e.target.value)} className="border rounded-full px-3 py-2 text-sm">
            <option value="">Agent B</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleDate} disabled={dating} className="bg-pink-600 text-white px-5 py-2 rounded-full text-sm disabled:opacity-50">{dating?'Dating…':'Watch them date'}</button>
        </div>
        {dateRes && <div className="mt-4 rounded-xl border bg-zinc-50 p-4">
          <div className="flex items-center gap-2"><span className="font-semibold">Score {dateRes.score}/100</span><span className="text-xs text-zinc-600">{dateRes.verdict}</span></div>
          <div className="mt-3 space-y-2">
            {dateRes.chat.map((m,i)=><div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${i%2===0?'bg-white border':'bg-zinc-900 text-white ml-auto'}`}><span className="font-semibold text-xs opacity-70">{m.from}: </span>{m.text}</div>)}
          </div>
        </div>}
      </section>

      {/* rankings */}
      <section className="rounded-2xl bg-white border p-5">
        <div className="font-semibold">Ranking — who fits you best</div>
        <div className="text-xs text-zinc-500">For every person, ranked best → worst.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {people.map(p=><button key={p.id} onClick={()=>handleRank(p.id)} className={`px-3 py-1.5 rounded-full text-sm border ${rankingFor===p.id?'bg-zinc-900 text-white':'bg-white'}`}>{p.name}</button>)}
        </div>
        {rankingFor && <div className="mt-4">
          <div className="text-sm font-medium">Best matches for {selRanking?.name}</div>
          {!ranking && <div className="text-xs animate-pulse mt-2">Ranking…</div>}
          {ranking && <ol className="mt-2 space-y-2">
            {ranking.map((r,idx)=><li key={r.id} className="flex gap-3 items-center border rounded-xl p-3 bg-white">
              <span className="font-mono text-xs w-6">#{idx+1}</span>
              <span className="font-medium text-sm">{r.name}</span>
              <span className="text-xs bg-pink-50 border border-pink-200 px-2 py-1 rounded-full">{r.score}/100</span>
              <span className="text-xs text-zinc-600 flex-1">{r.reason}</span>
            </li>)}
          </ol>}
        </div>}
      </section>

      <footer className="text-xs text-zinc-400 pt-2">Two sources only: LinkedIn + Instagram (public). Ego-Browser station + LLM analysis (needs/hobbies/interests/values/traits) + agent dating simulation + compatibility ranking. Video: 3min max shows paste→profile→date→rankings.</footer>
    </main>

    {/* profile modal */}
    {selected && <div onClick={()=>setSelected(null)} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
      <div onClick={e=>e.stopPropagation()} className="max-w-2xl w-full max-h-[85vh] overflow-auto bg-white rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div><div className="text-xl font-bold">{selected.name}</div><a className="text-xs text-blue-600 break-all" href={selected.linkedinUrl} target="_blank">{selected.linkedinUrl}</a><div><a className="text-xs text-pink-600 break-all" href={selected.instagramUrl} target="_blank">{selected.instagramUrl}</a></div></div>
          <button onClick={()=>setSelected(null)} className="border rounded-full px-3 py-1 text-sm">Close</button>
        </div>
        {!selected.profile && <div className="mt-4 text-sm text-zinc-500">No analysis yet.</div>}
        {selected.profile && <div className="mt-4 space-y-3 text-sm">
          <div className="text-zinc-700">{selected.profile.bio}</div>
          <div className="italic text-zinc-600">“{selected.profile.vibe}” · {selected.profile.attachmentStyle} · {selected.profile.loveLanguage}</div>
          <div><span className="font-semibold">Needs</span><div className="flex flex-wrap gap-1 mt-1">{selected.profile.needs.map(x=><Pill key={x}>{x}</Pill>)}</div></div>
          <div><span className="font-semibold">Hobbies</span><div className="flex flex-wrap gap-1 mt-1">{selected.profile.hobbies.map(x=><Pill key={x}>{x}</Pill>)}</div></div>
          <div><span className="font-semibold">Interests</span><div className="flex flex-wrap gap-1 mt-1">{selected.profile.interests.map(x=><Pill key={x}>{x}</Pill>)}</div></div>
          <div><span className="font-semibold">Values & Traits</span><div className="flex flex-wrap gap-1 mt-1">{[...selected.profile.values,...selected.profile.traits].map(x=><Pill key={x}>{x}</Pill>)}</div></div>
          <div><span className="font-semibold">Ideal partner</span><div className="text-zinc-700">{selected.profile.idealPartner}</div></div>
          <div><span className="font-semibold">Red flags</span><div className="flex flex-wrap gap-1 mt-1">{selected.profile.redFlags.map(x=><span key={x} className="px-2 py-1 text-xs bg-red-50 border border-red-200 rounded-full">{x}</span>)}</div></div>
          <details className="border rounded-xl p-3 bg-zinc-50"><summary className="cursor-pointer text-xs font-semibold">Raw extracted (Ego-Browser) — proof of 2 sources</summary><div className="mt-2 text-xs whitespace-pre-wrap break-words max-h-40 overflow-auto">{String(selected.linkedinRaw||'').slice(0,2000)}</div><div className="mt-2 text-xs whitespace-pre-wrap break-words max-h-40 overflow-auto">{String(selected.instagramRaw||'').slice(0,2000)}</div></details>
          <div className="flex gap-2"><button onClick={()=>{ setDateA(selected.id); setSelected(null); window.scrollTo(0,600)}} className="bg-pink-600 text-white px-4 py-2 rounded-full text-xs">Date with this agent</button><button onClick={()=>{ handleRank(selected.id); setSelected(null)}} className="border px-4 py-2 rounded-full text-xs">Show rankings</button></div>
        </div>}
      </div>
    </div>}
  </div>
}
