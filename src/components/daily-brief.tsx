import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ImagePlus,RefreshCw,X} from 'lucide-react';
import {Modal} from './dialogs';
import {BriefSymbol} from './brief-symbol';
import {HangzhouWeatherIcon} from './hangzhou-weather';
import {ReadingText} from './reading-text';
import {briefUpdatedEvent,useBriefRefresh} from '@/lib/refresh-daily-brief';
import {PodcastListenButton} from './daily-podcasts';
type Item={title:string;detail:string;status:string;threadId:string;threadTitle:string};
type Brief={date:string;updatedAt:string;work:Item[];updates:Item[];coverage:string;stale:boolean;newsCount:number};
function greeting(date:Date){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(date));return `${hour<11?'早上好':hour<13?'中午好':hour<18?'下午好':'晚上好'}`;}
export function DailyBrief({onAdd}:{onAdd:()=>void}){
 const banner=useRef<HTMLElement>(null);
 useEffect(()=>{
  const element=banner.current;if(!element)return;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,x=0,y=0,targetX=0,targetY=0,previousTime=0;
  const paint=(time:number)=>{
   const ease=1-Math.exp(-Math.min(previousTime?time-previousTime:16,64)/100);previousTime=time;
   x+=(targetX-x)*ease;y+=(targetY-y)*ease;
   const settled=Math.abs(targetX-x)+Math.abs(targetY-y)<.02;
   if(settled){x=targetX;y=targetY;}
   element.style.setProperty('--brief-glow-x',`${x.toFixed(3)}%`);
   element.style.setProperty('--brief-glow-y',`${y.toFixed(3)}%`);
   frame=settled?0:requestAnimationFrame(paint);
  };
  const animate=()=>{if(!frame){previousTime=0;frame=requestAnimationFrame(paint);}};
  const move=(event:PointerEvent)=>{
   if(event.pointerType==='touch'||reducedMotion.matches)return;
   const rect=element.getBoundingClientRect();
   targetX=((event.clientX-rect.left)/rect.width-.5)*44;
   targetY=((event.clientY-rect.top)/rect.height-.5)*40;
   animate();
  };
  const reset=()=>{targetX=0;targetY=0;animate();};
  const motionChanged=()=>{cancelAnimationFrame(frame);frame=0;x=y=targetX=targetY=0;element.style.removeProperty('--brief-glow-x');element.style.removeProperty('--brief-glow-y');};
  element.addEventListener('pointermove',move);element.addEventListener('pointerleave',reset);element.addEventListener('pointercancel',reset);reducedMotion.addEventListener('change',motionChanged);
  return()=>{cancelAnimationFrame(frame);element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',reset);element.removeEventListener('pointercancel',reset);reducedMotion.removeEventListener('change',motionChanged);};
 },[]);
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const update=()=>setNow(new Date());const timer=window.setInterval(update,60000);const visible=()=>{if(document.visibilityState==='visible')update();};document.addEventListener('visibilitychange',visible);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};},[]);
 const [brief,setBrief]=useState<Brief|null>(null);const [error,setError]=useState('');const [version,setVersion]=useState(0);const [loading,setLoading]=useState(true);const [open,setOpen]=useState(false);
 const [detailView,setDetailView]=useState<'all'|'work'>('all');
 const sync=useBriefRefresh();
 useEffect(()=>{const updated=()=>setVersion(v=>v+1);window.addEventListener(briefUpdatedEvent,updated);return()=>window.removeEventListener(briefUpdatedEvent,updated);},[]);
 function showDetails(view:'all'|'work'='all'){setDetailView(view);setOpen(true);}
 useEffect(()=>{
  let controller:AbortController|null=null;let active=true;
  const load=async()=>{controller?.abort();const request=new AbortController();controller=request;setLoading(true);try{const response=await fetch('/api/daily-brief',{signal:request.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'简报暂未生成');if(!Array.isArray(data.work)||!Array.isArray(data.updates)||!Number.isInteger(data.newsCount))throw new Error('简报数据格式异常');if(active&&!request.signal.aborted){setBrief(data);setError('');}}catch(e){if(active&&!request.signal.aborted)setError(e instanceof Error?e.message:'简报暂时无法读取');}finally{if(active&&!request.signal.aborted)setLoading(false);}};
  void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);const visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[version]);
 return <>
  <section ref={banner} className="daily-brief" aria-labelledby="daily-brief-title" aria-busy={loading}>
   <div className="brief-topline"><p>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'}).format(now)} · 你的每日简报</p><PodcastListenButton/></div>
   {brief?<h2 id="daily-brief-title"><span className="brief-line brief-greeting-line"><HangzhouWeatherIcon/>{greeting(now)}，</span><span className="brief-line">今天你<BriefSymbol kind="chat"/>推进了 <button className="brief-work-link" aria-label={`查看 ${brief.work.length} 项工作详情`} aria-haspopup="dialog" onClick={()=>showDetails('work')}><strong>{brief.work.length} 项工作</strong></button>，{brief.newsCount?<>收到了<BriefSymbol kind="mail"/><strong>{brief.newsCount} 条AI情报</strong>，</>:<>让灵感<BriefSymbol kind="mail"/>慢慢变成现实，</>}</span><span className="brief-line">{brief.updates.length?<>还有<BriefSymbol kind="bell"/><strong>{brief.updates.length} 项更新</strong>需要关注。</>:<>所有更新<BriefSymbol kind="bell"/>都已整理。</>}</span></h2>:<h2 id="daily-brief-title" className="brief-empty"><span className="brief-line brief-greeting-line"><HangzhouWeatherIcon/>{greeting(now)}，</span><span className="brief-line">{loading?'正在整理你的今日简报…':'今天的故事，等待继续。'}</span></h2>}
   <div className="brief-bottom"><div><button className="brief-detail" disabled={!brief} onClick={()=>showDetails()}>查看简报<ArrowUpRight size={12}/></button><button className="brief-refresh" disabled={loading||sync.refreshing} aria-busy={sync.refreshing} aria-label="刷新简报" onClick={()=>void sync.refresh()}><RefreshCw size={12} className={loading||sync.refreshing?'spinning':''}/></button><span className="brief-updated">{sync.refreshing?'正在同步最新记录…':brief?.stale?`${brief.date} 的记录`:brief?'更新于 '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(brief.updatedAt)):'每日整理 Codex 工作'}</span></div><button className="brief-add" onClick={onAdd}><ImagePlus size={13}/>添加素材</button></div>
   {(sync.error||error)&&<p className="brief-error" role="status">{sync.error||error}</p>}
  </section>
  <Modal open={open} onClose={()=>setOpen(false)} title={detailView==='work'?'今日工作详情':'今日 Codex 简报'} className="brief-modal"><header><div><p>{brief?.date} · DAILY BRIEF</p><h2>{detailView==='work'?'今天，推进了哪些工作':'今天，发生了什么'}</h2></div><button className="timeline-icon" aria-label={detailView==='work'?'关闭工作详情':'关闭今日简报'} onClick={()=>setOpen(false)}><X size={20}/></button></header><div className="brief-detail-scroll">{brief&&<><section><h3>推进的工作 · {brief.work.length}</h3>{brief.work.length?brief.work.map((item,index)=><BriefItem key={index} item={item}/>):<p>暂无已记录的工作。</p>}</section>{detailView==='all'&&<section><h3>需要关注 · {brief.updates.length}</h3>{brief.updates.length?brief.updates.map((item,index)=><BriefItem key={index} item={item}/>):<p>暂无需要关注的更新。</p>}</section>}<p className="brief-coverage">{brief.coverage}</p></>}</div></Modal>
 </>;
}
function BriefItem({item}:{item:Item}){return <article className="brief-item"><div><h4>{item.title}</h4><span>{item.status}</span></div><section className="reader-prose"><ReadingText text={item.detail}/></section><a href={`codex://threads/${item.threadId}`}>{item.threadTitle}<ArrowUpRight size={11}/></a></article>;}
