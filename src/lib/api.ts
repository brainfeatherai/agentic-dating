export type Profile = {
  needs: string[]; hobbies: string[]; interests: string[]; values: string[]; traits: string[]
  attachmentStyle: string; loveLanguage: string; vibe: string; idealPartner: string; redFlags: string[]; bio: string; agentPersona: string
  grounded?: { linkedinAboutChars: number; instagramCaptionsFound: number; instagramFollowers: string; matchedSignals: string[] }
  analyzedBy?: string
}
export type Person = {
  id: string; name: string; linkedinUrl: string; instagramUrl: string
  linkedinRaw?: string; instagramRaw?: string; profile?: Profile; createdAt: string
}
const base = ''
export async function getPeople(): Promise<Person[]>{ const r=await fetch(`${base}/api/people`); return r.json()}
export async function addPerson(p:{name:string, linkedinUrl:string, instagramUrl:string}): Promise<Person>{
  const r=await fetch(`${base}/api/people`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p)})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getPerson(id:string): Promise<Person>{ const r=await fetch(`${base}/api/people/${id}`); return r.json()}
export async function dateAgents(aId:string,bId:string):Promise<{chat:{from:string,text:string}[],score:number,verdict:string;engine?:string}>{
  const r=await fetch(`${base}/api/date`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({aId,bId})})
  return r.json()
}
export async function getRanking(personId:string):Promise<{id:string,name:string,score:number,reason:string}[]>{
  const r=await fetch(`${base}/api/rank`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({personId})})
  return r.json()
}
