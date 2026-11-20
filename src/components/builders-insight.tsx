import {useEffect,useState} from 'react';
import {ExternalLink,RotateCw,X} from 'lucide-react';
import {Modal} from './dialogs';
import {issueTypography} from '@/lib/issue-typography';

const site='https://luolan0214.github.io/follow-builders-newsletter/';
type Entry={url:string;date:string;title:string;description:string;issue:string};

export function BuildersInsight(){
 const [version,setVersion]=useState(0);
 const [entries,setEntries]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [fetchedAt,setFetchedAt]=useState('');
 const [preview,setPreview]=useState<Entry|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),35000);
  let active=true;
  setLoading(true);setError('');
  void(async()=>{
   try{
    const response=await fetch('/api/builders-directory'+(version?'?refresh=1':''),{signal:controller.signal,cache:'no-cache'});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'目录暂时未能加载');
    if(!Array.isArray(result.entries)||!result.entries.length)throw new Error('暂未读取到更新目录，请稍后重试');
    if(active){setEntries(result.entries);setFetchedAt(result.fetchedAt||'');setError(result.warning||'');}
   }catch(e){if(active)setError(controller.signal.aborted?'目录加载超时，请重试':e instanceof Error?e.message:'目录暂时未能加载');}
   finally{window.clearTimeout(timer);if(active)setLoading(false);}
  })();
  return()=>{active=false;window.clearTimeout(timer);controller.abort();};
 },[version]);
 return <section className="home-section builders-insight" aria-labelledby="builders-insight-title">
  <div className="home-section-heading"><h3 id="builders-insight-title">AI Builders' Insight</h3><div className="builders-actions"><button onClick={()=>setVersion(v=>v+1)} disabled={loading} aria-label="重新加载更新目录"><RotateCw size={13} className={loading?'builders-loading-icon':''}/></button><a href={site+'#archive'} target="_blank" rel="noopener noreferrer">打开原站<ExternalLink size={12}/></a></div></div>
  <div className="builders-directory" role="region" aria-label="更新目录" aria-busy={loading} tabIndex={0}>
   {loading&&!entries.length?<div className="builders-loading" role="status">正在加载更新目录…</div>:null}
   {error?<div className="builders-error" role="status"><span>{error}</span><button onClick={()=>setVersion(v=>v+1)}>重试</button></div>:null}
   {entries.length?<><div className="builders-archive-head"><div><span>BACK ISSUES</span><h4>往期目录</h4></div><p>原站最新一期 {entries[0].date}{fetchedAt&&Number.isFinite(Date.parse(fetchedAt))?` · 同步于 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(fetchedAt))}`:''}</p></div><ul className="builders-entries">{entries.map(entry=><li key={entry.url}><a href={entry.url} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();setPreview(entry);}}><time>{entry.date}</time><div><strong>{entry.title}</strong><p>{entry.description}</p></div><span className="builders-entry-action"><span className="builders-issue">{entry.issue}</span><span>打开本期 →</span></span></a></li>)}</ul></>:null}
  </div>
  <Modal open={!!preview} onClose={()=>setPreview(null)} title={preview?'本期预览：'+preview.title:'本期预览'} className="builders-preview-modal">{preview&&<IssuePreview key={preview.url} entry={preview} onClose={()=>setPreview(null)}/>}</Modal>
 </section>;
}

function IssuePreview({entry,onClose}:{entry:Entry;onClose:()=>void}){
 const [version,setVersion]=useState(0);const [loading,setLoading]=useState(true);const [slow,setSlow]=useState(false);
 const [document,setDocument]=useState<string|null>(null);const [fallback,setFallback]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setDocument(null);setFallback(false);
  const timer=window.setTimeout(()=>controller.abort(),30000);
  void(async()=>{try{const response=await fetch(entry.url,{signal:controller.signal,credentials:'omit'});if(!response.ok)throw new Error('暂不可读取');const html=await response.text();if(html.length>4*1024*1024)throw new Error('内容过大');if(active)setDocument(issueTypography(html,entry.url));}catch{if(active)setFallback(true);}finally{window.clearTimeout(timer);}})();
  return()=>{active=false;controller.abort();window.clearTimeout(timer);};
 },[entry.url,version]);
 useEffect(()=>{setLoading(true);setSlow(false);const timer=window.setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[entry.url,version]);
 return <><header className="builders-preview-heading"><div><p>{entry.date}{entry.issue?' · '+entry.issue:''}</p><h2>{entry.title}</h2></div><div><a href={entry.url} target="_blank" rel="noopener noreferrer">打开原文<ExternalLink size={13}/></a><button aria-label="重新加载本期" onClick={()=>setVersion(v=>v+1)}><RotateCw size={16}/></button><button aria-label="关闭本期预览" onClick={onClose}><X size={20}/></button></div></header>{loading&&<p className="builders-preview-status" role="status">{slow?'文章加载较慢，可重试或打开原文。':'正在加载本期内容…'}</p>}{(document||fallback)&&<iframe key={version} className="builders-preview-frame" src={document?undefined:entry.url} srcDoc={document||undefined} title={entry.title+' · 本期内容'} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" onLoad={()=>setLoading(false)} onError={()=>{setLoading(true);setSlow(true);}}/>}</>;
}
