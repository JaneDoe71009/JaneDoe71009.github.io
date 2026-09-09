import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {academicYear,fetchOfficial,discoverDistrict,discoverExams,pdfLines,parseDistrict,parseExams,chooseExamConsensus,districtPage,ibPage,ibFallbackSources} from './calendar-sources.mjs';
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
let officialExamLinks=[],officialExamError='';
try{officialExamLinks=discoverExams(await fetchOfficial(ibPage),years[1]);}catch(error){officialExamError=error.message;}
try{
 if(officialExamLinks.length){
  const imported=parseExams(await pdfLines(await fetchOfficial(officialExamLinks[0],true)),years[1],officialExamLinks[0]);
  events=[...events.filter(e=>!e.id.startsWith('ib-may-'+years[1])),...imported];
  sources.push({name:'IB examination schedule',url:ibPage,documentUrl:officialExamLinks[0],status:'verified',checkedAt,message:'Official May '+years[1]+' exam days. Open the timetable for individual subject papers and local session details.'});
 }else{
  const fallbacks=ibFallbackSources.filter(source=>source.year===years[1]);
  if(!fallbacks.length)throw new Error('No independent timetable copies are configured for May '+years[1]+'.');
  const results=await Promise.all(fallbacks.map(async source=>{try{return {source,events:parseExams(await pdfLines(await fetchOfficial(source.documentUrl,true)),years[1],ibPage)};}catch(error){return {source,error:error.message};}}));
  const consensus=chooseExamConsensus(results);
  events=[...events.filter(e=>!e.id.startsWith('ib-may-'+years[1])),...consensus.events];
  const agreementNames=new Set(consensus.agreement.map(result=>result.source.name));
  sources.push({name:'IB examination schedule',url:ibPage,status:'cross-verified',checkedAt,message:'May '+years[1]+' final timetable cross-verified: '+consensus.agreement.length+' of '+consensus.checked+' independent IB-school copies agree on every exam day. Confirm your registered papers, exam zone, and start times with your coordinator.',references:results.map(result=>({name:result.source.name,url:result.source.pageUrl,status:agreementNames.has(result.source.name)?'agrees':'unavailable-or-different'}))});
 }
}catch(error){sources.push({...current.sources.find(s=>s.name==='IB examination schedule'),status:'needs-review',attemptedAt:checkedAt,message:'The official IB source is not available for May '+years[1]+', and independent copies could not be cross-verified. Previously verified dates are retained; confirm the current timetable with your coordinator.'});console.warn('IB:',[officialExamError,error.message].filter(Boolean).join(' / '));}
events=events.filter(e=>e.date>=years[0]+'-07-01'||!e.id.startsWith('ib-'));
const result={schoolYear,checkedAt:sources.some(s=>s.status==='verified'||s.status==='cross-verified')?checkedAt:current.checkedAt,coverageStart,coverageEnd,events,sources};
await writeFile(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({schoolYear,events:events.length,sources:sources.map(s=>({name:s.name,status:s.status}))}));
