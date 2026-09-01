export const formatWon=(v:number)=>{if(!v)return '-';const e=Math.floor(v/100000000),m=Math.round((v%100000000)/10000);return `${e?`${e.toLocaleString()}억 `:''}${m?`${m.toLocaleString()}만 `:''}원`.replace(' 만','만').trim()};
export const formatPrice=formatWon;
export const parseNumber=(raw:unknown)=>{if(typeof raw==='number')return raw;const s=String(raw??'').replace(/[,\s㎡평원]/g,'');if(!s)return 0;const n=Number(s.replace(/억.*/,''));if(s.includes('억')){const after=s.split('억')[1]?.replace(/만.*/,'')||'0';return n*100000000+(Number(after)||0)*10000}return Number(s)||0};
export const formatArea=(v:number)=>v?`${v.toLocaleString(undefined,{maximumFractionDigits:2})}평`:'-';
export const pricePerPyeong=(p:{salePrice:number;landAreaPyeong:number})=>p.salePrice&&p.landAreaPyeong?p.salePrice/p.landAreaPyeong:0;
export const lines=(v:string)=>v.split(/\n|•|\*/).map(s=>s.trim()).filter(Boolean);
