const URL='https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const res=await fetch(URL);
if(!res.ok) throw new Error('fetch failed '+res.status);
const text=await res.text();
console.log('SVG bytes', text.length);
const tags=[...text.matchAll(/<(g|path|rect|line|polyline|polygon|text|tspan)\b([^>]*)>/gi)];
const interesting=[];
for(const m of tags){
  const attrs=m[2];
  const id=(attrs.match(/\bid="([^"]+)"/i)||[])[1]||'';
  const label=(attrs.match(/inkscape:label="([^"]+)"/i)||[])[1]||'';
  const title=(attrs.match(/aria-label="([^"]+)"/i)||[])[1]||'';
  if(id||label||title) interesting.push({tag:m[1],id,label,title});
}
console.log('INTERESTING',JSON.stringify(interesting.slice(0,800),null,2));
const words=[...text.matchAll(/>([^<>]{2,80})</g)].map(m=>m[1].trim()).filter(Boolean).filter(v=>/sun|deck|54|bed|living|kitchen|entry|room/i.test(v));
console.log('TEXT_MATCHES',JSON.stringify(words.slice(0,100),null,2));
