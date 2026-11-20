import {useEffect,useRef,useState} from 'react';
import {ArrowUp,Check,ChevronDown,Download,LoaderCircle,MessageSquare,Plus} from 'lucide-react';
import {useNotes} from '@/lib/notes';
import type {NoteImage} from '@/lib/note-images';
import {articleLink} from '@/lib/article-link';

type Job={id:string;status:'reading'|'writing'|'completed'|'failed';message:string;url:string;createdAt:string;completedAt?:string;title?:string;body?:string;sourceTitle?:string;images?:NoteImage[]};
const savedJobKey='muselab-note-rewrite:v1';
const example='https://mp.weixin.qq.com/s/vOd0HrmfgOCPbj4CfsddsQ';
export function NoteCodex(){
 const store=useNotes();const storeRef=useRef(store);storeRef.current=store;
 const [open,setOpen]=useState(false);const [url,setUrl]=useState('');const [requirements,setRequirements]=useState('');const [job,setJob]=useState<Job|null>(null);const [error,setError]=useState('');const [submitting,setSubmitting]=useState(false);
 const [jobId,setJobId]=useState(()=>{try{return localStorage.getItem(savedJobKey)||'';}catch{return '';}});
 const [sourceText,setSourceText]=useState('');const [manual,setManual]=useState(false);
 let publicLink='';try{publicLink=articleLink(url||job?.url||'');}catch{/* Wait for a complete public link. */}
 useEffect(()=>{if(job?.status==='failed'){setManual(true);setUrl(value=>value||job.url);}},[job?.id,job?.status]);
 const imported=useRef('');const busy=submitting||job?.status==='reading'||job?.status==='writing';
 useEffect(()=>{
  if(jobId)return;let cancelled=false;
  void fetch('/api/note-rewrite?latest=1').then(response=>response.ok?response.json():null).then(result=>{if(cancelled||!result?.id)return;setJobId(result.id);try{localStorage.setItem(savedJobKey,result.id);}catch{/* Local server retains the document. */}}).catch(()=>{});
  return()=>{cancelled=true;};
 },[jobId]);
 useEffect(()=>{
  if(!jobId)return;let cancelled=false;let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   try{
    const response=await fetch('/api/note-rewrite?id='+encodeURIComponent(jobId),{signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'暂时无法读取改写进度');if(cancelled)return;
    setJob(result);setError('');
    if(result.status==='reading'||result.status==='writing')timer=setTimeout(poll,1800);
   }catch(e){if(cancelled)return;setError(e instanceof Error?e.message:'连接中断，正在重连');timer=setTimeout(poll,5000);}
  }
  void poll();return()=>{cancelled=true;clearTimeout(timer);};
 },[jobId]);
 useEffect(()=>{
  if(job?.status!=='completed'||!job.title||!job.body||imported.current===job.id||!store.readable)return;
  try{if(localStorage.getItem('muselab-rewrite-imported:'+job.id)){imported.current=job.id;return;}}catch{/* Import remains idempotent by note id. */}
  const success=store.importArticle({id:'rewrite-'+job.id,title:job.title,body:job.body,createdAt:job.completedAt||job.createdAt,updatedAt:job.completedAt||job.createdAt,source:{title:job.sourceTitle||'文章原文',url:job.url,quote:''},...(job.images?.length?{images:job.images}:{})});
  if(success){imported.current=job.id;try{localStorage.setItem('muselab-rewrite-imported:'+job.id,'1');}catch{/* Import remains idempotent by note id. */}}
 },[job,store.readable]);
 async function send(){
  if(busy||!url.trim())return;setSubmitting(true);setError('');
  try{
   const response=await fetch('/api/note-rewrite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:articleLink(url),requirements:requirements.trim(),...(sourceText.trim()?{sourceText:sourceText.trim()}:{})}),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'暂时无法开始改写');setJob(result);setJobId(result.id);try{localStorage.setItem(savedJobKey,result.id);}catch{/* The document is still saved by the server. */}
  }catch(e){setError(e instanceof Error?e.message:'连接中断，请重试');}finally{setSubmitting(false);}
 }
 return <section className={'note-codex'+(open?' is-open':'')} aria-label="Codex 文章助手">
  <button className="note-codex-toggle" aria-expanded={open} aria-controls="note-codex-panel" onClick={()=>setOpen(value=>!value)}><MessageSquare size={14}/><span>与 Codex 对话</span><small>把公开链接写成文章</small>{busy?<LoaderCircle size={13} className="is-spinning"/>:<ChevronDown size={14}/>}</button>
  {open&&<div id="note-codex-panel" className="note-codex-panel">
   {job&&<div className={'note-codex-message '+job.status} role="status">{busy?<LoaderCircle size={14} className="is-spinning"/>:job.status==='completed'?<Check size={14}/>:null}<div><p>{job.status==='completed'?'已存为新笔记':job.message}</p>{job.title&&<span>{job.title}</span>}{job.status==='completed'&&<div className="note-codex-result"><button onClick={()=>storeRef.current.select('rewrite-'+job.id)}>查看笔记</button><a href={'/api/note-rewrite?id='+job.id+'&download=1'} download><Download size={12}/>下载文档</a></div>}</div></div>}
   <form onSubmit={event=>{event.preventDefault();void send();}}>
    <label className="sr-only" htmlFor="note-rewrite-url">公开网页链接</label><input id="note-rewrite-url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={url} maxLength={3000} disabled={busy} placeholder="粘贴公开链接，支持公众号、新闻、博客、文档" onChange={e=>{setUrl(e.target.value);setSourceText('');}}/>
    <label className="sr-only" htmlFor="note-rewrite-requirements">改写要求</label><textarea id="note-rewrite-requirements" rows={2} maxLength={2000} disabled={busy} value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="也可以补充要求，比如：写给产品经理，讲清这件事为什么值得关注"/>
    <div className="note-codex-result"><button type="button" disabled={!!busy} aria-expanded={manual} aria-controls="note-rewrite-source-panel" onClick={()=>setManual(value=>!value)}>{manual?'收起原文正文':'公众号等网页读取受限？粘贴正文'}</button>{publicLink&&<a href={publicLink} target="_blank" rel="noopener noreferrer">打开原文</a>}</div>
    {manual&&<div id="note-rewrite-source-panel"><label className="sr-only" htmlFor="note-rewrite-source-text">原文正文</label><textarea id="note-rewrite-source-text" rows={6} maxLength={50000} minLength={200} disabled={!!busy} value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="在浏览器中打开原文，完成验证后复制标题和正文粘贴到这里。至少200字，将根据这些内容生成文章并保留原文链接。"/></div>}
    <div className="note-codex-compose-footer"><span>公开正文 · 生成后新建笔记</span><button type="submit" disabled={!!busy||!url.trim()||!store.readable} aria-label={busy?'正在改写':'开始改写并保存'}>{busy?<LoaderCircle size={15} className="is-spinning"/>:<ArrowUp size={16}/>}</button></div>
   </form>
   {!url&&!job&&<button className="note-codex-example" onClick={()=>setUrl(example)}><Plus size={12}/>试试公众号文章链接</button>}
   {error&&<p className="note-codex-error" role="alert">{error}</p>}
  </div>}
 </section>;
}
