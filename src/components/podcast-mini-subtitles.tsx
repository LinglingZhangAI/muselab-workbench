import {useEffect,useRef,useState} from 'react';
import {activePodcastCue,loadPodcastCues,subtitleClock,type PodcastCue} from '@/lib/podcast-playback';

export function PodcastMiniSubtitles({episodeId,time}:{episodeId:string;time:number}){
 const [cues,setCues]=useState<PodcastCue[]>(()=>loadPodcastCues(episodeId));
 const [status,setStatus]=useState('loading'),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const viewport=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const local=loadPodcastCues(episodeId);setCues(local);setStatus('loading');setError('');
  async function read(generate=false){
   try{
    const response=await fetch('/api/podcast-transcript?id='+encodeURIComponent(episodeId),{method:generate?'POST':'GET',signal:controller.signal});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'字幕暂时无法读取');
    const valid=Array.isArray(data.cues)&&data.cues.every((cue:PodcastCue,index:number)=>Number.isFinite(cue.start)&&Number.isFinite(cue.end)&&cue.start>=0&&cue.end>cue.start&&typeof cue.text==='string'&&(index===0||cue.start>=data.cues[index-1].start));
    if(valid&&data.cues.length)setCues(data.cues);
    setStatus(data.status||'idle');setError(data.error||'');
    if(!generate&&data.status==='idle'&&!local.length){await read(true);return;}
    if(['queued','downloading','transcribing'].includes(data.status)||data.translationStatus==='translating')timer=setTimeout(()=>void read(),3000);
   }catch(cause){if(!controller.signal.aborted){setStatus('error');setError(cause instanceof Error?cause.message:'字幕暂时无法读取');}}
  }
  void read(attempt>0);return()=>{controller.abort();clearTimeout(timer);};
 },[episodeId,attempt]);
 const active=activePodcastCue(cues,time);
 // Keep the last spoken line visible in a pause between sentences.
 let anchor=active;
 if(anchor<0&&cues.length){let low=0,high=cues.length-1;while(low<=high){const mid=(low+high)>>1;if(cues[mid].start<=time){anchor=mid;low=mid+1;}else high=mid-1;}anchor=Math.max(0,anchor);}
 useEffect(()=>{
  const container=viewport.current,line=container?.querySelector<HTMLElement>('[data-follow="true"]');
  if(container&&line){const top=container.scrollTop+line.getBoundingClientRect().top-container.getBoundingClientRect().top-container.clientHeight/2+line.clientHeight/2;container.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 },[anchor,cues.length]);
 const pending=['queued','downloading','transcribing'].includes(status);
 const message=error|| (status==='loading'?'正在读取字幕…':pending?'字幕正在生成，稍后自动显示':'本期暂无可用字幕');
 return <section className="podcast-mini-subtitles" aria-label="小窗实时字幕">
  {cues.length?<><div ref={viewport} className="podcast-mini-caption-scroll" role="region" aria-label="随播放滚动的字幕" tabIndex={0}>{cues.map((cue,index)=><p key={index} data-follow={index===anchor} className={index===active?'is-current':''}><time>{subtitleClock(cue.start)}</time><span>{cue.textZh&&<b className="podcast-caption-translation" lang="zh">{cue.textZh}</b>}<b className="podcast-caption-original">{cue.text}</b></span></p>)}</div>{error&&<p className="podcast-mini-caption-status" role="status">{error}</p>}</>:<p className="podcast-mini-caption-status" role="status">{message}</p>}
  {status==='error'&&<button className="podcast-mini-caption-retry" onClick={()=>setAttempt(value=>value+1)}>重试字幕</button>}
 </section>;
}
