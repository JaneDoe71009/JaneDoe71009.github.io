import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {academicYear,fetchOfficial,discoverDistrict,discoverExams,pdfLines,parseDistrict,parseExams,districtPage,ibPage} from './calendar-sources.mjs';
const path=fileURLToPath(new URL('../lib/official-calendar.json',import.meta.url));
const current=JSON.parse(await readFile(path,'utf8')),now=new Date(),years=academicYear(now),checkedAt=now.toISOString();
let events=[...current.events],coverageStart=current.coverageStart,coverageEnd=current.coverageEnd,schoolYear=current.schoolYear;
const sources=[];
const previousSchool=current.sources.find(s=>s.name==='School calendar')||{name:'School calendar',url:'',status:'verified',checkedAt:current.checkedAt};
if(!districtPage){
 sources.push({...previousSchool,name:'School calendar',url:'',message:'Official school-calendar days off. Half-days remain school days.'});
}else try{
 const html=await fetchOfficial(districtPage),documentUrl=discoverDistrict(html,years),parsed=parseDistrict(await pdfLines(await fetchOfficial(documentUrl,true)),years);
 // Only replace the school feed after successful parsing; never erase the last good calendar.
 events=[...events.filter(e=>!e.id.startsWith('school-')&&!e.id.startsWith('mps-')),...parsed.events];
 coverageStart=parsed.coverageStart;coverageEnd=parsed.coverageEnd;schoolYear=years.join('-');
 sources.push({name:'School calendar',url:'',status:'verified',checkedAt,message:schoolYear+' school days off. Half-days remain school days.'});
}catch(error){sources.push({...previousSchool,name:'School calendar',url:'',status:'needs-review',attemptedAt:checkedAt,message:'Refresh needs review: '+error.message+' Previously verified dates are retained.'});console.warn('School calendar:',error.message);}
try{
 const links=discoverExams(await fetchOfficial(ibPage),years[1]);
 if(!links.length){sources.push({name:'IB examination schedule',url:ibPage,status:'pending',checkedAt,message:'May '+years[1]+'’s final timetable is not listed on the official public schedule page yet. Confirm dates with your coordinator.'});}
 else{
  const imported=parseExams(await pdfLines(await fetchOfficial(links[0],true)),years[1],links[0]);
  events=[...events.filter(e=>!e.id.startsWith('ib-may-'+years[1])),...imported];
  sources.push({name:'IB examination schedule',url:ibPage,documentUrl:links[0],status:'verified',checkedAt,message:'Official May '+years[1]+' exam days. Open the timetable for individual subject papers and local session details.'});
 }
}catch(error){sources.push({...current.sources.find(s=>s.name==='IB examination schedule'),status:'needs-review',attemptedAt:checkedAt,message:'The official IB source could not be refreshed. Previously verified dates are retained; confirm the current timetable with your coordinator.'});console.warn('IB:',error.message);}
events=events.filter(e=>e.date>=years[0]+'-07-01'||!e.id.startsWith('ib-'));
const result={schoolYear,checkedAt:sources.some(s=>s.status==='verified')?checkedAt:current.checkedAt,coverageStart,coverageEnd,events,sources};
await writeFile(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({schoolYear,events:events.length,sources:sources.map(s=>({name:s.name,status:s.status}))}));
