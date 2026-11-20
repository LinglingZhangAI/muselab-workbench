import {useEffect,useState} from 'react';
import {ArrowUpRight,BookmarkPlus,Check,ExternalLink,LoaderCircle,RotateCw,X} from 'lucide-react';
import {Modal} from './dialogs';
import type {ArticleContent} from '../lib/article-content';
import {useNotes} from '../lib/notes';
import {articleToNote} from '../lib/article-note';
type Article={id:string;title:string;description:string;image:string;author:string;tag:string;url:string};
type Edition={date:string;fetchedAt:string;items:Article[];stale:boolean;warning:string};
function safeLink(value:string){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.uisdc.com'&&!url.username&&!url.password?url.href:'https://www.uisdc.com/';}catch{return 'https://www.uisdc.com/';}}
function Cover({item}:{item:Article}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[item.image]);return item.image&&!failed?<img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span className="design-cover-fallback" aria-hidden="true">优设<span>DESIGN DAILY</span></span>;}
export function DesignInsight(){
 const [edition,setEdition]=useState<Edition|null>(null);const [version,setVersion]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [selected,setSelected]=useState<Article|null>(null);
 useEffect(()=>{
  let active=true;let controller:AbortController|null=null;
  async function load(force=false){controller?.abort();const request=new AbortController();controller=request;setLoading(true);setError('');
   try{const response=await fetch('/api/design-articles'+(force?'?refresh=1':''),{signal:request.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'文章暂时无法读取');if(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)||!Array.isArray(result.items)||!result.items.every((item:Article)=>item&&['id','title','description','image','author','tag','url'].every(key=>typeof item[key as keyof Article]==='string')))throw new Error('文章数据格式异常');if(active&&!request.signal.aborted)setEdition(result);
   }catch(e){if(active&&!request.signal.aborted)setError(e instanceof Error?e.message:'文章暂时无法读取');}finally{if(active&&!request.signal.aborted)setLoading(false);}
  }
  void load(version>0);const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},300000);const visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[version]);
 return <section className="home-section design-insight" aria-labelledby="design-insight-title">
  <div className="home-section-heading"><h3 id="design-insight-title">优设 · Design Insight</h3><div className="builders-actions"><button aria-label="刷新优设文章" disabled={loading} onClick={()=>setVersion(v=>v+1)}><RotateCw size={13} className={loading?'builders-loading-icon':''}/></button><a href="https://www.uisdc.com/" target="_blank" rel="noopener noreferrer">打开原站<ExternalLink size={12}/></a></div></div>
  <div className="builders-directory design-directory" role="region" aria-label="优设每日文章" aria-busy={loading} tabIndex={0}>
   <div className="builders-archive-head"><div><span>DESIGN DAILY</span><h4>设计更新</h4></div><p>{edition?`${edition.date.replace(/-/g,'.')} 采集 · ${edition.items.length} 篇文章`:'优设网'} · 每日 7:45 更新</p></div>
   {loading&&!edition&&<p className="builders-loading" role="status">正在加载优设文章…</p>}
   {(error||edition?.warning)&&<p className="design-message" role="status">{error||edition?.warning} <button onClick={()=>setVersion(v=>v+1)}>重试</button></p>}
   {edition?.stale&&<p className="design-message">今日尚未更新，展示上次采集内容。</p>}
   <ul className="design-articles">{edition?.items.map(item=><li key={item.id}><a href={safeLink(item.url)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();setSelected(item);}} aria-label={'阅读文章：'+item.title}><div className="design-article-cover"><Cover item={item}/></div><div className="design-article-copy"><h5>{item.title}</h5><p>{item.description}</p><div className="design-article-meta"><span>{item.author||'优设网'}</span><span>{item.tag}</span><ArrowUpRight size={12}/></div></div></a></li>)}</ul>
  </div>
  <Modal open={!!selected} onClose={()=>setSelected(null)} title={selected?'文章预览：'+selected.title:'文章预览'} className="design-article-modal">{selected&&<ArticleReader key={selected.id} item={selected} onClose={()=>setSelected(null)}/>}</Modal>
 </section>;
}
function ArticleReader({item,onClose}:{item:Article;onClose:()=>void}){
 const [content,setContent]=useState<ArticleContent|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [version,setVersion]=useState(0);
 const notes=useNotes();const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
 const saved=notes.notes.find(note=>note.source?.kind==='article'&&note.source.url===item.url);
 async function save(){
  if(saving||!content||loading)return;setSaving(true);setSaveError('');
  try{const note=await articleToNote(content,item.title);if(!notes.importArticle(note))throw new Error('收藏未保存，请检查笔记存储后重试');}catch(error){setSaveError(error instanceof Error?error.message:'文章收藏失败，请重试');}finally{setSaving(false);}
 }
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');
  void(async()=>{try{const response=await fetch('/api/design-article-content?id='+encodeURIComponent(item.id),{signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'正文暂时无法读取');if(typeof data.html!=='string'||!data.html||data.url!==item.url)throw new Error('正文内容无效');if(!controller.signal.aborted)setContent(data);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'正文暂时无法读取');}finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[item.id,item.url,version]);
 return <><header><p>UISDC · 文章阅读</p><div><button className={'design-save-note'+(saved&&!notes.error?' is-saved':'')} disabled={saving||!saved&&(loading||!content||!notes.readable)} onClick={()=>{if(saved&&!notes.error){notes.select(saved.id);onClose();notes.setOpen(true);}else void save();}}>{saving?<LoaderCircle size={13} className="spinning"/>:saved&&!notes.error?<Check size={13}/>:<BookmarkPlus size={13}/>}<span>{saving?'正在收藏':saved&&!notes.error?'查看笔记':'收藏到笔记'}</span></button><a href={safeLink(item.url)} target="_blank" rel="noopener noreferrer">查看原文<ExternalLink size={12}/></a><button className="timeline-icon" aria-label="关闭优设文章" onClick={onClose}><X size={20}/></button></div></header>{(saveError||notes.error)&&<p className="design-message" role="alert">{saveError||notes.error}</p>}<div className="design-preview-body" data-note-scope data-note-title={item.title} data-note-url={safeLink(item.url)}><p className="design-preview-meta">{item.author||'优设网'}{item.tag?' · '+item.tag:''}{content?.publishedAt?' · '+content.publishedAt.slice(0,10):''}</p><h2>{item.title}</h2><p className="design-preview-description">{item.description}</p>
  {loading&&<p className="design-reader-status" role="status"><RotateCw size={14} className="spinning"/>正在读取文章正文与配图…</p>}
  {error&&<div className="design-reader-error" role="status"><p>{error}</p><button onClick={()=>setVersion(v=>v+1)}>重新加载</button><a href={safeLink(item.url)} target="_blank" rel="noopener noreferrer">查看原文 ↗</a></div>}
  {content&&<>{content.warning&&<p className="design-message" role="status">{content.warning}</p>}<article className="design-reader-content reader-prose" aria-label="文章正文" dangerouslySetInnerHTML={{__html:content.html}}/><footer className="design-reader-footer">本文来自优设网 · {item.author||'优设网'}<a href={safeLink(item.url)} target="_blank" rel="noopener noreferrer">查看来源<ArrowUpRight size={12}/></a></footer></>}
 </div></>;
}
