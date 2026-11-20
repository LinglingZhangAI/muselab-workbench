import {useEffect,useRef,useState} from 'react';
import {ImagePlus,LoaderCircle} from 'lucide-react';
import {useNotes,type Note} from '@/lib/notes';
import {validNoteImage,type NoteImage} from '@/lib/note-images';
import {SavedArticleBody} from './saved-article-body';
export function NoteArticleBody({note}:{note:Note}){
 return note.source?.kind==='article'?<SavedArticleBody note={note}/>:<IllustratedNoteBody note={note}/>;
}
function IllustratedNoteBody({note}:{note:Note}){
 const store=useNotes();const storeRef=useRef(store);storeRef.current=store;
 const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');const text=useRef<HTMLTextAreaElement>(null);const requesting=useRef(false);
 const [removed,setRemoved]=useState<{image:NoteImage;index:number}|null>(null);
 const [selectedImage,setSelectedImage]=useState('');
 async function fetchImages(){
  if(!note.source?.url||requesting.current)return;requesting.current=true;setLoading(true);setMessage('');setRemoved(null);
  try{
   const response=await fetch('/api/note-images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:note.source.url,...(note.source.kind==='podcast'?{episodeId:note.source.episodeId}:{})}),signal:AbortSignal.timeout(90000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'原文配图暂时无法读取');
   if(!Array.isArray(data.images)||!data.images.every(validNoteImage))throw new Error('配图数据格式异常');
   storeRef.current.setImages(note.id,data.images);setMessage(data.message||'');
  }catch(e){setMessage(e instanceof Error?e.message:'配图读取失败，请重试');}finally{requesting.current=false;setLoading(false);}
 }
 useEffect(()=>{if((note.id.startsWith('rewrite-')||note.id.startsWith('podcast-article-'))&&note.source?.url&&note.images===undefined)void fetchImages();},[note.id]);
 function removeImage(image:NoteImage,index:number){store.setImages(note.id,(note.images||[]).filter(item=>item.src!==image.src));setRemoved({image,index});setSelectedImage('');setMessage('');requestAnimationFrame(()=>text.current?.focus());}
 function undoImage(){if(!removed)return;const images=[...(note.images||[])];if(!images.some(image=>image.src===removed.image.src))images.splice(Math.min(removed.index,images.length),0,removed.image);store.setImages(note.id,images);setRemoved(null);}
 useEffect(()=>{
  if(!note.images?.length||!text.current)return;const textarea=text.current;
  const resize=()=>{textarea.style.height='0';textarea.style.height=Math.max(200,textarea.scrollHeight)+'px';};resize();const observer=new ResizeObserver(resize);if(textarea.parentElement)observer.observe(textarea.parentElement);return()=>observer.disconnect();
 },[note.body,note.images?.length]);
 const editor=<textarea ref={text} className="note-body" aria-label="笔记正文" placeholder="写下你的想法…" maxLength={100000} value={note.body} onChange={e=>store.edit(note.id,{title:note.title,body:e.target.value})}/>;
 return <>
  {note.source?.url&&<div className="note-image-tools"><button disabled={loading} onClick={()=>void fetchImages()}>{loading?<LoaderCircle size={12} className="is-spinning"/>:<ImagePlus size={12}/>}<span>{loading?'正在读取原文配图':note.images?.length?'刷新原文配图':'插入原文配图'}</span></button>{message&&<span role="status">{message}</span>}</div>}
  {removed&&<div className="note-image-undo" role="status"><span>{store.error?'配图已移除，尚未保存':'已删除配图'}</span><button onClick={undoImage} disabled={loading}>撤销</button></div>}
  {note.images?.length?<div className="note-illustrated-body"><div className="note-article-images">{note.images.map((image,index)=><figure key={image.src} className={selectedImage===image.src?'is-selected':''} tabIndex={0} role="button" aria-label={'选中配图 '+(index+1)} aria-pressed={selectedImage===image.src} aria-keyshortcuts="Delete Backspace" title="点击选中，按 Delete 或退格键删除" onClick={event=>{setSelectedImage(image.src);event.currentTarget.focus();}} onFocus={()=>setSelectedImage(image.src)} onBlur={()=>setSelectedImage('')} onKeyDown={event=>{if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();if(!loading)removeImage(image,index);}else if(event.key==='Escape'){setSelectedImage('');text.current?.focus();}else if(event.key===' '||event.key==='Enter'){event.preventDefault();setSelectedImage(image.src);}}}><img src={image.src} alt={image.alt||'原文配图'} draggable={false} loading="lazy" decoding="async" onError={event=>{const target=event.currentTarget;if(target.dataset.fallback)return;target.dataset.fallback='1';target.src=image.originalUrl;}} referrerPolicy="no-referrer"/>{image.caption&&<figcaption>{image.caption}</figcaption>}</figure>)}</div>{editor}</div>:editor}
 </>;
}
