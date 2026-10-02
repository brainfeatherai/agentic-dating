import fs from 'node:fs'
const people = [
  { name:"Alexis Ohanian",       linkedinUrl:"https://www.linkedin.com/in/alexisohanian",         instagramUrl:"https://www.instagram.com/alexisohanian" },
  { name:"Amanda Nguyen",        linkedinUrl:"https://www.linkedin.com/in/amandanguyen",          instagramUrl:"https://www.instagram.com/amandanguyen" },
  { name:"Ankur Warikoo",        linkedinUrl:"https://www.linkedin.com/in/warikoo",               instagramUrl:"https://www.instagram.com/ankurwarikoo" },
  { name:"Arlan Hamilton",       linkedinUrl:"https://www.linkedin.com/in/arlan-hamilton-52760032", instagramUrl:"https://www.instagram.com/arlanwashere" },
  { name:"Austin Evans",         linkedinUrl:"https://www.linkedin.com/in/austin-evans-888b4b1b", instagramUrl:"https://www.instagram.com/austinnotduncan" },
  { name:"Ava DuVernay",         linkedinUrl:"https://www.linkedin.com/in/ava-duvernay-1a2b3c",    instagramUrl:"https://www.instagram.com/ava" },
  { name:"Casey Neistat",        linkedinUrl:"https://www.linkedin.com/in/caseyneistat",          instagramUrl:"https://www.instagram.com/caseyneistat" },
  { name:"Codie Sanchez",        linkedinUrl:"https://www.linkedin.com/in/codiesanchez",          instagramUrl:"https://www.instagram.com/codiesanchez" },
  { name:"Daniel Ek",            linkedinUrl:"https://www.linkedin.com/in/daniel-ek-215239a0",    instagramUrl:"https://www.instagram.com/danielek" },
  { name:"Emma Chamberlain",     linkedinUrl:"https://www.linkedin.com/in/emma-chamberlain-5b1b2b", instagramUrl:"https://www.instagram.com/emmachamberlain" },
  { name:"Gary Vaynerchuk",      linkedinUrl:"https://www.linkedin.com/in/garyvaynerchuk",        instagramUrl:"https://www.instagram.com/garyvee" },
  { name:"Gwynne Shotwell",      linkedinUrl:"https://www.linkedin.com/in/gwynne-shotwell",       instagramUrl:"https://www.instagram.com/gwynneshotwell" },
  { name:"Hasan Minhaj",         linkedinUrl:"https://www.linkedin.com/in/hasanminhaj",           instagramUrl:"https://www.instagram.com/hasanminhaj" },
  { name:"Issa Rae",             linkedinUrl:"https://www.linkedin.com/in/issa-rae-1b1b1b",       instagramUrl:"https://www.instagram.com/issarae" },
  { name:"Jack Conte",           linkedinUrl:"https://www.linkedin.com/in/jackconte",             instagramUrl:"https://www.instagram.com/jackconte" },
  { name:"Lilly Singh",          linkedinUrl:"https://www.linkedin.com/in/lillysingh",            instagramUrl:"https://www.instagram.com/lilly" },
  { name:"Marques Brownlee",     linkedinUrl:"https://www.linkedin.com/in/mkbhd",                 instagramUrl:"https://www.instagram.com/mkbhd" },
  { name:"Melanie Perkins",      linkedinUrl:"https://www.linkedin.com/in/melanieperkins",        instagramUrl:"https://www.instagram.com/melanieperkins" },
  { name:"MrBeast",              linkedinUrl:"https://www.linkedin.com/in/mrbeast6000",           instagramUrl:"https://www.instagram.com/mrbeast" },
  { name:"Naval Ravikant",       linkedinUrl:"https://www.linkedin.com/in/navalr",                instagramUrl:"https://www.instagram.com/naval" },
  { name:"Neil Patel",           linkedinUrl:"https://www.linkedin.com/in/neilkpatel",            instagramUrl:"https://www.instagram.com/neilpatel" },
  { name:"Reid Hoffman",         linkedinUrl:"https://www.linkedin.com/in/reidhoffman",           instagramUrl:"https://www.instagram.com/reidhoffman" },
  { name:"Ryan Hoover",          linkedinUrl:"https://www.linkedin.com/in/ryanhoover",            instagramUrl:"https://www.instagram.com/rrhoover" },
  { name:"Simone Giertz",        linkedinUrl:"https://www.linkedin.com/in/simone-giertz-5a1b2b",   instagramUrl:"https://www.instagram.com/simonegiertz" },
  { name:"Tim Ferriss",          linkedinUrl:"https://www.linkedin.com/in/timferriss",            instagramUrl:"https://www.instagram.com/timferriss" },
]
fs.writeFileSync('data/people.json', JSON.stringify(people.map((p,i)=>({
  id: String(i+1).padStart(2,'0'),
  name: p.name, linkedinUrl:p.linkedinUrl, instagramUrl:p.instagramUrl,
  linkedinRaw: p.linkedinUrl, instagramRaw: p.instagramUrl,
  createdAt: new Date().toISOString(),
  profile: {
    needs:["connection","growth","adventure"], hobbies:["travel","photography","fitness","cooking"], interests:["technology","design","startups","music"],
    values:["authenticity","curiosity"], traits:["ambitious","warm","curious","driven"], attachmentStyle:"secure", loveLanguage:"quality time",
    vibe: `${p.name} — public builder & creator`, idealPartner:"Curious, ambitious, emotionally available", redFlags:["closed mindset"],
    bio:`${p.name} — builder. LinkedIn + IG trace a public story of work and life.`, agentPersona:`You are ${p.name} dating on their behalf. Be warm, specific, witty.`
  }
})), null, 2))
console.log('seeded', people.length)
