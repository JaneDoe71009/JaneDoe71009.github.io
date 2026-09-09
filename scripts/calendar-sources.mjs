import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {load} from 'cheerio';
import {createHash} from 'node:crypto';
export const districtPage=process.env.SCHOOL_CALENDAR_URL||'';
export const ibPage='https://ibo.org/programmes/diploma-programme/assessment-and-exams/exam-schedule/';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
function trustedHosts(){
 const hosts=new Set(['ibo.org','www.ibo.org']);
 if(districtPage)hosts.add(new URL(districtPage).hostname);
 for(const host of (process.env.SCHOOL_CALENDAR_ALLOWED_HOSTS||'').split(','))if(host.trim())hosts.add(host.trim().toLowerCase());
 return hosts;
}
export const academicYear=(now=new Date())=>{const y=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);return [y,y+1];};
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
export async function fetchOfficial(url,binary=false){
 const hosts=trustedHosts();
 const u=new URL(url);if(u.protocol!=='https:'||!hosts.has(u.hostname))throw new Error('Unsupported calendar source host');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'IB-Info/1.0 (student calendar; official source checks)'}});
 if(!response.ok)throw new Error('Official source returned HTTP '+response.status);
 if(!hosts.has(new URL(response.url).hostname))throw new Error('Unexpected source redirect');
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>10000000)throw new Error('Source document is too large');
 return binary?bytes:new TextDecoder().decode(bytes);
}
export function discoverDistrict(html,years,base=districtPage){
 if(!base)throw new Error('School calendar source is not configured.');
 const $=load(html),matches=[];$('a[href]').each((_,a)=>{const text=$(a).text().replace(/\s+/g,' '),href=$(a).attr('href');if(text.includes(String(years[0]))&&text.includes(String(years[1]))&&/calendar/i.test(text))matches.push(new URL(href,base).href);});
 if(!matches.length)throw new Error(years.join('–')+' school calendar has not been published at the expected link.');
 return matches[0];
}
export function discoverExams(html,year){
 const $=load(html),out=[];$('a[href]').each((_,a)=>{const text=$(a).text(),href=$(a).attr('href');if(/May/i.test(text)&&text.includes(String(year))&&/examination|exam.*schedule/i.test(text))out.push(new URL(href,ibPage).href);});return [...new Set(out)];
}
export async function pdfLines(data){
 const doc=await getDocument({data,useSystemFonts:true,verbosity:0}).promise,lines=[];
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),content=await page.getTextContent(),rows=new Map();
  for(const item of content.items){if(!('str'in item))continue;const y=Math.round(item.transform[5]);const row=rows.get(y)||[];row.push([item.transform[4],item.str]);rows.set(y,row);}
  for(const [,row]of [...rows].sort((a,b)=>b[0]-a[0]))lines.push(row.sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(' ').replace(/\s+/g,' ').trim());
 }await doc.destroy();return lines;
}
export function parseDistrict(lines,years){
 let month=0,year=0,coverageStart='',coverageEnd='';const events=[];
 for(const line of lines){
  const h=line.match(new RegExp('^('+months.join('|')+') (20\\d{2})$'));if(h){month=months.indexOf(h[1])+1;year=Number(h[2]);continue;}
  const m=line.match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+(.+)$/);
  if(!m||!month||!years.includes(year))continue;
  const date=iso(year,month,Number(m[1])),endDate=m[2]?iso(year,month,Number(m[2])):undefined,description=m[3];
  if(/Start of 1\s*(?:st)?\s*Semester/i.test(description))coverageStart=date;
  if(/End of 2\s*(?:nd)?\s*Semester/i.test(description))coverageEnd=date;
  if(!/^No School:/i.test(description))continue;
  const holiday=/Labor Day|Thanksgiving Day|New Year|Good Friday|Memorial Day|Christmas Day/i.test(description);
  let title=description.replace(/^No School:\s*/i,'').replace(/Professional Development.*/i,'Staff professional development').replace('Teachers do not report','No school');
  const make=(d,end,t,k)=>({id:'school-'+id(d+t),date:d,...end?{endDate:end}:{},title:t,kind:k,official:true,note:'Official school calendar'});
  // Split the fixed-date Christmas holiday out of the documented winter-break range.
  const christmas=iso(year,12,25);
  if(month===12&&date<=christmas&&(endDate||date)>=christmas&&/Winter Break/i.test(title)){
   if(date<christmas)events.push(make(date,iso(year,12,24),title,'day-off'));
   events.push(make(christmas,undefined,'Christmas Day — winter break','holiday'));
   if((endDate||date)>christmas)events.push(make(iso(year,12,26),endDate,title,'day-off'));
  }else events.push(make(date,endDate,title,holiday?'holiday':'day-off'));
 }
 if(events.length<8||!coverageStart||!coverageEnd)throw new Error('The school calendar PDF format changed; calendar dates need review.');
 return {events,coverageStart,coverageEnd};
}
export function parseExams(lines,year,source){
 const results=new Map();
 for(const line of lines){const m=line.match(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+(April|May|June)\b/i);if(!m)continue;
 const month=months.findIndex(n=>n.toLowerCase()===m[2].toLowerCase())+1,date=iso(year,month,Number(m[1]));
 results.set(date,{id:'ib-may-'+date,title:'IB May examination session',date,kind:'exam',session:'May '+year,official:true,source,note:'Official exam day. Open the timetable for subject papers, session, and duration; confirm your own timetable with your coordinator.'});
 }
 if(results.size<10||results.size>40)throw new Error('The IB timetable format changed; exam dates need review.');
 return [...results.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
