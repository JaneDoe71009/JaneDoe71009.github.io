'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { emptyPlan,readSavedPlan,validatePlan,type PersonalPlan,type HubItem } from './domain';
export function useHubData(){
 const [user,setUser]=useState<User|null>(null),[role,setRole]=useState('student'),[items,setItems]=useState<HubItem[]>([]);
 const [plan,setPlan]=useState<PersonalPlan>(emptyPlan),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [authReady,setAuthReady]=useState(false);
 const planRef=useRef(plan),sessionEpoch=useRef(0),saveQueue=useRef<Promise<void>>(Promise.resolve());
 function applyPlan(next:PersonalPlan){planRef.current=next;setPlan(next);}
 const refresh=useCallback(async()=>{ if(!supabase)return; const {data,error}=await supabase.from('content').select('*').eq('status','approved').order('created_at',{ascending:false}).limit(500); if(error){setError('Community information could not load. Please try again.');return;}setItems(data||[]);},[]);
 useEffect(()=>{
  let live=true,generation=0;
  if(!supabase){setAuthReady(true);try{const raw=localStorage.getItem('ib-device-plan');if(raw)applyPlan(readSavedPlan(JSON.parse(raw)));setReady(true);}catch{setError('Saved plans could not be read on this browser. They have not been overwritten.');}return()=>{sessionEpoch.current++;};}
  const apply=async(u:User|null)=>{
   if(!live)return;const requestGeneration=++generation;sessionEpoch.current++;setReady(false);setUser(u);setAuthReady(true);setRole('student');applyPlan(emptyPlan);
   if(u){const [r,p]=await Promise.all([supabase!.rpc('my_role'),supabase!.from('personal_plans').select('data').eq('user_id',u.id).maybeSingle()]);if(!live||requestGeneration!==generation)return;if(r.error||p.error){setError('Your saved workspace could not load. Try signing in again.');return;}else{try{applyPlan(readSavedPlan(p.data?.data||{}));setRole(r.data||'student');}catch{setError('Your saved plans have an unsupported format. They have not been overwritten.');return;}}}
   else{try{const raw=localStorage.getItem('ib-device-plan');if(raw)applyPlan(readSavedPlan(JSON.parse(raw)));}catch{setError('Saved plans could not be read. They have not been overwritten.');return;}}
   if(live)setReady(true);
  };
  supabase.auth.getSession().then(({data})=>apply(data.session?.user||null));
  const {data:subscription}=supabase.auth.onAuthStateChange((_e,s)=>{setTimeout(()=>void apply(s?.user||null),0);});
  void refresh();
  return()=>{live=false;sessionEpoch.current++;subscription.subscription.unsubscribe();};
 },[refresh]);
 const savePlan=(update:(current:PersonalPlan)=>PersonalPlan)=>{
  const epoch=sessionEpoch.current;
  const action=saveQueue.current.catch(()=>{}).then(async()=>{
   if(!ready||epoch!==sessionEpoch.current)throw new Error('Wait for your plans to finish loading, then try again.');
   const next=validatePlan(update(planRef.current));
   if(user&&supabase){const {error}=await supabase.from('personal_plans').upsert({user_id:user.id,data:next,updated_at:new Date().toISOString()});if(error)throw new Error('Your changes could not be saved. Please try again.');}
   else localStorage.setItem('ib-device-plan',JSON.stringify(next));
   if(epoch===sessionEpoch.current)applyPlan(next);
  });
  saveQueue.current=action;return action;
 };
 const submit=async(payload:Record<string,unknown>)=>{if(!supabase||!user)throw new Error('Sign in to contribute to the community.');const {data,error}=await supabase.rpc('submit_content',{p:payload});if(error)throw new Error(error.message);await refresh();return data as HubItem;};
 return {user,role,items,plan,ready,authReady,error,setError,refresh,savePlan,submit};
}
