import type { DailyEntry,UserId } from '../shared/types.js';
export function recordRange(entries:DailyEntry[],userId:UserId,query:string,days:number,anchor:'today'|'latest',today:string){
 const own=entries.filter(e=>e.userId===userId&&!e.contextTags.some(t=>t.includes('继承'))&&e.localDate<=today).sort((a,b)=>a.localDate.localeCompare(b.localDate));
 const requested=query.match(/(?:最近|过去|之前|近)\s*(\d{1,3})\s*天/);
 const n=requested?Number(requested[1]):days;
 if(n<1||n>365)throw new Error('分析范围支持1至365天');
 return {days:n,end:anchor==='latest'&&own.length?own.at(-1)!.localDate:today,availableFrom:own[0]?.localDate??null,availableTo:own.at(-1)?.localDate??null,ownDays:new Set(own.map(e=>e.localDate)).size,inheritedDays:new Set(entries.filter(e=>e.userId===userId&&e.contextTags.some(t=>t.includes('继承'))).map(e=>e.localDate)).size};
}
