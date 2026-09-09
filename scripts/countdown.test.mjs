import test from 'node:test';
import assert from 'node:assert/strict';
import {countdownTarget,countdownSchedule,countdownRemaining,readSavedPlan,emptyPlan} from '../lib/domain.ts';

const base={id:'clock',title:'Finish',date:'2026-09-09',includeWeekends:true,includeHolidays:true,includeDaysOff:true,extraDaysOff:[]};
const remaining=(c,now,events=[])=>countdownRemaining(countdownSchedule(c,events,Date.parse(now)),Date.parse(now));
test('legacy countdowns retain their data and default to Eastern midnight',()=>{
 assert.deepEqual(readSavedPlan({...emptyPlan,countdowns:[base]}).countdowns,[base]);
 assert.equal(countdownTarget(base),Date.parse('2026-09-09T04:00:00Z'));
 assert.deepEqual(remaining(base,'2026-09-08T16:34:56Z'),{days:0,hours:11,minutes:25,seconds:4,totalSeconds:41104,reached:false,paused:false});
});
test('seconds advance, including within the target date; reached targets clamp to zero',()=>{
 const c={...base,time:'15:00'};
 assert.equal(remaining(c,'2026-09-09T18:58:59Z').totalSeconds,61);
 assert.equal(remaining(c,'2026-09-09T18:59:00Z').totalSeconds,60);
 assert.equal(remaining(c,'2026-09-09T18:59:59.500Z').totalSeconds,1);
 assert.equal(remaining(c,'2026-09-09T19:00:00Z').reached,true);
 assert.equal(remaining(c,'2026-09-10T19:00:00Z').totalSeconds,0);
});
test('excluded weekends pause the clock and resume on Monday without a jump',()=>{
 const c={...base,date:'2026-09-15',time:'12:00',includeWeekends:false};
 assert.equal(remaining(c,'2026-09-12T03:59:59Z').totalSeconds,129601);
 for(const now of ['2026-09-12T04:00:00Z','2026-09-13T21:40:59Z']){
  assert.equal(remaining(c,now).totalSeconds,129600);
  assert.equal(remaining(c,now).paused,true);
 }
 assert.equal(remaining(c,'2026-09-14T04:00:00Z').paused,false);
 assert.equal(remaining(c,'2026-09-14T04:00:01Z').totalSeconds,129599);
});
test('holiday, break ranges and custom days overlap only once; inclusion flags work',()=>{
 const events=[{kind:'holiday',date:'2026-09-07'},{kind:'day-off',date:'2026-09-07',endDate:'2026-09-08'}];
 const c={...base,date:'2026-09-10',time:'12:00',includeHolidays:false,includeDaysOff:false,extraDaysOff:['2026-09-08']};
 assert.equal(remaining(c,'2026-09-07T16:00:00Z',events).totalSeconds,129600);
 assert.equal(remaining({...c,includeDaysOff:true},'2026-09-07T16:00:00Z',events).totalSeconds,216000);
 assert.equal(remaining({...c,includeDaysOff:true,includeHolidays:true},'2026-09-07T16:00:00Z',events).totalSeconds,259200);
});
test('no eligible time remains when the target falls on an excluded day',()=>{
 const c={...base,date:'2026-09-13',time:'12:00',includeWeekends:false};
 const result=remaining(c,'2026-09-12T16:00:00Z');
 assert.equal(result.totalSeconds,0);assert.equal(result.reached,false);assert.equal(result.paused,true);
});
test('Eastern daylight-saving transitions count actual included hours',()=>{
 assert.equal(remaining({...base,date:'2027-03-15'},'2027-03-14T05:00:00Z').totalSeconds,23*3600);
 assert.equal(remaining({...base,date:'2026-11-02'},'2026-11-01T04:00:00Z').totalSeconds,25*3600);
 assert.equal(remaining({...base,date:'2027-03-16',includeWeekends:false},'2027-03-12T17:00:00Z').totalSeconds,36*3600);
 assert.throws(()=>countdownTarget({...base,date:'2027-03-14',time:'02:30'}),/skipped/);
 assert.equal(countdownTarget({...base,date:'2026-11-01',time:'01:30'}),Date.parse('2026-11-01T05:30:00Z'));
});
test('invalid times are rejected without rejecting older saved plans',()=>{
 for(const time of ['24:00','13:60','noon',''])assert.throws(()=>readSavedPlan({...emptyPlan,countdowns:[{...base,time}]}),/target date and time/);
 assert.equal(readSavedPlan({...emptyPlan,countdowns:[{...base,time:'13:45'}]}).countdowns[0].time,'13:45');
});
