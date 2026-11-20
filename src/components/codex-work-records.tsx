import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,RefreshCw,X} from 'lucide-react';
import {Modal} from './dialogs';
import {briefUpdatedEvent,useBriefRefresh} from '@/lib/refresh-daily-brief';
import {summarizeWorkRecords,type WorkTask} from '@/lib/work-task-summary';
import {ReadingText} from './reading-text';
type RecordItem={id:string;title:string;detail:string;start:string;end:string;threadId:string;threadTitle:string;status:'已完成'};
type Records={date:string;updatedAt:string;timeline:RecordItem[];coverage:string;stale:boolean};
const time=(value:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export function CodexWorkRecords({day}:{day:string}){
 const [data,setData]=useState<Records|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [version,setVersion]=useState(0);const [selected,setSelected]=useState<WorkTask|null>(null);
 const sync=useBriefRefresh();
 useEffect(()=>{const updated=()=>setVersion(v=>v+1);window.addEventListener(briefUpdatedEvent,updated);return()=>window.removeEventListener(briefUpdatedEvent,updated);},[]);
 useEffect(()=>{let active=true;let controller:AbortController|null=null;const load=async()=>{controller?.abort();controller=new AbortController();const request=controller;setLoading(true);try{const response=await fetch('/api/daily-brief',{signal:request.signal});const result=await response.json();if(!response.ok||!Array.isArray(result.timeline))throw new Error('工作记录暂时无法读取');if(active&&!request.signal.aborted){setData(result);setError('');}}catch(e){if(active&&!request.signal.aborted)setError(e instanceof Error?e.message:'工作记录暂时无法读取');}finally{if(active&&!request.signal.aborted)setLoading(false);}};void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);const visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};},[day,version]);
 const records=summarizeWorkRecords(data?.date===day?data.timeline:[]);
 const groups=new Map<string,WorkTask[]>();for(const item of records){const hour=Number(time(item.latestStart).slice(0,2));const label=`${hour<12?'上午':hour<18?'下午':'晚上'} ${String(hour).padStart(2,'0')}:00–${String(hour+1).padStart(2,'0')}:00`;groups.set(label,[...(groups.get(label)||[]),item]);}
 return <div className="codex-work-records">
  {records.length?<div className="codex-work-scroll">{[...groups].map(([label,items])=><section className="codex-work-group" key={label}><h3>{label}</h3><ul>{items.map(item=><li key={item.id}><span className="codex-work-check" aria-label="已完成"><Check size={14}/></span><button onClick={()=>setSelected(item)}><span>{item.title}</span><small>{time(item.start)}–{time(item.end)} · {item.threadTitle}</small></button></li>)}</ul></section>)}</div>:<p className="codex-work-empty">{loading?'正在整理今天的工作…':error?'暂时无法加载工作记录':data?.date!==day?'今天的工作记录尚未同步':'今天还没有已完成的工作记录'}</p>}
  <footer className="codex-work-footer"><span>{sync.refreshing?'正在同步最新记录…':`${records.length} 项已完成${data?.date===day?' · 更新于 '+time(data.updatedAt):''}`}</span><button aria-label="刷新工作记录" disabled={loading||sync.refreshing} aria-busy={sync.refreshing} onClick={()=>void sync.refresh()}><RefreshCw size={12} className={loading||sync.refreshing?'spinning':''}/></button></footer>
  {(sync.error||error||sync.message)&&<p className="codex-work-warning" role="status">{sync.error||error||sync.message}</p>}
  <Modal open={!!selected} onClose={()=>setSelected(null)} title="Codex 工作详情" className="codex-work-modal">{selected&&<><header><h2>{selected.title}</h2><button className="timeline-icon" aria-label="关闭工作详情" onClick={()=>setSelected(null)}><X size={19}/></button></header><p className="codex-work-time">{day} · {time(selected.start)}–{time(selected.end)} · 已完成</p><p>归并 {selected.records.length} 条相关完成记录</p><div className="codex-task-evidence">{[...selected.records].reverse().map(record=><section key={record.id}><time>{time(record.start)}–{time(record.end)}</time><div className="reader-prose"><ReadingText text={record.detail}/></div></section>)}</div><a href={`codex://threads/${selected.threadId}`}>{selected.threadTitle}<ArrowUpRight size={14}/></a><p className="codex-work-coverage">按同一聊天中的产品任务归并，时间为相关记录的起止区间，不代表持续工作时长。</p></>}</Modal>
 </div>;
}
