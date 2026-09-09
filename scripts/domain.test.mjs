import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countdownDays,todayISO,validDate,calendarICS,readSavedPlan,emptyPlan} from '../lib/domain.ts';
import {academicYear,discoverDistrict,discoverExams,parseDistrict,parseExams,chooseExamConsensus,examFingerprint} from './calendar-sources.mjs';
const c={id:'test',title:'Target',date:'2026-09-08',includeWeekends:true,includeHolidays:true,includeDaysOff:true,extraDaysOff:[]};
const events=[{id:'1',title:'Labor Day',date:'2026-09-07',kind:'holiday'},{id:'2',title:'No school',date:'2026-09-04',kind:'day-off'}];
test('Countdown date boundaries and exclusion combinations',()=>{
 assert.equal(countdownDays(c,events,'2026-09-04'),4);
 assert.equal(countdownDays({...c,includeWeekends:false},events,'2026-09-04'),2);
 assert.equal(countdownDays({...c,includeWeekends:false,includeHolidays:false},events,'2026-09-04'),1);
 assert.equal(countdownDays({...c,includeWeekends:false,includeHolidays:false,includeDaysOff:false,extraDaysOff:['2026-09-08']},events,'2026-09-04'),0);
 assert.equal(countdownDays({...c,date:'2026-09-04'},events,'2026-09-04'),0);
 assert.equal(countdownDays({...c,date:'2026-09-03'},events,'2026-09-04'),0);
});
test('Countdown handles leap years, overnight timezones, DST and overlapping days off',()=>{
 assert.equal(countdownDays({...c,date:'2028-03-01'},[],'2028-02-28'),2);
 assert.equal(countdownDays({...c,date:'2027-03-15'},[],'2027-03-12'),3);
 assert.equal(todayISO(new Date('2026-09-05T02:00:00Z')),'2026-09-04');
 assert.equal(validDate('2027-02-29'),false);assert.equal(validDate('2028-02-29'),true);
 assert.equal(countdownDays({...c,date:'2026-09-08',includeHolidays:false,includeDaysOff:false},[...events,{id:'3',kind:'day-off',date:'2026-09-07'}],'2026-09-06'),1);
});
test('Calendar export escapes text and uses exclusive end dates',()=>{
 const result=calendarICS([{id:'a',title:'Draft, review; finish',date:'2026-09-08',endDate:'2026-09-10',kind:'personal',note:'Line one\nLine two'}]);
 assert.ok(result.includes('DTEND;VALUE=DATE:20260911'));
 assert.ok(result.includes('SUMMARY:Draft\\, review\\; finish'));
 assert.ok(result.includes('DESCRIPTION:Line one\\nLine two'));
});
test('Calendar discovery rolls over each July without guessing document URLs',()=>{
 assert.deepEqual(academicYear(new Date('2027-06-30')),[2026,2027]);
 assert.deepEqual(academicYear(new Date('2027-07-01')),[2027,2028]);
 assert.equal(discoverDistrict('<a href="https://calendar-host.example/test.pdf">2027–2028 District Calendar</a>',[2027,2028],'https://school.example/calendar'),'https://calendar-host.example/test.pdf');
 assert.throws(()=>discoverDistrict('<p>Calendar unavailable</p>',[2027,2028],'https://school.example/calendar'),/not been published/);
 assert.deepEqual(discoverExams('<a href="/docs/may.pdf">May 2027 examination schedule</a>',2027),['https://ibo.org/docs/may.pdf']);
 assert.deepEqual(discoverExams('<a href="/old.pdf">May 2026 examination schedule</a>',2027),[]);
});
test('Unknown document formats fail instead of publishing invented dates',()=>{
 assert.throws(()=>parseDistrict(['Calendar coming soon'],[2026,2027]),/format changed/);
 assert.throws(()=>parseExams(['Exam dates to be confirmed'],2027,'https://ibo.org/'),/not the expected/);
});
test('IB timetable copies require a semantic majority match',()=>{
 const make=dates=>dates.map(date=>({date}));
 const a={source:{name:'A'},events:make(['2027-04-26','2027-05-19'])};
 const b={source:{name:'B'},events:make(['2027-05-19','2027-04-26'])};
 const c={source:{name:'C'},events:make(['2027-04-27','2027-05-19'])};
 assert.equal(examFingerprint(a.events),examFingerprint(b.events));
 assert.deepEqual(chooseExamConsensus([a,b,c]).agreement.map(result=>result.source.name),['A','B']);
 assert.deepEqual(chooseExamConsensus([a,b,{source:{name:'C'},error:'unavailable'}]).events,a.events);
 assert.throws(()=>chooseExamConsensus([a,c,{source:{name:'C'},error:'unavailable'}]),/majority match/);
});
test('IB timetable parsing handles spaced PDF date digits',()=>{
 const headings=['Friday 2 3 April','Monday 2 6 April','Tuesday 2 7 April','Wednesday 2 8 April','Thursday 29 April','Friday 30 April','Monday 3 May','Tuesday 4 May','Wednesday 5 May','Thursday 6 May'];
 const events=parseExams(['May 2027 examination schedule','FINAL VERSION','All exam zones (A, B, C)',...headings],2027,'https://ibo.org/');
 assert.equal(events.length,10);
 assert.equal(events[0].date,'2027-04-23');
 assert.equal(events.at(-1).date,'2027-05-06');
});
test('Saved plan data is checked before rendering or overwriting',()=>{
 assert.deepEqual(readSavedPlan({}),emptyPlan);
 assert.deepEqual(readSavedPlan({...emptyPlan,countdowns:[c]}).countdowns,[c]);
 assert.throws(()=>readSavedPlan({events:null}),/unsupported format/);
 assert.throws(()=>readSavedPlan({...emptyPlan,countdowns:[{...c,extraDaysOff:null}]}),/counting settings/);
 assert.throws(()=>readSavedPlan({...emptyPlan,events:[{id:'one',title:'Invalid range',kind:'personal',date:'2026-09-08',endDate:'2026-09-07'}]}),/date range/);
 assert.throws(()=>readSavedPlan({...emptyPlan,countdowns:[c,c]}),/duplicate/);
});
