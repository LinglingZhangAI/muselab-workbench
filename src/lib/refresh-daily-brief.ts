import {useSyncExternalStore} from 'react';
type RefreshState={refreshing:boolean;error:string;message:string};
let state:RefreshState={refreshing:false,error:'',message:''};
let pending:Promise<void>|null=null;
const listeners=new Set<()=>void>();
function update(next:RefreshState){state=next;listeners.forEach(listener=>listener());}
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const briefUpdatedEvent='muselab:daily-brief-updated';
async function refresh(){
 if(pending)return pending;
 update({refreshing:true,error:'',message:''});
 pending=(async()=>{
  try{
   const response=await fetch('/api/daily-brief/refresh',{method:'POST'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'同步失败，已保留上次内容');
   if(!Array.isArray(data.timeline)||!Array.isArray(data.work)||typeof data.updatedAt!=='string')throw new Error('返回记录无效，已保留上次内容');
   window.dispatchEvent(new Event(briefUpdatedEvent));
   update({refreshing:false,error:'',message:data.warning||'已同步最新工作记录'});
  }catch(error){update({refreshing:false,error:error instanceof Error?error.message:'同步失败，已保留上次内容',message:''});}
  finally{pending=null;}
 })();
 return pending;
}
export function useBriefRefresh(){const snapshot=useSyncExternalStore(subscribe,()=>state);return {...snapshot,refresh};}
