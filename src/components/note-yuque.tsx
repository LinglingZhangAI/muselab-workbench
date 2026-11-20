import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,LoaderCircle,Upload} from 'lucide-react';
import type {Note} from '@/lib/notes';

export function NoteYuque({note}:{note:Note}){
 const [sending,setSending]=useState(false);const [url,setUrl]=useState('');const [error,setError]=useState('');const [sent,setSent]=useState(false);
 useEffect(()=>{
  let cancelled=false;setUrl('');setError('');setSent(false);
  void fetch('/api/note-yuque?id='+encodeURIComponent(note.id)).then(response=>response.ok?response.json():null).then(result=>{if(!cancelled&&result?.url)setUrl(result.url);}).catch(()=>{});
  return()=>{cancelled=true;};
 },[note.id]);
 useEffect(()=>{setSent(false);},[note.title,note.body,note.images]);
 async function send(){
  if(sending)return;setSending(true);setError('');
  try{
   const response=await fetch('/api/note-yuque',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:note.id,title:note.title,body:note.body,source:note.source,images:note.images}),signal:AbortSignal.timeout(150000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'语雀保存失败，请稍后重试');setUrl(result.url);setSent(true);
  }catch(e){setError(e instanceof Error?e.message:'发送失败，请重试');}finally{setSending(false);}
 }
 return <span className="note-yuque"><button type="button" className="note-yuque-send" onClick={()=>void send()} disabled={sending||!note.body.trim()||!note.title.trim()} title="保存为 Muse知识库中的独立文章">{sending?<LoaderCircle size={13} className="is-spinning"/>:sent?<Check size={13}/>:<Upload size={13}/>}<span>{sending?'正在发送':sent?'已发送':url?'更新到语雀':'发送到语雀'}</span></button>{url&&<a href={url} target="_blank" rel="noopener noreferrer" aria-label="在语雀查看文章"><ArrowUpRight size={13}/></a>}{error&&<span className="note-yuque-error" role="alert">{error}</span>}</span>;
}
