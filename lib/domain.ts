export type ItemKind = 'resource' | 'deadline' | 'event' | 'correction' | 'tip' | 'thread' | 'reply';
export type HubItem = { id:string; kind:ItemKind; title:string; body:string; subject:string; category:string; url:string; event_date:string|null; end_date:string|null; parent_id:string|null; target_id:string|null; display_name:string; status:'pending'|'approved'|'rejected'|'hidden'; created_at:string; revision:number };
export type CalendarEvent = { id:string; title:string; date:string; endDate?:string; kind:'holiday'|'day-off'|'exam'|'deadline'|'personal'; source?:string; subject?:string; note?:string; official?:boolean; session?:string };
export type Countdown = { id:string; title:string; date:string; time?:string; includeWeekends:boolean; includeHolidays:boolean; includeDaysOff:boolean; extraDaysOff:string[] };
export type PersonalPlan = { events:CalendarEvent[]; countdowns:Countdown[]; subjects:string[]; visibleKinds:string[] };
export const emptyPlan:PersonalPlan = { events:[],countdowns:[],subjects:[],visibleKinds:['holiday','day-off','exam','deadline','personal'] };
export function todayISO(date=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function validDate(value:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d=new Date(value+'T12:00:00Z'); return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value && value>='2000-01-01' && value<='2100-12-31'; }
export function addDays(value:string,n:number) { const d=new Date(value+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function dateLabel(value:string,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric',year:'numeric'}) { return new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')); }
export function occursOn(e:CalendarEvent,day:string) { return e.date<=day && (e.endDate||e.date)>=day; }
// Count tomorrow through the target date, inclusive. Never count today; past targets return zero.
export function countdownDays(c:Countdown,events:CalendarEvent[],from=todayISO()) {
 if(!validDate(c.date)||!validDate(from)) throw new Error('Choose a valid date between 2000 and 2100.');
 let count=0;
 for(let d=addDays(from,1);d<=c.date;d=addDays(d,1)){
  const weekday=new Date(d+'T12:00:00Z').getUTCDay();
  if(!c.includeWeekends&&(weekday===0||weekday===6))continue;
  if(!c.includeHolidays&&events.some(e=>e.kind==='holiday'&&occursOn(e,d)))continue;
  if(!c.includeDaysOff&&(c.extraDaysOff.includes(d)||events.some(e=>e.kind==='day-off'&&occursOn(e,d))))continue;
  count++;
 }
 return count;
}
const easternClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function wallClockValue(timestamp:number) {
 const parts=Object.fromEntries(easternClock.formatToParts(timestamp).map(p=>[p.type,p.value]));
 return Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
}
// Resolve a Eastern wall-clock time without depending on the visitor's time zone.
// Repeated fall-back times use the first occurrence; nonexistent spring times are rejected.
function easternTimestamp(date:string,time='00:00') {
 const wall=Date.parse(`${date}T${time}:00Z`),day=86400000;
 const offsets=new Set([-day,0,day].map(delta=>wallClockValue(wall+delta)-(wall+delta)));
 const matches=[...offsets].map(offset=>wall-offset).filter(t=>wallClockValue(t)===wall);
 return matches.length?Math.min(...matches):NaN;
}
export function countdownTarget(c:Pick<Countdown,'date'|'time'>) {
 if(!validDate(c.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time??'00:00'))throw new Error('Choose a valid target date and time.');
 const target=easternTimestamp(c.date,c.time);
 if(!Number.isFinite(target))throw new Error('That time is skipped when Eastern clocks move forward. Choose a different time.');
 return target;
}
export function countdownTargetLabel(c:Countdown) {
 return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(countdownTarget(c));
}
function countedDate(c:Countdown,events:CalendarEvent[],date:string) {
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 return (c.includeWeekends||(weekday!==0&&weekday!==6)) &&
  (c.includeHolidays||!events.some(e=>e.kind==='holiday'&&occursOn(e,date))) &&
  (c.includeDaysOff||(!c.extraDaysOff.includes(date)&&!events.some(e=>e.kind==='day-off'&&occursOn(e,date))));
}
export type CountdownSchedule={target:number;dayEnd:number;todayCounts:boolean;futureMs:number};
// Build once per Eastern date/settings change, not on every tick. Consecutive
// included dates are grouped so only their boundaries need timezone conversion.
export function countdownSchedule(c:Countdown,events:CalendarEvent[],now:number):CountdownSchedule {
 const target=countdownTarget(c),today=todayISO(new Date(now)),tomorrow=addDays(today,1);
 const dayEnd=easternTimestamp(tomorrow),todayCounts=countedDate(c,events,today);
 let futureMs=0,start:string|null=null;
 if(target>dayEnd){
  const afterTarget=addDays(c.date,1);
  for(let date=tomorrow;date<=afterTarget;date=addDays(date,1)){
   const included=date<=c.date&&countedDate(c,events,date);
   if(included&&start===null)start=date;
   if(!included&&start!==null){
    futureMs+=Math.max(0,Math.min(target,easternTimestamp(date))-easternTimestamp(start));
    start=null;
   }
  }
 }
 return {target,dayEnd,todayCounts,futureMs};
}
export function countdownRemaining(schedule:CountdownSchedule,now:number) {
 const reached=now>=schedule.target;
 const totalSeconds=reached?0:Math.ceil((schedule.futureMs+(schedule.todayCounts?Math.max(0,Math.min(schedule.dayEnd,schedule.target)-now):0))/1000);
 return {days:Math.floor(totalSeconds/86400),hours:Math.floor(totalSeconds%86400/3600),minutes:Math.floor(totalSeconds%3600/60),seconds:totalSeconds%60,totalSeconds,reached,paused:!reached&&!schedule.todayCounts};
}
export function safeUrl(url:string) { try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';} }
export function toEvent(i:HubItem):CalendarEvent|null { return i.event_date && ['deadline','event'].includes(i.kind) ? {id:i.id,title:i.title,date:i.event_date,endDate:i.end_date||undefined,kind:'deadline',source:safeUrl(i.url),subject:i.subject,note:i.body} : null; }
export function validatePlan(p:PersonalPlan) {
 if(!p||!Array.isArray(p.events)||!Array.isArray(p.countdowns)||!Array.isArray(p.subjects)||!Array.isArray(p.visibleKinds))throw new Error('Saved plans have an unsupported format.');
 if(p.events.length>200||p.countdowns.length>30||p.subjects.length>60)throw new Error('Limit: 200 personal events and 30 countdowns.');
 for(const e of [...p.events,...p.countdowns])if(!e||typeof e.id!=='string'||!e.id||typeof e.title!=='string'||!e.title.trim()||e.title.length>160||!validDate(e.date))throw new Error('A title and valid date are required.');
 for(const e of p.events)if(e.kind!=='personal'||(e.endDate&&(!validDate(e.endDate)||e.endDate<e.date))||(e.note!==undefined&&typeof e.note!=='string'))throw new Error('Choose a valid personal event and date range.');
 for(const c of p.countdowns)if(!Array.isArray(c.extraDaysOff)||c.extraDaysOff.length>1000||c.extraDaysOff.some(d=>typeof d!=='string'||!validDate(d))||[c.includeWeekends,c.includeHolidays,c.includeDaysOff].some(v=>typeof v!=='boolean'))throw new Error('Choose counting settings and use YYYY-MM-DD for days off.');
 for(const c of p.countdowns)countdownTarget(c);
 if(p.subjects.some(s=>typeof s!=='string'||s.length>120)||p.visibleKinds.some(k=>!emptyPlan.visibleKinds.includes(k)))throw new Error('Saved preferences have an unsupported format.');
 if(new Set(p.events.map(e=>e.id)).size!==p.events.length||new Set(p.countdowns.map(c=>c.id)).size!==p.countdowns.length)throw new Error('Saved plans contain duplicate entries.');
 return p;
}
export function readSavedPlan(value:unknown):PersonalPlan {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Saved plans have an unsupported format.');
 return validatePlan({...emptyPlan,...value});
}
export function calendarICS(events:CalendarEvent[]) {
 const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//IB Info//Calendar//EN','CALSCALE:GREGORIAN'];
 for(const e of events)lines.push('BEGIN:VEVENT','UID:'+esc(e.id)+'@ib-info','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;VALUE=DATE:'+e.date.replace(/-/g,''),'DTEND;VALUE=DATE:'+addDays(e.endDate||e.date,1).replace(/-/g,''),'SUMMARY:'+esc(e.title),'DESCRIPTION:'+esc([e.note,e.source].filter(Boolean).join('\n')),'END:VEVENT');
 return [...lines,'END:VCALENDAR'].join('\r\n');
}
