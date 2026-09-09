'use client';
import {useEffect,useMemo,useState} from 'react';
import {countdownRemaining,countdownSchedule,todayISO,type CalendarEvent,type Countdown} from '@/lib/domain';

export function CountdownClock({countdown,events,featured=false}:{countdown:Countdown;events:CalendarEvent[];featured?:boolean}) {
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{
  const tick=()=>setNow(Date.now());
  tick();
  const interval=window.setInterval(tick,1000);
  document.addEventListener('visibilitychange',tick);
  return ()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',tick);};
 },[]);
 const day=now===null?null:todayISO(new Date(now));
 const schedule=useMemo(()=>day===null?null:countdownSchedule(countdown,events,Date.now()),[countdown,events,day]);
 const remaining=schedule&&now!==null?countdownRemaining(schedule,now):null;
 const status=!remaining?'Time remaining':remaining.reached?'Target reached':remaining.totalSeconds===0?'No included time before this target':remaining.paused?'Paused · today is excluded':'Time remaining';
 return <div className={'countdown-clock'+(featured?' featured':'')}>
  <div className="countdown-units" role="timer" aria-live="off" aria-label={countdown.title+' time remaining'}>
   {(['days','hours','minutes','seconds'] as const).map(unit=><div className="countdown-unit" key={unit}><strong>{remaining?String(remaining[unit]).padStart(unit==='days'?1:2,'0'):'—'}</strong><span>{unit}</span></div>)}
  </div>
  <p className="countdown-status">{status}</p>
 </div>;
}
