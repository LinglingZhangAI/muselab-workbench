import {useEffect,useState} from 'react';
import {ArrowUpRight,RotateCw,X} from 'lucide-react';
import {Modal} from './dialogs';
import {ReadingText} from './reading-text';

type NewsItem={id:string;title:string;content:string;tag:string;url:string;images?:string[]};
type Edition={date:string;fetchedAt:string;source:string;items:NewsItem[];stale:boolean;warning:string};
const source='https://www.uisdc.com/news';
function safeLink(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:source;}catch{return source;}}
function formatDate(date:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(new Date(date+'T00:00:00+08:00'));}
function NewsImages({item}:{item:NewsItem}){
 const [failed,setFailed]=useState<string[]>([]);
 const images=Array.isArray(item.images)?item.images.filter(src=>{if(/^\/assets\/news\/[a-f0-9]{24}\.(?:webp|png|jpe?g|gif|avif)$/.test(src))return true;try{const url=new URL(src);return url.protocol==='https:'&&url.hostname==='image.uisdc.com'&&!url.port&&!url.username&&!url.password;}catch{return false;}}):[];
 if(!images.length)return null;
 return <div className="daily-news-images">{images.map((src,index)=><figure key={src}>{failed.includes(src)?<a href={src} target="_blank" rel="noopener noreferrer">查看原站配图<ArrowUpRight size={13}/></a>:<img src={src} alt={`${item.title} · 配图${images.length>1?' '+(index+1):''}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(previous=>previous.includes(src)?previous:[...previous,src])}/>}</figure>)}</div>;
}

export function DailyNews(){
 const [edition,setEdition]=useState<Edition|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [selection,setSelection]=useState<string|null>(null);
 useEffect(()=>{
  let controller:AbortController|null=null;let active=true;
  async function load(force=false){
   controller?.abort();const request=new AbortController();controller=request;
   setLoading(true);setError('');
   try{
    const response=await fetch('/api/daily-news'+(force?'?refresh=1':''),{signal:request.signal});const result=await response.json();
    if(!response.ok)throw new Error(result.error||'新闻加载失败');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)||!Array.isArray(result.items)||!result.items.length||!result.items.every((item:NewsItem)=>typeof item.title==='string'&&typeof item.content==='string'&&typeof item.id==='string'&&typeof item.url==='string'))throw new Error('新闻数据格式异常');
    if(active&&!request.signal.aborted)setEdition(result);
   }catch(e){if(active&&!request.signal.aborted)setError(e instanceof Error?e.message:'新闻加载失败');}
   finally{if(active&&!request.signal.aborted)setLoading(false);}
  }
  void load(refresh>0);
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},5*60*1000);
  const onVisible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;controller?.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);};
 },[refresh]);
 const selected=edition?.items.find(item=>item.id===selection);
 const details=selection==='all'?edition?.items:selected?[selected]:[];
 return <section className="daily-news" aria-labelledby="daily-news-title">
  <p className="todo-date">{edition?<time dateTime={edition.date}>{formatDate(edition.date)}</time>:'优设 · 设计与 AI 动态'}</p>
  <div className="daily-news-inner">
   <div className="todo-heading"><h2 id="daily-news-title">每日新闻</h2><button className="todo-add" aria-label="刷新每日新闻" disabled={loading} onClick={()=>setRefresh(value=>value+1)}><RotateCw size={15} className={loading?'spinning':''}/></button></div>
   {loading&&!edition&&<p className="daily-news-message" role="status">正在读取优设新闻…</p>}
   {edition&&<><p className="daily-news-kicker">UISDC DAILY <span>优设情报</span></p><ol className="daily-news-list">{edition.items.slice(0,5).map((item,index)=><li key={item.id}><button onClick={()=>setSelection(item.id)} aria-label={'阅读新闻：'+item.title}><span className="daily-news-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span className="daily-news-copy"><strong>{item.title}</strong><span className="daily-news-tag">{item.tag}</span></span></button></li>)}</ol><button className="daily-news-all" onClick={()=>setSelection('all')}>查看全部 <span>{edition.items.length} 条</span><ArrowUpRight size={12}/></button></>}
   {(error||edition?.warning)&&<p className="daily-news-message is-error" role="status">{error||edition?.warning} <button onClick={()=>setRefresh(value=>value+1)}>重试</button></p>}
   {edition?.stale&&<p className="daily-news-message" role="status">暂未获取今日一期，展示 {edition.date} 的新闻。</p>}
   <div className="daily-news-source"><a href={source} target="_blank" rel="noopener noreferrer">来源：优设网 ↗</a><span>每日 7:45 更新</span></div>
   {edition&&<p className="daily-news-checked">上次同步 {new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(edition.fetchedAt))}</p>}
  </div>
  <Modal open={!!selection} onClose={()=>setSelection(null)} title={selected?.title||'优设每日新闻'} className="daily-news-modal">
   <header className="daily-news-modal-heading"><div><span>UISDC DAILY · {edition?.date}</span><h2>{selected?'优设情报':'每日新闻'}</h2></div><button className="timeline-icon" aria-label="关闭新闻详情" onClick={()=>setSelection(null)}><X size={20}/></button></header>
   <div className="daily-news-articles">{details?.map((item,index)=><article key={item.id}><p className="daily-news-article-tag">{selection==='all'?String(index+1).padStart(2,'0')+' / ':''}{item.tag}</p><h3>{item.title}</h3><NewsImages item={item}/><div className="daily-news-content reader-prose"><ReadingText text={item.content}/></div><a href={safeLink(item.url)} target="_blank" rel="noopener noreferrer">在优设查看来源<ArrowUpRight size={13}/></a></article>)}</div>
   <footer className="daily-news-modal-footer">内容摘自优设网 · {edition?.date} <a href={source} target="_blank" rel="noopener noreferrer">打开原站 ↗</a></footer>
  </Modal>
 </section>;
}
